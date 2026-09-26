import { createHash } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { RollCall } from '@edventure/contracts';
import { correctAttendanceRequest, saveRollCallRequest, saveTeacherAttendanceRequest, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  attendanceReasonCodes,
  attendanceRevisions,
  attendanceRollCalls,
  classOfferings,
  disciplinarySuspensions,
  employmentRecords,
  gradeLevels,
  leaveRequests,
  schoolPolicies,
  sections,
  studentAttendance,
  studentEnrollments,
  studentPlacements,
  students,
  teacherAttendance,
  teachers,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { instructionalDays, isInstructionalDay } from '../../platform/calendar';
import { AppError, errors, required } from '../../platform/errors';
import { withIdempotency } from '../../platform/idempotency';
import { activeOn, assertCanViewStudent, classTeacherSectionIds, delegatedSectionIds, requireAdmin, today } from '../../platform/scope';
import { addCount, emptyCounts, summarize } from './calc';

type Status = 'present' | 'absent' | 'late' | 'excused';

export class AttendanceService {
  constructor(private readonly db: Db) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Roster ---------------- */

  private async roster(tx: Tx, sectionId: string, date: string) {
    return tx
      .select({
        studentId: students.id,
        displayName: accounts.displayName,
        displayNameUr: accounts.displayNameUr,
        admissionNumber: students.admissionNumber,
        placementId: studentPlacements.id,
        enrollmentId: studentPlacements.enrollmentId,
      })
      .from(studentPlacements)
      .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentPlacements.enrollmentId))
      .innerJoin(students, eq(students.id, studentPlacements.studentId))
      .innerJoin(accounts, eq(accounts.id, students.accountId))
      .where(
        and(
          eq(studentPlacements.sectionId, sectionId),
          activeOn(studentPlacements.startDate, studentPlacements.endDate, date),
          sql`(${studentEnrollments.status} = 'active' or (${studentEnrollments.endDate} is not null and ${studentEnrollments.endDate} > ${date}))`,
        ),
      )
      .orderBy(asc(accounts.displayName));
  }

  private revisionOf(roster: Array<{ studentId: string; placementId: string }>) {
    const key = roster
      .map((r) => `${r.studentId}:${r.placementId}`)
      .sort()
      .join('|');
    return createHash('sha256').update(key).digest('hex').slice(0, 24);
  }

  private async policy(tx: Tx) {
    const [p] = await tx.select({ attendance: schoolPolicies.attendance }).from(schoolPolicies).limit(1);
    return p?.attendance ?? { workingWeekdays: [1, 2, 3, 4, 5, 6], sameDayTeacherCorrection: true };
  }

  /** Roll-call authority: admin, the section's class teacher, or a delegated substitute on that date. */
  private async assertCanRecord(tx: Tx, actor: Actor, sectionId: string, date: string) {
    if (isAdmin(actor)) return { delegated: false };
    if (!actor.teacherId) throw errors.forbidden();
    const [own, delegated] = await Promise.all([classTeacherSectionIds(tx, actor.teacherId, date), delegatedSectionIds(tx, actor.teacherId, date)]);
    if (own.includes(sectionId)) return { delegated: false };
    if (delegated.includes(sectionId)) return { delegated: true };
    throw errors.forbidden('Only the class teacher or a delegated substitute can take this roll call');
  }

  async rollCallTasks(actor: Actor, date = today(actor)) {
    return this.run(actor, async (tx) => {
      if (!actor.teacherId) return [];
      const [own, delegated] = await Promise.all([classTeacherSectionIds(tx, actor.teacherId, date), delegatedSectionIds(tx, actor.teacherId, date)]);
      const ids = [...new Set([...own, ...delegated])];
      if (!ids.length || !(await isInstructionalDay(tx, date))) return [];
      const rows = await tx
        .select({ s: sections, grade: gradeLevels.name, rc: attendanceRollCalls })
        .from(sections)
        .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .leftJoin(attendanceRollCalls, and(eq(attendanceRollCalls.sectionId, sections.id), eq(attendanceRollCalls.date, date)))
        .where(inArray(sections.id, ids))
        .orderBy(asc(gradeLevels.sortOrder), asc(sections.code));
      return rows.map(({ s, grade, rc }) => ({
        sectionId: s.id,
        sectionName: s.name,
        gradeName: grade,
        date,
        state: (rc?.state ?? 'not_started') as 'not_started' | 'draft' | 'submitted',
        delegated: !own.includes(s.id),
      }));
    });
  }

  async getRollCall(actor: Actor, sectionId: string, date: string): Promise<RollCall> {
    return this.run(actor, async (tx) => {
      await this.assertCanRecord(tx, actor, sectionId, date);
      return this.loadRollCall(tx, actor, sectionId, date);
    });
  }

  private async loadRollCall(tx: Tx, actor: Actor, sectionId: string, date: string): Promise<RollCall> {
    const [section] = await tx
      .select({ s: sections, grade: gradeLevels.name })
      .from(sections)
      .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .where(eq(sections.id, sectionId));
    const found = required(section, 'Section');
    const roster = await this.roster(tx, sectionId, date);
    const ids = roster.map((r) => r.studentId);
    const [rc] = await tx.select().from(attendanceRollCalls).where(and(eq(attendanceRollCalls.sectionId, sectionId), eq(attendanceRollCalls.date, date)));
    const records = ids.length ? await tx.select().from(studentAttendance).where(and(inArray(studentAttendance.studentId, ids), eq(studentAttendance.date, date))) : [];
    const leave = ids.length
      ? await tx
          .select({ studentId: leaveRequests.studentId })
          .from(leaveRequests)
          .where(and(inArray(leaveRequests.studentId, ids), eq(leaveRequests.state, 'approved'), lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date)))
      : [];
    const suspended = ids.length
      ? await tx
          .select({ studentId: disciplinarySuspensions.studentId })
          .from(disciplinarySuspensions)
          .where(and(inArray(disciplinarySuspensions.studentId, ids), isNull(disciplinarySuspensions.revokedAt), lte(disciplinarySuspensions.startDate, date), gte(disciplinarySuspensions.endDate, date)))
      : [];
    const submittedBy = rc?.submittedByAccountId
      ? (await tx.select({ name: accounts.displayName }).from(accounts).where(eq(accounts.id, rc.submittedByAccountId)))[0]?.name ?? null
      : null;
    const policy = await this.policy(tx);
    const todayDate = today(actor);
    const submitted = rc?.state === 'submitted';
    const teacherMayEdit = date === todayDate && (!submitted || policy.sameDayTeacherCorrection);
    const draft = new Map((rc?.state === 'draft' ? rc.draftEntries ?? [] : []).map((d) => [d.studentId, d]));
    const reasons = await tx.select().from(attendanceReasonCodes).where(isNull(attendanceReasonCodes.archivedAt)).orderBy(asc(attendanceReasonCodes.label));
    return {
      sectionId,
      sectionName: found.s.name,
      gradeName: found.grade,
      date,
      instructional: await isInstructionalDay(tx, date),
      state: rc?.state ?? 'not_started',
      version: rc?.version ?? null,
      rosterRevision: this.revisionOf(roster),
      submittedAt: rc?.submittedAt?.toISOString() ?? null,
      submittedBy,
      canEdit: isAdmin(actor) || teacherMayEdit,
      correctionRequiresReason: submitted && (isAdmin(actor) ? date !== todayDate : true),
      entries: roster.map((r) => {
        const rec = records.find((x) => x.studentId === r.studentId);
        const d = draft.get(r.studentId);
        const onLeave = leave.some((l) => l.studentId === r.studentId);
        return {
          studentId: r.studentId,
          displayName: r.displayName,
          displayNameUr: r.displayNameUr,
          admissionNumber: r.admissionNumber,
          status: ((d?.status as Status | undefined) ?? rec?.status ?? (onLeave ? 'excused' : null)) as Status | null,
          reasonCodeId: d?.reasonCodeId ?? rec?.reasonCodeId ?? null,
          note: d?.note ?? rec?.note ?? null,
          onLeave,
          suspended: suspended.some((s) => s.studentId === r.studentId),
          recordVersion: rec?.version ?? null,
        };
      }),
      reasonCodes: reasons.map((x) => ({ id: x.id, code: x.code, label: x.label, labelUr: x.labelUr, appliesTo: x.appliesTo })),
    };
  }

  /**
   * Saves a draft or submits the roll call. Submission requires a complete, current roster;
   * a stale roster (the class list changed) returns 409 so the teacher reviews the new list.
   */
  async saveRollCall(actor: Actor, sectionId: string, date: string, raw: z.input<typeof saveRollCallRequest>, idempotencyKey?: string) {
    const input = saveRollCallRequest.parse(raw);
    return this.run(actor, async (tx) =>
      (
        await withIdempotency(tx, actor, `rollcall:${sectionId}:${date}`, idempotencyKey, input, async () => {
          const authority = await this.assertCanRecord(tx, actor, sectionId, date);
          const todayDate = today(actor);
          if (date > todayDate) throw errors.rule('Attendance cannot be recorded for a future date.');
          if (!isAdmin(actor) && date !== todayDate) throw errors.forbidden('Teachers record attendance for today only. Ask an administrator to correct past days.');
          if (!(await isInstructionalDay(tx, date))) throw errors.rule('This is not an instructional day.');
          // Serialize concurrent saves of the same roll call.
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rollcall:${sectionId}:${date}`}))`);

          const roster = await this.roster(tx, sectionId, date);
          const revision = this.revisionOf(roster);
          if (revision !== input.rosterRevision) {
            throw new AppError('conflict', 'The class list changed since you started. Review the updated list before saving.', {
              details: { reason: 'roster_changed', rosterRevision: revision },
            });
          }
          const [existing] = await tx
            .select()
            .from(attendanceRollCalls)
            .where(and(eq(attendanceRollCalls.sectionId, sectionId), eq(attendanceRollCalls.date, date)))
            .for('update');
          if ((existing?.version ?? null) !== input.version) throw errors.version();

          const rosterIds = new Set(roster.map((r) => r.studentId));
          const unknown = input.entries.filter((e) => !rosterIds.has(e.studentId));
          if (unknown.length) throw errors.rule('Some students are not in this section on this date.');

          const submitted = existing?.state === 'submitted';
          const policy = await this.policy(tx);
          if (submitted && !isAdmin(actor) && !policy.sameDayTeacherCorrection) throw errors.forbidden('Corrections after submission need an administrator.');
          const isCorrection = submitted;
          if (isCorrection && isAdmin(actor) && date !== todayDate && !input.correctionReason) {
            throw errors.field('correctionReason', 'Give a reason for correcting a past roll call');
          }

          if (!input.submit) {
            if (submitted) throw errors.rule('This roll call is already submitted. Submit corrections instead of saving a draft.');
            const values = {
              state: 'draft' as const,
              rosterRevision: revision,
              draftEntries: input.entries.map((e) => ({ studentId: e.studentId, status: e.status, reasonCodeId: e.reasonCodeId ?? null, note: e.note ?? null })),
              version: (existing?.version ?? 0) + 1,
            };
            if (existing) await tx.update(attendanceRollCalls).set(values).where(eq(attendanceRollCalls.id, existing.id));
            else await tx.insert(attendanceRollCalls).values({ schoolId: actor.schoolId, sectionId, date, ...values });
            return { status: 200, body: await this.loadRollCall(tx, actor, sectionId, date) };
          }

          if (input.entries.length !== roster.length) throw errors.rule('Record a status for every student before submitting.');
          let rollCallId = existing?.id;
          if (existing) {
            await tx
              .update(attendanceRollCalls)
              .set({ state: 'submitted', rosterRevision: revision, draftEntries: null, submittedAt: new Date(), submittedByAccountId: actor.accountId, version: existing.version + 1 })
              .where(eq(attendanceRollCalls.id, existing.id));
          } else {
            const [rc] = await tx
              .insert(attendanceRollCalls)
              .values({ schoolId: actor.schoolId, sectionId, date, state: 'submitted', rosterRevision: revision, submittedAt: new Date(), submittedByAccountId: actor.accountId })
              .returning();
            rollCallId = rc!.id;
          }

          const current = await tx.select().from(studentAttendance).where(and(inArray(studentAttendance.studentId, [...rosterIds]), eq(studentAttendance.date, date)));
          let changed = 0;
          for (const entry of input.entries) {
            const r = roster.find((x) => x.studentId === entry.studentId)!;
            const prev = current.find((c) => c.studentId === entry.studentId);
            if (!prev) {
              await tx.insert(studentAttendance).values({
                schoolId: actor.schoolId,
                studentId: entry.studentId,
                enrollmentId: r.enrollmentId,
                placementId: r.placementId,
                sectionId,
                rollCallId: rollCallId!,
                date,
                status: entry.status,
                reasonCodeId: entry.reasonCodeId ?? null,
                note: entry.note ?? null,
                source: 'roll_call',
                recordedByAccountId: actor.accountId,
              });
              continue;
            }
            if (prev.status === entry.status && (prev.reasonCodeId ?? null) === (entry.reasonCodeId ?? null) && (prev.note ?? null) === (entry.note ?? null)) continue;
            changed++;
            await tx
              .update(studentAttendance)
              .set({
                status: entry.status,
                reasonCodeId: entry.reasonCodeId ?? null,
                note: entry.note ?? null,
                rollCallId: rollCallId!,
                // Once the teacher confirms a leave-proposed day it becomes a roll-call record.
                source: prev.source === 'leave' && entry.status === prev.status ? 'leave' : 'roll_call',
                recordedByAccountId: actor.accountId,
                recordedAt: new Date(),
                version: prev.version + 1,
              })
              .where(eq(studentAttendance.id, prev.id));
            await tx.insert(attendanceRevisions).values({
              schoolId: actor.schoolId,
              studentAttendanceId: prev.id,
              previousStatus: prev.status,
              newStatus: entry.status,
              reason: input.correctionReason ?? (isCorrection ? 'Same-day correction' : 'Roll call replaced a leave proposal'),
              changedByAccountId: actor.accountId,
            });
          }
          await audit(tx, actor, {
            action: isCorrection ? 'attendance.roll_call_corrected' : 'attendance.roll_call_submitted',
            entityType: 'section',
            entityId: sectionId,
            reason: input.correctionReason ?? null,
            summary: { date, students: input.entries.length, changed, delegated: authority.delegated },
          });
          return { status: 200, body: await this.loadRollCall(tx, actor, sectionId, date) };
        })
      ).body,
    );
  }

  /** Administrator correction of a single past record, with a mandatory reason. */
  async correct(actor: Actor, raw: z.input<typeof correctAttendanceRequest>) {
    requireAdmin(actor);
    const input = correctAttendanceRequest.parse(raw);
    await this.run(actor, async (tx) => {
      if (input.date > today(actor)) throw errors.rule('Attendance cannot be recorded for a future date.');
      const [prev] = await tx.select().from(studentAttendance).where(and(eq(studentAttendance.studentId, input.studentId), eq(studentAttendance.date, input.date))).for('update');
      if (prev) {
        await tx
          .update(studentAttendance)
          .set({ status: input.status, reasonCodeId: input.reasonCodeId ?? null, note: input.note ?? null, source: 'admin_correction', recordedByAccountId: actor.accountId, recordedAt: new Date(), version: prev.version + 1 })
          .where(eq(studentAttendance.id, prev.id));
        await tx.insert(attendanceRevisions).values({
          schoolId: actor.schoolId,
          studentAttendanceId: prev.id,
          previousStatus: prev.status,
          newStatus: input.status,
          reason: input.reason,
          changedByAccountId: actor.accountId,
        });
      } else {
        const [placement] = await tx
          .select()
          .from(studentPlacements)
          .where(and(eq(studentPlacements.studentId, input.studentId), activeOn(studentPlacements.startDate, studentPlacements.endDate, input.date)));
        if (!placement) throw errors.rule('The student was not placed in a section on that date.');
        const [row] = await tx
          .insert(studentAttendance)
          .values({
            schoolId: actor.schoolId,
            studentId: input.studentId,
            enrollmentId: placement.enrollmentId,
            placementId: placement.id,
            sectionId: placement.sectionId,
            date: input.date,
            status: input.status,
            reasonCodeId: input.reasonCodeId ?? null,
            note: input.note ?? null,
            source: 'admin_correction',
            recordedByAccountId: actor.accountId,
          })
          .returning();
        await tx.insert(attendanceRevisions).values({
          schoolId: actor.schoolId,
          studentAttendanceId: row!.id,
          previousStatus: null,
          newStatus: input.status,
          reason: input.reason,
          changedByAccountId: actor.accountId,
        });
      }
      await audit(tx, actor, { action: 'attendance.corrected', entityType: 'student', entityId: input.studentId, reason: input.reason, summary: { date: input.date, status: input.status } });
    });
  }

  /* ---------------- Teacher attendance (administrators) ---------------- */

  async teacherDay(actor: Actor, date: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ t: teachers, name: accounts.displayName })
        .from(teachers)
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .innerJoin(employmentRecords, eq(employmentRecords.teacherId, teachers.id))
        .where(and(activeOn(employmentRecords.startDate, employmentRecords.endDate, date), sql`${accounts.status} <> 'pending_deletion'`))
        .orderBy(asc(accounts.displayName));
      const ids = rows.map((r) => r.t.id);
      const records = ids.length ? await tx.select().from(teacherAttendance).where(and(inArray(teacherAttendance.teacherId, ids), eq(teacherAttendance.date, date))) : [];
      const leave = ids.length
        ? await tx
            .select({ teacherId: leaveRequests.teacherId })
            .from(leaveRequests)
            .where(and(inArray(leaveRequests.teacherId, ids), eq(leaveRequests.state, 'approved'), lte(leaveRequests.startDate, date), gte(leaveRequests.endDate, date)))
        : [];
      return {
        date,
        instructional: await isInstructionalDay(tx, date),
        entries: rows.map(({ t, name }) => {
          const rec = records.find((r) => r.teacherId === t.id);
          const onLeave = leave.some((l) => l.teacherId === t.id);
          return {
            teacherId: t.id,
            displayName: name,
            employeeNumber: t.employeeNumber,
            status: (rec?.status ?? (onLeave ? 'excused' : null)) as Status | null,
            reasonCodeId: rec?.reasonCodeId ?? null,
            note: rec?.note ?? null,
            onLeave,
            recordVersion: rec?.version ?? null,
          };
        }),
      };
    });
  }

  async saveTeacherDay(actor: Actor, raw: z.input<typeof saveTeacherAttendanceRequest>) {
    requireAdmin(actor);
    const input = saveTeacherAttendanceRequest.parse(raw);
    await this.run(actor, async (tx) => {
      if (input.date > today(actor)) throw errors.rule('Attendance cannot be recorded for a future date.');
      const ids = input.entries.map((e) => e.teacherId);
      const current = ids.length ? await tx.select().from(teacherAttendance).where(and(inArray(teacherAttendance.teacherId, ids), eq(teacherAttendance.date, input.date))).for('update') : [];
      for (const e of input.entries) {
        const prev = current.find((c) => c.teacherId === e.teacherId);
        if (!prev) {
          await tx.insert(teacherAttendance).values({
            schoolId: actor.schoolId,
            teacherId: e.teacherId,
            date: input.date,
            status: e.status,
            reasonCodeId: e.reasonCodeId ?? null,
            note: e.note ?? null,
            recordedByAccountId: actor.accountId,
          });
          continue;
        }
        if (e.recordVersion !== undefined && e.recordVersion !== null && e.recordVersion !== prev.version) throw errors.version();
        if (prev.status === e.status && (prev.note ?? null) === (e.note ?? null) && (prev.reasonCodeId ?? null) === (e.reasonCodeId ?? null)) continue;
        if (!input.correctionReason && input.date !== today(actor)) throw errors.field('correctionReason', 'Give a reason for correcting a past day');
        await tx
          .update(teacherAttendance)
          .set({ status: e.status, reasonCodeId: e.reasonCodeId ?? null, note: e.note ?? null, source: 'admin_correction', recordedByAccountId: actor.accountId, recordedAt: new Date(), version: prev.version + 1 })
          .where(eq(teacherAttendance.id, prev.id));
        await tx.insert(attendanceRevisions).values({
          schoolId: actor.schoolId,
          teacherAttendanceId: prev.id,
          previousStatus: prev.status,
          newStatus: e.status,
          reason: input.correctionReason ?? 'Same-day update',
          changedByAccountId: actor.accountId,
        });
      }
      await audit(tx, actor, { action: 'attendance.teachers_recorded', entityType: 'school', entityId: actor.schoolId, summary: { date: input.date, teachers: input.entries.length } });
    });
    return this.teacherDay(actor, input.date);
  }

  /* ---------------- Statistics ---------------- */

  /** Expected days for a student = instructional days while enrolled (placed) within the range. */
  private async expectedDaysFor(tx: Tx, studentIds: string[], from: string, to: string, days: string[]) {
    const placements = studentIds.length
      ? await tx
          .select({ studentId: studentPlacements.studentId, start: studentPlacements.startDate, end: studentPlacements.endDate })
          .from(studentPlacements)
          .where(and(inArray(studentPlacements.studentId, studentIds), lte(studentPlacements.startDate, to), sql`(${studentPlacements.endDate} is null or ${studentPlacements.endDate} > ${from})`))
      : [];
    const map = new Map<string, number>();
    for (const id of studentIds) {
      const mine = placements.filter((p) => p.studentId === id);
      map.set(id, days.filter((d) => mine.some((p) => p.start <= d && (p.end === null || p.end > d))).length);
    }
    return map;
  }

  async studentReport(actor: Actor, studentId: string, from: string, to: string) {
    if (to < from) throw errors.field('to', 'End date must be after the start date');
    return this.run(actor, async (tx) => {
      await assertCanViewStudent(tx, actor, studentId);
      const [s] = await tx.select({ name: accounts.displayName }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(eq(students.id, studentId));
      const effectiveTo = to > today(actor) ? today(actor) : to;
      const days = await instructionalDays(tx, from, effectiveTo);
      const records = await tx
        .select()
        .from(studentAttendance)
        .where(and(eq(studentAttendance.studentId, studentId), gte(studentAttendance.date, from), lte(studentAttendance.date, to)))
        .orderBy(asc(studentAttendance.date));
      const counts = emptyCounts();
      records.forEach((r) => addCount(counts, r.status));
      const expected = (await this.expectedDaysFor(tx, [studentId], from, effectiveTo, days)).get(studentId) ?? 0;
      return {
        studentId,
        displayName: required(s, 'Student').name,
        from,
        to,
        summary: summarize(counts, expected),
        days: records.map((r) => ({ date: r.date, status: r.status, note: r.note })),
      };
    });
  }

  async sectionReport(actor: Actor, sectionId: string, from: string, to: string) {
    if (to < from) throw errors.field('to', 'End date must be after the start date');
    return this.run(actor, async (tx) => {
      if (!isAdmin(actor)) {
        if (!actor.teacherId) throw errors.forbidden();
        const own = await classTeacherSectionIds(tx, actor.teacherId, today(actor));
        if (!own.includes(sectionId)) throw errors.forbidden('Only the class teacher can view this section’s statistics');
      }
      const [section] = await tx.select({ name: sections.name, grade: gradeLevels.name }).from(sections)
        .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(eq(sections.id, sectionId));
      const effectiveTo = to > today(actor) ? today(actor) : to;
      const days = await instructionalDays(tx, from, effectiveTo);
      const members = await tx.execute<{ student_id: string; display_name: string; admission_number: string }>(sql`
        select distinct s.id as student_id, a.display_name, s.admission_number from app.student_placements p
        join app.students s on s.id = p.student_id join app.accounts a on a.id = s.account_id
        where p.section_id = ${sectionId} and p.start_date <= ${effectiveTo} and (p.end_date is null or p.end_date > ${from})
        order by a.display_name`);
      const ids = members.map((m) => m.student_id);
      const records = ids.length
        ? await tx
            .select({ studentId: studentAttendance.studentId, status: studentAttendance.status })
            .from(studentAttendance)
            .where(and(eq(studentAttendance.sectionId, sectionId), gte(studentAttendance.date, from), lte(studentAttendance.date, to)))
        : [];
      const expected = await this.expectedDaysFor(tx, ids, from, effectiveTo, days);
      const overall = emptyCounts();
      let overallExpected = 0;
      const studentsOut = members.map((m) => {
        const c = emptyCounts();
        records.filter((r) => r.studentId === m.student_id).forEach((r) => addCount(c, r.status));
        (Object.keys(c) as Array<keyof typeof c>).forEach((k) => (overall[k] += c[k]));
        const e = expected.get(m.student_id) ?? 0;
        overallExpected += e;
        return { studentId: m.student_id, displayName: m.display_name, admissionNumber: m.admission_number, summary: summarize(c, e) };
      });
      const [{ n } = { n: 0 }] = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from app.attendance_roll_calls where section_id = ${sectionId} and state = 'submitted' and date between ${from} and ${to}`);
      return {
        sectionId,
        sectionName: section ? `${section.grade} ${section.name}` : 'Section',
        from,
        to,
        overall: summarize(overall, overallExpected),
        rollCallsSubmitted: n,
        instructionalDays: days.length,
        students: studentsOut,
      };
    });
  }

  /** School-wide daily overview for administrators. */
  async dailyOverview(actor: Actor, date: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const instructional = await isInstructionalDay(tx, date);
      const rows = await tx.execute<{
        section_id: string;
        section_name: string;
        grade_name: string;
        state: string | null;
        roster: number;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }>(sql`
        select s.id as section_id, s.name as section_name, g.name as grade_name, rc.state,
          (select count(*)::int from app.student_placements p join app.student_enrollments e on e.id = p.enrollment_id and e.status = 'active'
             where p.section_id = s.id and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})) as roster,
          count(*) filter (where a.status = 'present')::int as present,
          count(*) filter (where a.status = 'absent')::int as absent,
          count(*) filter (where a.status = 'late')::int as late,
          count(*) filter (where a.status = 'excused')::int as excused
        from app.sections s
        join app.class_offerings co on co.id = s.class_offering_id
        join app.academic_years y on y.id = co.academic_year_id and y.status = 'active'
        join app.grade_levels g on g.id = co.grade_level_id
        left join app.attendance_roll_calls rc on rc.section_id = s.id and rc.date = ${date}
        left join app.student_attendance a on a.section_id = s.id and a.date = ${date}
        where s.archived_at is null
        group by s.id, s.name, g.name, g.sort_order, s.code, rc.state
        order by g.sort_order, s.code`);
      const overall = emptyCounts();
      let expected = 0;
      for (const r of rows) {
        overall.present += r.present;
        overall.absent += r.absent;
        overall.late += r.late;
        overall.excused += r.excused;
        expected += instructional ? r.roster : 0;
      }
      const [t] = await tx.execute<{ present: number; absent: number; late: number; excused: number }>(sql`
        select count(*) filter (where status = 'present')::int as present, count(*) filter (where status = 'absent')::int as absent,
               count(*) filter (where status = 'late')::int as late, count(*) filter (where status = 'excused')::int as excused
        from app.teacher_attendance where date = ${date}`);
      const [activeTeachers] = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from app.employment_records where start_date <= ${date} and (end_date is null or end_date > ${date})`);
      return {
        date,
        instructional,
        overall: summarize(overall, expected),
        sections: rows.map((r) => ({
          sectionId: r.section_id,
          sectionName: r.section_name,
          gradeName: r.grade_name,
          state: (r.state ?? 'not_started') as 'not_started' | 'draft' | 'submitted',
          present: r.present,
          absent: r.absent,
          late: r.late,
          excused: r.excused,
          rosterSize: r.roster,
        })),
        teachers: summarize(t ?? emptyCounts(), instructional ? (activeTeachers?.n ?? 0) : 0),
      };
    });
  }
}
