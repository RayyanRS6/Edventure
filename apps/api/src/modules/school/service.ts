import { and, asc, count, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import type { AcademicYear, CalendarDay, SchoolSettings } from '@edventure/contracts';
import {
  createAcademicYearRequest,
  createRoomRequest,
  createTermRequest,
  updateAcademicYearRequest,
  updateSchoolSettingsRequest,
  upsertCalendarDayRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  academicYears,
  examCycles,
  leaveRequests,
  rooms,
  schoolCalendarDays,
  schoolPolicies,
  schools,
  studentEnrollments,
  terms,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { requireAdmin } from '../../platform/scope';
import { resolveAudience } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';

type YearRow = typeof academicYears.$inferSelect;

export const toAcademicYear = (y: YearRow): AcademicYear => ({
  id: y.id,
  code: y.code,
  name: y.name,
  startDate: y.startDate,
  endDate: y.endDate,
  status: y.status,
  closedAt: y.closedAt?.toISOString() ?? null,
  version: y.version,
});

/** Closed academic years are read-only except through an audited reopen/correction. */
export async function assertYearWritable(tx: Tx, academicYearId: string) {
  const [year] = await tx.select({ status: academicYears.status }).from(academicYears).where(eq(academicYears.id, academicYearId));
  if (!year) throw errors.notFound('Academic year');
  if (year.status === 'closed') throw errors.rule('This academic year is closed. Reopen it with a reason to make corrections.');
}

export class SchoolService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  async settings(actor: Actor): Promise<SchoolSettings> {
    return this.run(actor, async (tx) => {
      const [s] = await tx.select().from(schools).where(eq(schools.id, actor.schoolId));
      const [p] = await tx.select().from(schoolPolicies).where(eq(schoolPolicies.schoolId, actor.schoolId));
      const school = required(s, 'School');
      const policy = required(p, 'School policy');
      return {
        id: school.id,
        code: school.code,
        name: school.name,
        nameUr: school.nameUr,
        timezone: school.timezone,
        currency: school.currency,
        defaultLocale: school.defaultLocale,
        branding: school.branding,
        policies: {
          attendance: policy.attendance,
          retention: policy.retention,
          notifications: policy.notifications,
          operations: policy.operations,
        },
        version: school.version,
      };
    });
  }

  async updateSettings(actor: Actor, raw: z.input<typeof updateSchoolSettingsRequest>) {
    requireAdmin(actor);
    const input = updateSchoolSettingsRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const updated = await tx
        .update(schools)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.nameUr !== undefined ? { nameUr: input.nameUr } : {}),
          ...(input.defaultLocale ? { defaultLocale: input.defaultLocale } : {}),
          ...(input.branding ? { branding: input.branding } : {}),
          version: sql`${schools.version} + 1`,
        })
        .where(and(eq(schools.id, actor.schoolId), eq(schools.version, input.version)))
        .returning({ id: schools.id });
      if (!updated.length) throw errors.version();
      const [policy] = await tx.select().from(schoolPolicies).where(eq(schoolPolicies.schoolId, actor.schoolId));
      await tx
        .update(schoolPolicies)
        .set({
          ...(input.attendance ? { attendance: input.attendance } : {}),
          ...(input.notifications ? { notifications: input.notifications } : {}),
          ...(input.retention ? { retention: { ...policy!.retention, ...input.retention } } : {}),
          version: sql`${schoolPolicies.version} + 1`,
        })
        .where(eq(schoolPolicies.schoolId, actor.schoolId));
      await audit(tx, actor, {
        action: 'school.settings_updated',
        entityType: 'school',
        entityId: actor.schoolId,
        summary: { fields: Object.keys(input).filter((k) => k !== 'version') },
      });
    });
    return this.settings(actor);
  }

  /* ---------------- Academic years ---------------- */

  async listYears(actor: Actor) {
    return this.run(actor, async (tx) => (await tx.select().from(academicYears).orderBy(asc(academicYears.startDate))).map(toAcademicYear));
  }

  async createYear(actor: Actor, raw: z.input<typeof createAcademicYearRequest>) {
    requireAdmin(actor);
    const input = createAcademicYearRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const overlap = await tx
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(lte(academicYears.startDate, input.endDate), gte(academicYears.endDate, input.startDate)));
      if (overlap.length) throw errors.field('startDate', 'Academic years cannot overlap');
      const [row] = await tx.insert(academicYears).values({ schoolId: actor.schoolId, ...input }).returning();
      await audit(tx, actor, { action: 'academic_year.created', entityType: 'academic_year', entityId: row!.id, summary: { code: input.code } });
      return toAcademicYear(row!);
    });
  }

  async updateYear(actor: Actor, yearId: string, raw: z.input<typeof updateAcademicYearRequest>) {
    requireAdmin(actor);
    const input = updateAcademicYearRequest.parse(raw);
    return this.run(actor, async (tx) => {
      await assertYearWritable(tx, yearId);
      const [row] = await tx
        .update(academicYears)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.startDate ? { startDate: input.startDate } : {}),
          ...(input.endDate ? { endDate: input.endDate } : {}),
          version: sql`${academicYears.version} + 1`,
        })
        .where(and(eq(academicYears.id, yearId), eq(academicYears.version, input.version)))
        .returning();
      if (!row) throw errors.version();
      await audit(tx, actor, { action: 'academic_year.updated', entityType: 'academic_year', entityId: yearId });
      return toAcademicYear(row);
    });
  }

  async activateYear(actor: Actor, yearId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [active] = await tx.select().from(academicYears).where(and(eq(academicYears.status, 'active'), ne(academicYears.id, yearId)));
      if (active) throw errors.rule(`Close ${active.name} before activating another academic year.`);
      const [row] = await tx
        .update(academicYears)
        .set({ status: 'active', version: sql`${academicYears.version} + 1` })
        .where(and(eq(academicYears.id, yearId), eq(academicYears.status, 'planning')))
        .returning();
      if (!row) throw errors.rule('Only a year in planning can be activated.');
      await audit(tx, actor, { action: 'academic_year.activated', entityType: 'academic_year', entityId: yearId });
      return toAcademicYear(row);
    });
  }

  /** Lists unresolved work that blocks final closure. */
  async closureCheck(actor: Actor, yearId: string) {
    requireAdmin(actor);
    return this.run(actor, (tx) => this.closureBlockers(tx, yearId));
  }

  private async closureBlockers(tx: Tx, yearId: string) {
    const [year] = await tx.select().from(academicYears).where(eq(academicYears.id, yearId));
    const y = required(year, 'Academic year');
    const [unresolved] = await tx
      .select({ n: count() })
      .from(studentEnrollments)
      .where(
        and(
          eq(studentEnrollments.academicYearId, yearId),
          eq(studentEnrollments.status, 'active'),
          sql`not exists (select 1 from app.promotion_decisions d where d.source_enrollment_id = ${studentEnrollments.id} and d.executed_at is not null)`,
        ),
      );
    const [openExams] = await tx
      .select({ n: count() })
      .from(examCycles)
      .where(and(eq(examCycles.academicYearId, yearId), inArray(examCycles.state, ['draft', 'scheduled', 'marking', 'review'])));
    const [pendingLeave] = await tx
      .select({ n: count() })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.state, 'pending'), lte(leaveRequests.startDate, y.endDate), gte(leaveRequests.endDate, y.startDate)));
    const blockers = [
      { kind: 'enrollments', count: unresolved?.n ?? 0, message: 'students have no promotion, graduation or withdrawal outcome' },
      { kind: 'exams', count: openExams?.n ?? 0, message: 'exam cycles are not yet published' },
      { kind: 'leave', count: pendingLeave?.n ?? 0, message: 'leave requests are still pending' },
    ].filter((b) => b.count > 0);
    return { canClose: y.status === 'active' && blockers.length === 0, blockers };
  }

  async closeYear(actor: Actor, yearId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const check = await this.closureBlockers(tx, yearId);
      if (!check.canClose) throw errors.rule('This academic year still has unresolved work.', { blockers: check.blockers });
      await tx
        .update(studentEnrollments)
        .set({ status: 'completed', endDate: sql`coalesce(${studentEnrollments.endDate}, (select end_date + 1 from app.academic_years where id = ${yearId}))` })
        .where(and(eq(studentEnrollments.academicYearId, yearId), eq(studentEnrollments.status, 'active')));
      const [row] = await tx
        .update(academicYears)
        .set({ status: 'closed', closedAt: new Date(), closedByAccountId: actor.accountId, version: sql`${academicYears.version} + 1` })
        .where(eq(academicYears.id, yearId))
        .returning();
      await audit(tx, actor, { action: 'academic_year.closed', entityType: 'academic_year', entityId: yearId });
      return toAcademicYear(row!);
    });
  }

  /** Audited correction path for closed years. */
  async reopenYear(actor: Actor, yearId: string, reason: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [active] = await tx.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.status, 'active'));
      const [row] = await tx
        .update(academicYears)
        .set({ status: active ? 'planning' : 'active', closedAt: null, version: sql`${academicYears.version} + 1` })
        .where(and(eq(academicYears.id, yearId), eq(academicYears.status, 'closed')))
        .returning();
      if (!row) throw errors.rule('Only a closed year can be reopened.');
      await audit(tx, actor, { action: 'academic_year.reopened', entityType: 'academic_year', entityId: yearId, reason });
      return toAcademicYear(row);
    });
  }

  /* ---------------- Terms ---------------- */

  async listTerms(actor: Actor, yearId: string) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(terms).where(eq(terms.academicYearId, yearId)).orderBy(asc(terms.sequence))).map((t) => ({
        id: t.id,
        academicYearId: t.academicYearId,
        name: t.name,
        nameUr: t.nameUr,
        sequence: t.sequence,
        startDate: t.startDate,
        endDate: t.endDate,
      })),
    );
  }

  async createTerm(actor: Actor, yearId: string, raw: z.input<typeof createTermRequest>) {
    requireAdmin(actor);
    const input = createTermRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await assertYearWritable(tx, yearId);
      const [year] = await tx.select().from(academicYears).where(eq(academicYears.id, yearId));
      if (input.startDate < year!.startDate || input.endDate > year!.endDate) {
        throw errors.field('startDate', 'The term must fall within the academic year');
      }
      const [row] = await tx
        .insert(terms)
        .values({ schoolId: actor.schoolId, academicYearId: yearId, ...input, nameUr: input.nameUr ?? null })
        .returning();
      await audit(tx, actor, { action: 'term.created', entityType: 'term', entityId: row!.id });
    });
    return this.listTerms(actor, yearId);
  }

  async deleteTerm(actor: Actor, termId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [t] = await tx.select().from(terms).where(eq(terms.id, termId));
      await assertYearWritable(tx, required(t, 'Term').academicYearId);
      await tx.delete(terms).where(eq(terms.id, termId));
      await audit(tx, actor, { action: 'term.deleted', entityType: 'term', entityId: termId });
    });
  }

  /* ---------------- Calendar ---------------- */

  async calendar(actor: Actor, from: string, to: string): Promise<CalendarDay[]> {
    if (to < from) throw errors.field('to', 'End date must be after the start date');
    return this.run(actor, async (tx) =>
      (
        await tx
          .select()
          .from(schoolCalendarDays)
          .where(and(gte(schoolCalendarDays.date, from), lte(schoolCalendarDays.date, to)))
          .orderBy(asc(schoolCalendarDays.date))
      ).map((d) => ({ id: d.id, date: d.date, kind: d.kind, title: d.title, titleUr: d.titleUr, note: d.note })),
    );
  }

  async upsertCalendarDay(actor: Actor, raw: z.input<typeof upsertCalendarDayRequest>) {
    requireAdmin(actor);
    const input = upsertCalendarDayRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [year] = await tx
        .select({ id: academicYears.id })
        .from(academicYears)
        .where(and(lte(academicYears.startDate, input.date), gte(academicYears.endDate, input.date)));
      const [row] = await tx
        .insert(schoolCalendarDays)
        .values({
          schoolId: actor.schoolId,
          academicYearId: year?.id ?? null,
          date: input.date,
          kind: input.kind,
          title: input.title,
          titleUr: input.titleUr ?? null,
          note: input.note ?? null,
        })
        .onConflictDoUpdate({
          target: [schoolCalendarDays.schoolId, schoolCalendarDays.date],
          set: { kind: input.kind, title: input.title, titleUr: input.titleUr ?? null, note: input.note ?? null },
        })
        .returning();
      await audit(tx, actor, {
        action: 'calendar.day_set',
        entityType: 'calendar_day',
        entityId: row!.id,
        summary: { date: input.date, kind: input.kind },
      });
      if (input.notify) {
        const recipients = await resolveAudience(tx, [{ target: 'everyone' }], input.date);
        await this.comms.notify(tx, actor, {
          kind: 'calendar.holiday',
          data: { title: input.title, titleUr: input.titleUr, date: input.date, kind: input.kind },
          recipients,
          entityType: 'calendar_day',
          entityId: row!.id,
          link: `/calendar?date=${input.date}`,
          dedupeKey: `calendar:${input.date}:${input.kind}:${input.title}`,
        });
      }
      return { id: row!.id, date: row!.date, kind: row!.kind, title: row!.title, titleUr: row!.titleUr, note: row!.note };
    });
  }

  async deleteCalendarDay(actor: Actor, dayId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx.delete(schoolCalendarDays).where(eq(schoolCalendarDays.id, dayId)).returning({ id: schoolCalendarDays.id });
      if (!rows.length) throw errors.notFound('Calendar entry');
      await audit(tx, actor, { action: 'calendar.day_removed', entityType: 'calendar_day', entityId: dayId });
    });
  }

  /* ---------------- Rooms ---------------- */

  async listRooms(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(rooms).orderBy(asc(rooms.code))).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        capacity: r.capacity,
        archived: r.archivedAt !== null,
      })),
    );
  }

  async createRoom(actor: Actor, raw: z.input<typeof createRoomRequest>) {
    requireAdmin(actor);
    const input = createRoomRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [r] = await tx.insert(rooms).values({ schoolId: actor.schoolId, ...input, capacity: input.capacity ?? null }).returning();
      await audit(tx, actor, { action: 'room.created', entityType: 'room', entityId: r!.id });
      return { id: r!.id, code: r!.code, name: r!.name, capacity: r!.capacity, archived: false };
    });
  }

  async archiveRoom(actor: Actor, roomId: string, archived: boolean) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(rooms)
        .set({ archivedAt: archived ? new Date() : null })
        .where(and(eq(rooms.id, roomId), archived ? isNull(rooms.archivedAt) : undefined))
        .returning({ id: rooms.id });
      if (!rows.length) throw errors.notFound('Room');
      await audit(tx, actor, { action: archived ? 'room.archived' : 'room.unarchived', entityType: 'room', entityId: roomId });
    });
  }
}
