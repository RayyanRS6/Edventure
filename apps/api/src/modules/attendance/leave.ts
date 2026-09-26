import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import type { LeaveRequest } from '@edventure/contracts';
import { createLeaveRequest, createLeaveTypeRequest, decideLeaveRequest, leaveListQuery, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import { accounts, leaveRequests, leaveTypes, studentAttendance, students, teacherAttendance, teachers } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { instructionalDays } from '../../platform/calendar';
import { errors, required } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { activeOn, requireAdmin } from '../../platform/scope';
import { studentPlacements } from '../../db/schema';
import { adminAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';

type Row = typeof leaveRequests.$inferSelect;

/**
 * Leave: request → administrator decision → notification → attendance review. Approval proposes
 * excused days only where nothing was recorded; it never overwrites a present/late record, and
 * cancellation reverses only the records this leave created.
 */
export class LeaveService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  async listTypes(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(leaveTypes).orderBy(asc(leaveTypes.name))).map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        nameUr: t.nameUr,
        audience: t.audience,
        archived: t.archivedAt !== null,
      })),
    );
  }

  async createType(actor: Actor, raw: z.input<typeof createLeaveTypeRequest>) {
    requireAdmin(actor);
    const input = createLeaveTypeRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.insert(leaveTypes).values({ schoolId: actor.schoolId, ...input, nameUr: input.nameUr ?? null }).returning();
      await audit(tx, actor, { action: 'leave_type.created', entityType: 'leave_type', entityId: row!.id });
    });
    return this.listTypes(actor);
  }

  async archiveType(actor: Actor, id: string) {
    requireAdmin(actor);
    await this.run(actor, (tx) => tx.update(leaveTypes).set({ archivedAt: new Date() }).where(eq(leaveTypes.id, id)));
  }

  private async load(tx: Tx, rows: Row[]): Promise<LeaveRequest[]> {
    if (!rows.length) return [];
    const accountIds = [...new Set(rows.flatMap((r) => [r.requesterAccountId, r.decidedByAccountId].filter(Boolean) as string[]))];
    const names = new Map((await tx.select({ id: accounts.id, name: accounts.displayName }).from(accounts).where(inArray(accounts.id, accountIds))).map((a) => [a.id, a.name]));
    const types = new Map((await tx.select().from(leaveTypes).where(inArray(leaveTypes.id, [...new Set(rows.map((r) => r.leaveTypeId))]))).map((t) => [t.id, t]));
    const studentIds = rows.map((r) => r.studentId).filter(Boolean) as string[];
    const teacherIds = rows.map((r) => r.teacherId).filter(Boolean) as string[];
    const studentInfo = studentIds.length
      ? new Map(
          (await tx.select({ id: students.id, name: accounts.displayName, adm: students.admissionNumber }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(inArray(students.id, studentIds))).map((s) => [s.id, s]),
        )
      : new Map();
    const teacherInfo = teacherIds.length
      ? new Map(
          (await tx.select({ id: teachers.id, name: accounts.displayName, emp: teachers.employeeNumber }).from(teachers).innerJoin(accounts, eq(accounts.id, teachers.accountId)).where(inArray(teachers.id, teacherIds))).map((t) => [t.id, t]),
        )
      : new Map();
    return rows.map((r) => {
      const s = r.studentId ? studentInfo.get(r.studentId) : null;
      const t = r.teacherId ? teacherInfo.get(r.teacherId) : null;
      return {
        id: r.id,
        requester: { accountId: r.requesterAccountId, displayName: names.get(r.requesterAccountId) ?? '' },
        subject: r.studentId
          ? { kind: 'student' as const, id: r.studentId, displayName: s?.name ?? '', detail: s?.adm ?? null }
          : { kind: 'teacher' as const, id: r.teacherId!, displayName: t?.name ?? '', detail: t?.emp ?? null },
        leaveTypeId: r.leaveTypeId,
        leaveTypeName: types.get(r.leaveTypeId)?.name ?? '',
        startDate: r.startDate,
        endDate: r.endDate,
        reason: r.reason,
        state: r.state,
        decidedBy: r.decidedByAccountId ? (names.get(r.decidedByAccountId) ?? null) : null,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionNote: r.decisionNote,
        createdAt: r.createdAt.toISOString(),
        version: r.version,
      };
    });
  }

  async create(actor: Actor, raw: z.input<typeof createLeaveRequest>) {
    const input = createLeaveRequest.parse(raw);
    return this.run(actor, async (tx) => {
      let studentId: string | null = null;
      let teacherId: string | null = null;
      if (input.studentId || input.teacherId) {
        if (!isAdmin(actor) && input.studentId !== actor.studentId && input.teacherId !== actor.teacherId) throw errors.forbidden();
        studentId = input.studentId ?? null;
        teacherId = studentId ? null : (input.teacherId ?? null);
      } else if (actor.studentId) studentId = actor.studentId;
      else if (actor.teacherId) teacherId = actor.teacherId;
      else throw errors.field('studentId', 'Choose who the leave is for');

      const [type] = await tx.select().from(leaveTypes).where(and(eq(leaveTypes.id, input.leaveTypeId), isNull(leaveTypes.archivedAt)));
      const lt_ = required(type, 'Leave type');
      if ((lt_.audience === 'student' && !studentId) || (lt_.audience === 'teacher' && !teacherId)) {
        throw errors.field('leaveTypeId', 'This leave type is not available for this person');
      }
      const overlap = await tx
        .select({ id: leaveRequests.id })
        .from(leaveRequests)
        .where(
          and(
            studentId ? eq(leaveRequests.studentId, studentId) : eq(leaveRequests.teacherId, teacherId!),
            inArray(leaveRequests.state, ['pending', 'approved']),
            lte(leaveRequests.startDate, input.endDate),
            gte(leaveRequests.endDate, input.startDate),
          ),
        );
      if (overlap.length) throw errors.conflict('There is already a leave request for some of these dates.');
      const [row] = await tx
        .insert(leaveRequests)
        .values({
          schoolId: actor.schoolId,
          requesterAccountId: actor.accountId,
          studentId,
          teacherId,
          leaveTypeId: input.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: input.reason,
        })
        .returning();
      const [requester] = await tx.select({ name: accounts.displayName }).from(accounts).where(eq(accounts.id, actor.accountId));
      await this.comms.notify(tx, actor, {
        kind: 'leave.requested',
        data: { name: requester?.name ?? '' },
        recipients: await adminAccountIds(tx),
        entityType: 'leave_request',
        entityId: row!.id,
        link: `/leave/${row!.id}`,
      });
      await audit(tx, actor, { action: 'leave.requested', entityType: 'leave_request', entityId: row!.id });
      return (await this.load(tx, [row!]))[0]!;
    });
  }

  async list(actor: Actor, raw: z.input<typeof leaveListQuery>) {
    const q = leaveListQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      if (!isAdmin(actor) || q.mine === 'true') {
        conditions.push(
          or(
            eq(leaveRequests.requesterAccountId, actor.accountId),
            actor.studentId ? eq(leaveRequests.studentId, actor.studentId) : sql`false`,
            actor.teacherId ? eq(leaveRequests.teacherId, actor.teacherId) : sql`false`,
          )!,
        );
      }
      if (q.state) conditions.push(eq(leaveRequests.state, q.state));
      if (q.audience === 'student') conditions.push(sql`${leaveRequests.studentId} is not null`);
      if (q.audience === 'teacher') conditions.push(sql`${leaveRequests.teacherId} is not null`);
      if (q.from) conditions.push(gte(leaveRequests.endDate, q.from));
      if (q.to) conditions.push(lte(leaveRequests.startDate, q.to));
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(lt(leaveRequests.createdAt, new Date(cursor[0])), and(eq(leaveRequests.createdAt, new Date(cursor[0])), lt(leaveRequests.id, cursor[1])))!);
      const rows = await tx.select().from(leaveRequests).where(and(...conditions)).orderBy(desc(leaveRequests.createdAt), desc(leaveRequests.id)).limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      return {
        items: await this.load(tx, page),
        nextCursor: rows.length > q.limit && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
      };
    });
  }

  async get(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      const r = required(row, 'Leave request');
      if (!isAdmin(actor) && r.requesterAccountId !== actor.accountId && r.studentId !== actor.studentId && r.teacherId !== actor.teacherId) throw errors.notFound('Leave request');
      return (await this.load(tx, [r]))[0]!;
    });
  }

  async decide(actor: Actor, id: string, raw: z.input<typeof decideLeaveRequest>) {
    requireAdmin(actor);
    const input = decideLeaveRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, id)).for('update');
      const r = required(row, 'Leave request');
      if (r.version !== input.version) throw errors.version();
      if (r.state !== 'pending') throw errors.rule('This request has already been decided.');
      const state = input.decision === 'approve' ? 'approved' : 'rejected';
      const [updated] = await tx
        .update(leaveRequests)
        .set({ state, decidedByAccountId: actor.accountId, decidedAt: new Date(), decisionNote: input.note ?? null, version: r.version + 1 })
        .where(eq(leaveRequests.id, id))
        .returning();
      let created = 0;
      const conflicts: Array<{ date: string; status: 'present' | 'absent' | 'late' | 'excused' }> = [];
      if (state === 'approved') {
        const days = await instructionalDays(tx, r.startDate, r.endDate);
        if (r.studentId) {
          const existing = await tx.select().from(studentAttendance).where(and(eq(studentAttendance.studentId, r.studentId), gte(studentAttendance.date, r.startDate), lte(studentAttendance.date, r.endDate)));
          for (const d of days) {
            const rec = existing.find((e) => e.date === d);
            if (rec) {
              if (rec.status !== 'excused') conflicts.push({ date: d, status: rec.status });
              continue;
            }
            const [placement] = await tx
              .select()
              .from(studentPlacements)
              .where(and(eq(studentPlacements.studentId, r.studentId), activeOn(studentPlacements.startDate, studentPlacements.endDate, d)));
            if (!placement) continue;
            await tx.insert(studentAttendance).values({
              schoolId: actor.schoolId,
              studentId: r.studentId,
              enrollmentId: placement.enrollmentId,
              placementId: placement.id,
              sectionId: placement.sectionId,
              date: d,
              status: 'excused',
              source: 'leave',
              leaveRequestId: id,
              note: 'Approved leave',
              recordedByAccountId: actor.accountId,
            });
            created++;
          }
        } else if (r.teacherId) {
          const existing = await tx.select().from(teacherAttendance).where(and(eq(teacherAttendance.teacherId, r.teacherId), gte(teacherAttendance.date, r.startDate), lte(teacherAttendance.date, r.endDate)));
          for (const d of days) {
            const rec = existing.find((e) => e.date === d);
            if (rec) {
              if (rec.status !== 'excused') conflicts.push({ date: d, status: rec.status });
              continue;
            }
            await tx.insert(teacherAttendance).values({
              schoolId: actor.schoolId,
              teacherId: r.teacherId,
              date: d,
              status: 'excused',
              source: 'leave',
              leaveRequestId: id,
              note: 'Approved leave',
              recordedByAccountId: actor.accountId,
            });
            created++;
          }
        }
      }
      const recipients = new Set([r.requesterAccountId]);
      if (r.studentId) (await tx.select({ id: students.accountId }).from(students).where(eq(students.id, r.studentId))).forEach((s) => recipients.add(s.id));
      await this.comms.notify(tx, actor, {
        kind: 'leave.decided',
        data: { state },
        recipients: [...recipients],
        entityType: 'leave_request',
        entityId: id,
        link: `/leave/${id}`,
      });
      await audit(tx, actor, { action: `leave.${state}`, entityType: 'leave_request', entityId: id, summary: { excusedDaysCreated: created, conflicts: conflicts.length } });
      return { request: (await this.load(tx, [updated!]))[0]!, excusedDaysCreated: created, conflicts };
    });
  }

  /** Cancels a pending or approved request and reverses only the attendance this leave created. */
  async cancel(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, id)).for('update');
      const r = required(row, 'Leave request');
      const own = r.requesterAccountId === actor.accountId || r.studentId === actor.studentId || r.teacherId === actor.teacherId;
      if (!isAdmin(actor) && !(own && r.state === 'pending')) throw errors.forbidden('Only pending requests can be cancelled by the requester');
      if (r.state === 'cancelled' || r.state === 'rejected') throw errors.rule('This request is already closed.');
      // Only leave-created, uncorrected records are removed; anything corrected since stays.
      await tx.execute(sql`delete from app.student_attendance a where a.leave_request_id = ${id} and a.source = 'leave'
        and not exists (select 1 from app.attendance_revisions r where r.student_attendance_id = a.id)`);
      await tx.execute(sql`delete from app.teacher_attendance a where a.leave_request_id = ${id} and a.source = 'leave'
        and not exists (select 1 from app.attendance_revisions r where r.teacher_attendance_id = a.id)`);
      const [updated] = await tx
        .update(leaveRequests)
        .set({ state: 'cancelled', cancelledAt: new Date(), version: r.version + 1 })
        .where(and(eq(leaveRequests.id, id), ne(leaveRequests.state, 'cancelled')))
        .returning();
      await audit(tx, actor, { action: 'leave.cancelled', entityType: 'leave_request', entityId: id });
      return (await this.load(tx, [updated!]))[0]!;
    });
  }
}
