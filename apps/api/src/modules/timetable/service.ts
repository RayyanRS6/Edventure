import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { DaySchedule, Lesson, PeriodDefinition, TimetableVersion, WeekSchedule } from '@edventure/contracts';
import {
  createLessonExceptionRequest,
  createPeriodRequest,
  createTimetableVersionRequest,
  publishTimetableRequest,
  updatePeriodRequest,
  upsertLessonRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  classOfferings,
  courseOfferings,
  gradeLevels,
  lessonExceptions,
  periodDefinitions,
  rooms,
  schoolCalendarDays,
  sections,
  subjects,
  teacherAssignments,
  teachers,
  teachingGroupMemberships,
  teachingGroups,
  timetableLessons,
  timetableVersions,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { isInstructionalDay } from '../../platform/calendar';
import { isoWeekday } from '../../platform/dates';
import { errors, required } from '../../platform/errors';
import { activeOn, assertCanViewStudent, requireAdmin, today } from '../../platform/scope';
import { lockSchedule } from '../academics/enrollment';
import { resolveAudience, teacherAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';
import { assertYearWritable } from '../school/service';
import { detectConflicts, publishedVersionOn } from './conflicts';

const hhmm = (t: string) => t.slice(0, 5);
type VersionRow = typeof timetableVersions.$inferSelect;

export class TimetableService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Periods ---------------- */

  private toPeriod(p: typeof periodDefinitions.$inferSelect): PeriodDefinition {
    return { id: p.id, academicYearId: p.academicYearId, sequence: p.sequence, name: p.name, startTime: hhmm(p.startTime), endTime: hhmm(p.endTime), kind: p.kind };
  }

  async listPeriods(actor: Actor, academicYearId: string) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(periodDefinitions).where(eq(periodDefinitions.academicYearId, academicYearId)).orderBy(asc(periodDefinitions.sequence))).map((p) => this.toPeriod(p)),
    );
  }

  async createPeriod(actor: Actor, raw: z.input<typeof createPeriodRequest>) {
    requireAdmin(actor);
    const input = createPeriodRequest.parse(raw);
    return this.run(actor, async (tx) => {
      await assertYearWritable(tx, input.academicYearId);
      const [row] = await tx.insert(periodDefinitions).values({ schoolId: actor.schoolId, ...input }).returning();
      await audit(tx, actor, { action: 'period.created', entityType: 'period', entityId: row!.id });
      return this.toPeriod(row!);
    });
  }

  async updatePeriod(actor: Actor, periodId: string, raw: z.input<typeof updatePeriodRequest>) {
    requireAdmin(actor);
    const input = updatePeriodRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [row] = await tx.update(periodDefinitions).set(input).where(eq(periodDefinitions.id, periodId)).returning();
      const p = required(row, 'Period');
      if (p.endTime <= p.startTime) throw errors.field('endTime', 'End time must be after start time');
      await audit(tx, actor, { action: 'period.updated', entityType: 'period', entityId: periodId });
      return this.toPeriod(p);
    });
  }

  async deletePeriod(actor: Actor, periodId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(timetableLessons).where(eq(timetableLessons.periodDefinitionId, periodId));
      if (n > 0) throw errors.rule('This period is used by timetable lessons.');
      await tx.delete(periodDefinitions).where(eq(periodDefinitions.id, periodId));
      await audit(tx, actor, { action: 'period.deleted', entityType: 'period', entityId: periodId });
    });
  }

  /* ---------------- Versions ---------------- */

  private async toVersion(tx: Tx, v: VersionRow): Promise<TimetableVersion> {
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(timetableLessons).where(eq(timetableLessons.timetableVersionId, v.id));
    return {
      id: v.id,
      academicYearId: v.academicYearId,
      name: v.name,
      status: v.status,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      lessonCount: n,
      conflicts: v.validation?.conflicts ?? null,
      validatedAt: v.validation?.checkedAt ?? null,
      version: v.version,
    };
  }

  async listVersions(actor: Actor, academicYearId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const rows = await tx.select().from(timetableVersions).where(eq(timetableVersions.academicYearId, academicYearId)).orderBy(desc(timetableVersions.createdAt));
      return Promise.all(rows.map((v) => this.toVersion(tx, v)));
    });
  }

  async createVersion(actor: Actor, raw: z.input<typeof createTimetableVersionRequest>) {
    requireAdmin(actor);
    const input = createTimetableVersionRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      await assertYearWritable(tx, input.academicYearId);
      const [v] = await tx.insert(timetableVersions).values({ schoolId: actor.schoolId, academicYearId: input.academicYearId, name: input.name }).returning();
      if (input.copyFromVersionId) {
        await tx.execute(sql`
          insert into app.timetable_lessons (school_id, timetable_version_id, weekday, period_definition_id, teaching_group_id, teacher_id, room_id)
          select school_id, ${v!.id}, weekday, period_definition_id, teaching_group_id, teacher_id, room_id
          from app.timetable_lessons where timetable_version_id = ${input.copyFromVersionId}`);
      }
      await audit(tx, actor, { action: 'timetable.created', entityType: 'timetable_version', entityId: v!.id });
      return v!.id;
    });
    return this.getVersion(actor, id);
  }

  async getVersion(actor: Actor, versionId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [v] = await tx.select().from(timetableVersions).where(eq(timetableVersions.id, versionId));
      const version = required(v, 'Timetable');
      const periods = await tx.select().from(periodDefinitions).where(eq(periodDefinitions.academicYearId, version.academicYearId)).orderBy(asc(periodDefinitions.sequence));
      return {
        ...(await this.toVersion(tx, version)),
        periods: periods.map((p) => this.toPeriod(p)),
        lessons: await this.lessonsFor(tx, [eq(timetableLessons.timetableVersionId, versionId)]),
      };
    });
  }

  private async lessonsFor(tx: Tx, where: Parameters<typeof and>): Promise<Lesson[]> {
    const rows = await tx
      .select({
        l: timetableLessons,
        groupName: teachingGroups.name,
        subjectName: subjects.name,
        subjectNameUr: subjects.nameUr,
        sectionId: sections.id,
        sectionName: sections.name,
        gradeName: gradeLevels.name,
        teacherName: accounts.displayName,
        roomName: rooms.name,
      })
      .from(timetableLessons)
      .innerJoin(teachingGroups, eq(teachingGroups.id, timetableLessons.teachingGroupId))
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .innerJoin(classOfferings, eq(classOfferings.id, courseOfferings.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .innerJoin(teachers, eq(teachers.id, timetableLessons.teacherId))
      .innerJoin(accounts, eq(accounts.id, teachers.accountId))
      .leftJoin(sections, eq(sections.id, teachingGroups.sectionId))
      .leftJoin(rooms, eq(rooms.id, timetableLessons.roomId))
      .where(and(...where))
      .orderBy(asc(timetableLessons.weekday));
    return rows.map((r) => ({
      id: r.l.id,
      weekday: r.l.weekday,
      periodId: r.l.periodDefinitionId,
      teachingGroupId: r.l.teachingGroupId,
      groupName: r.groupName,
      subjectName: r.subjectName,
      subjectNameUr: r.subjectNameUr,
      sectionId: r.sectionId,
      sectionName: r.sectionName,
      gradeName: r.gradeName,
      teacherId: r.l.teacherId,
      teacherName: r.teacherName,
      roomId: r.l.roomId,
      roomName: r.roomName,
    }));
  }

  private async draftVersion(tx: Tx, versionId: string) {
    const [v] = await tx.select().from(timetableVersions).where(eq(timetableVersions.id, versionId)).for('update');
    const version = required(v, 'Timetable');
    if (version.status !== 'draft') throw errors.rule('Published timetables cannot be edited. Create a new version from it instead.');
    return version;
  }

  async addLesson(actor: Actor, versionId: string, raw: z.input<typeof upsertLessonRequest>) {
    requireAdmin(actor);
    const input = upsertLessonRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const version = await this.draftVersion(tx, versionId);
      const [period] = await tx.select().from(periodDefinitions).where(eq(periodDefinitions.id, input.periodDefinitionId));
      if (!period || period.academicYearId !== version.academicYearId) throw errors.field('periodDefinitionId', 'Choose a period from this academic year');
      if (period.kind !== 'lesson') throw errors.field('periodDefinitionId', 'Lessons can only be placed in lesson periods');
      let teacherId = input.teacherId ?? null;
      if (!teacherId) {
        const [primary] = await tx
          .select({ teacherId: teacherAssignments.teacherId })
          .from(teacherAssignments)
          .where(and(eq(teacherAssignments.teachingGroupId, input.teachingGroupId), or(isNull(teacherAssignments.endDate), gte(teacherAssignments.endDate, today(actor)))))
          .orderBy(desc(teacherAssignments.isPrimary))
          .limit(1);
        teacherId = primary?.teacherId ?? null;
      }
      if (!teacherId) throw errors.field('teacherId', 'Assign a teacher to this group first, or choose one');
      await tx.insert(timetableLessons).values({
        schoolId: actor.schoolId,
        timetableVersionId: versionId,
        weekday: input.weekday,
        periodDefinitionId: input.periodDefinitionId,
        teachingGroupId: input.teachingGroupId,
        teacherId,
        roomId: input.roomId ?? null,
      });
      await tx.update(timetableVersions).set({ validation: null, version: sql`${timetableVersions.version} + 1` }).where(eq(timetableVersions.id, versionId));
    });
    return this.getVersion(actor, versionId);
  }

  async removeLesson(actor: Actor, lessonId: string) {
    requireAdmin(actor);
    const versionId = await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const [l] = await tx.select().from(timetableLessons).where(eq(timetableLessons.id, lessonId));
      const lesson = required(l, 'Lesson');
      await this.draftVersion(tx, lesson.timetableVersionId);
      await tx.delete(timetableLessons).where(eq(timetableLessons.id, lessonId));
      await tx.update(timetableVersions).set({ validation: null, version: sql`${timetableVersions.version} + 1` }).where(eq(timetableVersions.id, lesson.timetableVersionId));
      return lesson.timetableVersionId;
    });
    return this.getVersion(actor, versionId);
  }

  async validate(actor: Actor, versionId: string, date?: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const [v] = await tx.select().from(timetableVersions).where(eq(timetableVersions.id, versionId));
      const version = required(v, 'Timetable');
      const conflicts = await detectConflicts(tx, versionId, date ?? version.effectiveFrom ?? today(actor));
      await tx
        .update(timetableVersions)
        .set({ validation: { checkedAt: new Date().toISOString(), conflicts } })
        .where(eq(timetableVersions.id, versionId));
    });
    return this.getVersion(actor, versionId);
  }

  /**
   * Publishes an effective version. Conflicts are re-detected under the schedule lock, so a
   * concurrent membership change cannot slip a clash past validation.
   */
  async publish(actor: Actor, versionId: string, raw: z.input<typeof publishTimetableRequest>) {
    requireAdmin(actor);
    const input = publishTimetableRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const version = await this.draftVersion(tx, versionId);
      if (version.version !== input.version) throw errors.version();
      await assertYearWritable(tx, version.academicYearId);
      const conflicts = await detectConflicts(tx, versionId, input.effectiveFrom);
      if (conflicts.length) {
        await tx.update(timetableVersions).set({ validation: { checkedAt: new Date().toISOString(), conflicts } }).where(eq(timetableVersions.id, versionId));
        throw errors.rule('Resolve the timetable conflicts before publishing.', { conflicts });
      }
      const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(timetableLessons).where(eq(timetableLessons.timetableVersionId, versionId));
      if (n === 0) throw errors.rule('Add lessons before publishing.');

      // Earlier versions end where this one begins; versions that never took effect are superseded.
      const current = await tx
        .select()
        .from(timetableVersions)
        .where(and(eq(timetableVersions.academicYearId, version.academicYearId), eq(timetableVersions.status, 'published'), ne(timetableVersions.id, versionId)));
      for (const c of current) {
        if (c.effectiveFrom && c.effectiveFrom >= input.effectiveFrom) {
          await tx.update(timetableVersions).set({ status: 'superseded' }).where(eq(timetableVersions.id, c.id));
        } else if (!c.effectiveTo || c.effectiveTo > input.effectiveFrom) {
          await tx.update(timetableVersions).set({ effectiveTo: input.effectiveFrom }).where(eq(timetableVersions.id, c.id));
        }
      }
      await tx
        .update(timetableVersions)
        .set({
          status: 'published',
          effectiveFrom: input.effectiveFrom,
          publishedAt: new Date(),
          publishedByAccountId: actor.accountId,
          validation: { checkedAt: new Date().toISOString(), conflicts: [] },
          version: sql`${timetableVersions.version} + 1`,
        })
        .where(eq(timetableVersions.id, versionId));
      const recipients = await resolveAudience(tx, [{ target: 'role', role: 'teacher' }, { target: 'role', role: 'student' }], input.effectiveFrom);
      await this.comms.notify(tx, actor, {
        kind: 'timetable.published',
        data: { date: input.effectiveFrom },
        recipients,
        entityType: 'timetable_version',
        entityId: versionId,
        link: '/timetable',
        dedupeKey: `timetable:${versionId}`,
      });
      await audit(tx, actor, { action: 'timetable.published', entityType: 'timetable_version', entityId: versionId, summary: { effectiveFrom: input.effectiveFrom } });
    });
    return this.getVersion(actor, versionId);
  }

  async deleteDraft(actor: Actor, versionId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      await this.draftVersion(tx, versionId);
      await tx.delete(timetableVersions).where(eq(timetableVersions.id, versionId));
      await audit(tx, actor, { action: 'timetable.deleted', entityType: 'timetable_version', entityId: versionId });
    });
  }

  /* ---------------- Exceptions ---------------- */

  async createException(actor: Actor, raw: z.input<typeof createLessonExceptionRequest>) {
    requireAdmin(actor);
    const input = createLessonExceptionRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [l] = await tx.select().from(timetableLessons).where(eq(timetableLessons.id, input.timetableLessonId));
      const lessonRow = required(l, 'Lesson');
      if (isoWeekday(input.date) !== lessonRow.weekday) throw errors.field('date', 'The date falls on a different weekday than the lesson');
      if (input.substituteTeacherId === lessonRow.teacherId) throw errors.field('substituteTeacherId', 'Choose a different teacher');
      const [row] = await tx
        .insert(lessonExceptions)
        .values({
          schoolId: actor.schoolId,
          timetableLessonId: input.timetableLessonId,
          date: input.date,
          kind: input.kind,
          substituteTeacherId: input.substituteTeacherId ?? null,
          roomId: input.roomId ?? null,
          note: input.note ?? null,
          createdByAccountId: actor.accountId,
        })
        .returning();
      if (input.substituteTeacherId) {
        await this.comms.notify(tx, actor, {
          kind: 'timetable.published',
          data: { date: input.date },
          recipients: await teacherAccountIds(tx, [input.substituteTeacherId]),
          entityType: 'lesson_exception',
          entityId: row!.id,
          link: `/today?date=${input.date}`,
        });
      }
      await audit(tx, actor, { action: 'lesson_exception.created', entityType: 'timetable_lesson', entityId: input.timetableLessonId, summary: { date: input.date, kind: input.kind } });
      return row!;
    }).then((r) => this.exceptionsFor(actor, { ids: [r.id] }).then((x) => x[0]!));
  }

  async removeException(actor: Actor, exceptionId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx.delete(lessonExceptions).where(eq(lessonExceptions.id, exceptionId)).returning({ id: lessonExceptions.id });
      if (!rows.length) throw errors.notFound('Change');
      await audit(tx, actor, { action: 'lesson_exception.removed', entityType: 'lesson_exception', entityId: exceptionId });
    });
  }

  async exceptionsFor(actor: Actor, filter: { from?: string; to?: string; ids?: string[] }) {
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ e: lessonExceptions, name: accounts.displayName })
        .from(lessonExceptions)
        .leftJoin(teachers, eq(teachers.id, lessonExceptions.substituteTeacherId))
        .leftJoin(accounts, eq(accounts.id, teachers.accountId))
        .where(
          and(
            filter.ids ? inArray(lessonExceptions.id, filter.ids) : undefined,
            filter.from ? gte(lessonExceptions.date, filter.from) : undefined,
            filter.to ? lte(lessonExceptions.date, filter.to) : undefined,
          ),
        )
        .orderBy(asc(lessonExceptions.date));
      return rows.map(({ e, name }) => ({
        id: e.id,
        timetableLessonId: e.timetableLessonId,
        date: e.date,
        kind: e.kind,
        substituteTeacherId: e.substituteTeacherId,
        substituteTeacherName: name,
        roomId: e.roomId,
        note: e.note,
      }));
    });
  }

  /* ---------------- Views ---------------- */

  /** Weekly view of the timetable in effect on `date` for a student, teacher or section. */
  async week(actor: Actor, filter: { studentId?: string; teacherId?: string; sectionId?: string; date?: string }): Promise<WeekSchedule> {
    const date = filter.date ?? today(actor);
    let { studentId, teacherId } = filter;
    const { sectionId } = filter;
    if (!studentId && !teacherId && !sectionId) {
      studentId = actor.studentId ?? undefined;
      teacherId = studentId ? undefined : (actor.teacherId ?? undefined);
    }
    return this.run(actor, async (tx) => {
      if (studentId) await assertCanViewStudent(tx, actor, studentId);
      if (teacherId && !isAdmin(actor) && teacherId !== actor.teacherId) throw errors.forbidden();
      const version = await publishedVersionOn(tx, date);
      if (!version) return { versionId: null, effectiveFrom: null, periods: [], lessons: [] };
      const where = [eq(timetableLessons.timetableVersionId, version.id)];
      if (teacherId) where.push(eq(timetableLessons.teacherId, teacherId));
      if (studentId || sectionId) {
        const groupIds = await this.groupIdsFor(tx, { studentId, sectionId }, date);
        where.push(groupIds.length ? inArray(timetableLessons.teachingGroupId, groupIds) : sql`false`);
      }
      const periods = await tx.select().from(periodDefinitions).where(eq(periodDefinitions.academicYearId, version.academicYearId)).orderBy(asc(periodDefinitions.sequence));
      return {
        versionId: version.id,
        effectiveFrom: version.effectiveFrom,
        periods: periods.map((p) => this.toPeriod(p)),
        lessons: await this.lessonsFor(tx, where),
      };
    });
  }

  private async groupIdsFor(tx: Tx, f: { studentId?: string; sectionId?: string }, date: string) {
    if (f.studentId) {
      const rows = await tx
        .select({ id: teachingGroupMemberships.teachingGroupId })
        .from(teachingGroupMemberships)
        .where(and(eq(teachingGroupMemberships.studentId, f.studentId), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date)));
      return [...new Set(rows.map((r) => r.id))];
    }
    // Section view: its own groups plus class-wide groups its students attend.
    const rows = await tx.execute<{ id: string }>(sql`
      select g.id from app.teaching_groups g where g.section_id = ${f.sectionId}
      union
      select distinct m.teaching_group_id from app.teaching_group_memberships m
      join app.student_placements p on p.student_id = m.student_id and p.section_id = ${f.sectionId}
        and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})
      join app.teaching_groups g2 on g2.id = m.teaching_group_id and g2.section_id is null
      where m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date})`);
    return rows.map((r) => r.id);
  }

  /** One day for the signed-in teacher or student, with cancellations and substitutions applied. */
  async day(actor: Actor, date = today(actor)): Promise<DaySchedule> {
    return this.run(actor, async (tx) => {
      const [calendar] = await tx.select().from(schoolCalendarDays).where(eq(schoolCalendarDays.date, date));
      const instructional = await isInstructionalDay(tx, date);
      const version = await publishedVersionOn(tx, date);
      if (!version || !instructional) {
        return { date, instructional, calendarNote: calendar?.title ?? null, lessons: [] };
      }
      const weekday = isoWeekday(date);
      const base = [eq(timetableLessons.timetableVersionId, version.id), eq(timetableLessons.weekday, weekday)];
      let lessons: Lesson[] = [];
      const substituteFor: Set<string> = new Set();
      if (actor.studentId) {
        const groupIds = await this.groupIdsFor(tx, { studentId: actor.studentId }, date);
        lessons = groupIds.length ? await this.lessonsFor(tx, [...base, inArray(timetableLessons.teachingGroupId, groupIds)]) : [];
      } else if (actor.teacherId) {
        const subs = await tx
          .select({ lessonId: lessonExceptions.timetableLessonId })
          .from(lessonExceptions)
          .where(and(eq(lessonExceptions.date, date), eq(lessonExceptions.substituteTeacherId, actor.teacherId)));
        subs.forEach((s) => substituteFor.add(s.lessonId));
        lessons = await this.lessonsFor(tx, [
          ...base,
          subs.length ? or(eq(timetableLessons.teacherId, actor.teacherId), inArray(timetableLessons.id, [...substituteFor]))! : eq(timetableLessons.teacherId, actor.teacherId),
        ]);
      }
      const periods = new Map((await tx.select().from(periodDefinitions).where(eq(periodDefinitions.academicYearId, version.academicYearId))).map((p) => [p.id, p]));
      const exceptions = lessons.length
        ? await tx
            .select({ e: lessonExceptions, subName: accounts.displayName, roomName: rooms.name })
            .from(lessonExceptions)
            .leftJoin(teachers, eq(teachers.id, lessonExceptions.substituteTeacherId))
            .leftJoin(accounts, eq(accounts.id, teachers.accountId))
            .leftJoin(rooms, eq(rooms.id, lessonExceptions.roomId))
            .where(and(eq(lessonExceptions.date, date), inArray(lessonExceptions.timetableLessonId, lessons.map((l) => l.id))))
        : [];
      const result = lessons
        .map((l) => {
          const p = periods.get(l.periodId)!;
          const ex = exceptions.find((x) => x.e.timetableLessonId === l.id);
          const status = !ex ? 'scheduled' : ex.e.kind === 'cancelled' ? 'cancelled' : ex.e.kind === 'substitution' ? 'substituted' : 'room_changed';
          return {
            ...l,
            teacherId: ex?.e.substituteTeacherId ?? l.teacherId,
            teacherName: ex?.subName ?? l.teacherName,
            roomId: ex?.e.roomId ?? l.roomId,
            roomName: ex?.roomName ?? l.roomName,
            startTime: hhmm(p.startTime),
            endTime: hhmm(p.endTime),
            periodName: p.name,
            status: status as DaySchedule['lessons'][number]['status'],
            note: ex?.e.note ?? null,
            asSubstitute: substituteFor.has(l.id),
            sequence: p.sequence,
          };
        })
        // The regular teacher still sees a substituted lesson, marked "substituted".
        .sort((a, b) => a.sequence - b.sequence)
        .map(({ sequence: _s, ...rest }) => rest);
      return { date, instructional, calendarNote: calendar?.title ?? null, lessons: result };
    });
  }
}
