import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { EnrollmentSummary } from '@edventure/contracts';
import {
  changeSectionRequest,
  changeStreamRequest,
  endEnrollmentRequest,
  enrollStudentRequest,
  updateSubjectEnrollmentsRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  academicYears,
  classOfferings,
  courseOfferings,
  examCycles,
  examPapers,
  examRegistrations,
  gradeLevels,
  sections,
  streams,
  studentCourseEnrollments,
  studentEnrollments,
  studentPlacements,
  studentStreamAssignments,
  subjects,
  teachingGroupMemberships,
  teachingGroups,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { activeOn, requireAdmin, today } from '../../platform/scope';
import { assertYearWritable } from '../school/service';
import { assertNoPublishedStudentConflicts } from '../timetable/conflicts';

type CourseRow = typeof courseOfferings.$inferSelect;
type PlacementReason = 'admission' | 'transfer' | 'promotion' | 'repeat' | 'correction';

export interface EnrollInput {
  classOfferingId: string;
  sectionId: string;
  streamId?: string | null;
  startDate: string;
  reason?: PlacementReason;
  sourcePromotionDecisionId?: string | null;
}

/** Serializes schedule-affecting changes (timetables and memberships) within a school. */
export async function lockSchedule(tx: Tx, schoolId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`schedule:${schoolId}`}))`);
}

/**
 * Enrollment history is append-only in spirit: a section move closes the old placement and opens a
 * new one; stream and subject changes end rows on the effective date instead of editing them.
 */
export class EnrollmentService {
  constructor(private readonly db: Db) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /** Creates the enrollment, first placement, stream, subject enrollments and group memberships. */
  async enroll(tx: Tx, actor: Actor, studentId: string, input: EnrollInput) {
    const [co] = await tx.select().from(classOfferings).where(eq(classOfferings.id, input.classOfferingId));
    const classOffering = required(co, 'Class');
    await assertYearWritable(tx, classOffering.academicYearId);
    const [section] = await tx
      .select()
      .from(sections)
      .where(and(eq(sections.id, input.sectionId), eq(sections.classOfferingId, classOffering.id), isNull(sections.archivedAt)));
    if (!section) throw errors.field('sectionId', 'Choose a section of the selected class');
    const [year] = await tx.select().from(academicYears).where(eq(academicYears.id, classOffering.academicYearId));
    if (input.startDate < year!.startDate || input.startDate > year!.endDate) {
      throw errors.field('startDate', 'The start date must fall within the academic year');
    }

    const [enrollment] = await tx
      .insert(studentEnrollments)
      .values({
        schoolId: actor.schoolId,
        studentId,
        academicYearId: classOffering.academicYearId,
        classOfferingId: classOffering.id,
        startDate: input.startDate,
        sourcePromotionDecisionId: input.sourcePromotionDecisionId ?? null,
      })
      .returning();
    await tx.insert(studentPlacements).values({
      schoolId: actor.schoolId,
      enrollmentId: enrollment!.id,
      studentId,
      sectionId: section.id,
      startDate: input.startDate,
      reason: input.reason ?? 'admission',
      createdByAccountId: actor.client === 'system' ? null : actor.accountId,
    });
    if (input.streamId) {
      await tx.insert(studentStreamAssignments).values({
        schoolId: actor.schoolId,
        enrollmentId: enrollment!.id,
        streamId: input.streamId,
        startDate: input.startDate,
      });
    }
    const courses = await tx
      .select()
      .from(courseOfferings)
      .where(and(eq(courseOfferings.classOfferingId, classOffering.id), isNull(courseOfferings.archivedAt)));
    const defaults = courses.filter((c) => (c.streamId ? c.streamId === input.streamId : c.requirement === 'compulsory'));
    await this.addCourses(tx, actor, enrollment!.id, studentId, section.id, defaults, input.startDate);
    return enrollment!;
  }

  private async addCourses(tx: Tx, actor: Actor, enrollmentId: string, studentId: string, sectionId: string, courses: CourseRow[], startDate: string) {
    if (!courses.length) return;
    const inserted = await tx
      .insert(studentCourseEnrollments)
      .values(courses.map((c) => ({ schoolId: actor.schoolId, enrollmentId, studentId, courseOfferingId: c.id, startDate })))
      .returning();
    await this.joinGroups(tx, actor, studentId, sectionId, inserted, startDate);
  }

  /** Adds course enrollments to the matching teaching group of the section (or the single class-wide group). */
  private async joinGroups(
    tx: Tx,
    actor: Actor,
    studentId: string,
    sectionId: string,
    courseEnrollments: Array<typeof studentCourseEnrollments.$inferSelect>,
    startDate: string,
  ) {
    if (!courseEnrollments.length) return;
    const groups = await tx
      .select()
      .from(teachingGroups)
      .where(
        and(
          inArray(teachingGroups.courseOfferingId, courseEnrollments.map((c) => c.courseOfferingId)),
          isNull(teachingGroups.archivedAt),
        ),
      );
    const values = [];
    for (const ce of courseEnrollments) {
      const forCourse = groups.filter((g) => g.courseOfferingId === ce.courseOfferingId);
      const sectionGroups = forCourse.filter((g) => g.sectionId === sectionId);
      const classWide = forCourse.filter((g) => g.sectionId === null);
      const target = sectionGroups.length === 1 ? sectionGroups[0] : sectionGroups.length === 0 && classWide.length === 1 ? classWide[0] : null;
      if (target) {
        values.push({ schoolId: actor.schoolId, teachingGroupId: target.id, studentCourseEnrollmentId: ce.id, studentId, startDate });
      }
    }
    if (values.length) await tx.insert(teachingGroupMemberships).values(values);
  }

  /** New subject offered mid-year: enroll the class's active students (by stream for stream subjects). */
  async enrollClassInCourse(tx: Tx, actor: Actor, course: CourseRow, date: string) {
    if (!course.streamId && course.requirement !== 'compulsory') return;
    const rows = await tx.execute<{ enrollment_id: string; student_id: string }>(sql`
      select e.id as enrollment_id, e.student_id from app.student_enrollments e
      where e.class_offering_id = ${course.classOfferingId} and e.status = 'active'
      ${course.streamId ? sql`and exists (select 1 from app.student_stream_assignments sa where sa.enrollment_id = e.id and sa.stream_id = ${course.streamId}
          and sa.start_date <= ${date} and (sa.end_date is null or sa.end_date > ${date}))` : sql``}`);
    if (!rows.length) return;
    await tx.insert(studentCourseEnrollments).values(
      rows.map((r) => ({ schoolId: actor.schoolId, enrollmentId: r.enrollment_id, studentId: r.student_id, courseOfferingId: course.id, startDate: date })),
    );
  }

  /** Enrolls an existing student into a (new) academic year, e.g. a readmission. */
  async enrollExisting(actor: Actor, studentId: string, raw: z.input<typeof enrollStudentRequest>) {
    requireAdmin(actor);
    const input = enrollStudentRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const enrollment = await this.enroll(tx, actor, studentId, { ...input, reason: 'admission' });
      await audit(tx, actor, { action: 'student.enrolled', entityType: 'student', entityId: studentId, summary: { enrollmentId: enrollment.id } });
    });
    return this.history(actor, studentId);
  }

  async history(actor: Actor, studentId: string): Promise<EnrollmentSummary[]> {
    return this.run(actor, (tx) => this.enrollmentSummaries(tx, [studentId], null).then((m) => m.get(studentId) ?? []));
  }

  /** Enrollment summaries (with the placement current on `date`, or the latest one). */
  async enrollmentSummaries(tx: Tx, studentIds: string[], date: string | null) {
    const map = new Map<string, EnrollmentSummary[]>();
    if (!studentIds.length) return map;
    const rows = await tx
      .select({ e: studentEnrollments, y: academicYears, g: gradeLevels })
      .from(studentEnrollments)
      .innerJoin(academicYears, eq(academicYears.id, studentEnrollments.academicYearId))
      .innerJoin(classOfferings, eq(classOfferings.id, studentEnrollments.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .where(inArray(studentEnrollments.studentId, studentIds))
      .orderBy(desc(academicYears.startDate));
    const enrollmentIds = rows.map((r) => r.e.id);
    const placements = enrollmentIds.length
      ? await tx
          .select({ p: studentPlacements, sectionName: sections.name })
          .from(studentPlacements)
          .innerJoin(sections, eq(sections.id, studentPlacements.sectionId))
          .where(inArray(studentPlacements.enrollmentId, enrollmentIds))
          .orderBy(desc(studentPlacements.startDate))
      : [];
    const streamRows = enrollmentIds.length
      ? await tx
          .select({ s: studentStreamAssignments, name: streams.name })
          .from(studentStreamAssignments)
          .innerJoin(streams, eq(streams.id, studentStreamAssignments.streamId))
          .where(inArray(studentStreamAssignments.enrollmentId, enrollmentIds))
          .orderBy(desc(studentStreamAssignments.startDate))
      : [];
    const pick = <T extends { startDate: string; endDate: string | null }>(list: T[]) =>
      (date ? list.find((x) => x.startDate <= date && (x.endDate === null || x.endDate > date)) : undefined) ?? list[0];
    for (const { e, y, g } of rows) {
      const p = pick(placements.filter((x) => x.p.enrollmentId === e.id).map((x) => ({ ...x.p, sectionName: x.sectionName })));
      const s = pick(streamRows.filter((x) => x.s.enrollmentId === e.id).map((x) => ({ ...x.s, name: x.name })));
      const list = map.get(e.studentId) ?? [];
      list.push({
        id: e.id,
        academicYearId: y.id,
        academicYearCode: y.code,
        classOfferingId: e.classOfferingId,
        gradeLevelId: g.id,
        gradeName: g.name,
        sectionId: p?.sectionId ?? null,
        sectionName: p?.sectionName ?? null,
        streamId: s?.streamId ?? null,
        streamName: s?.name ?? null,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate,
      });
      map.set(e.studentId, list);
    }
    return map;
  }

  async placementHistory(actor: Actor, studentId: string) {
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ p: studentPlacements, sectionName: sections.name, gradeName: gradeLevels.name })
        .from(studentPlacements)
        .innerJoin(sections, eq(sections.id, studentPlacements.sectionId))
        .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(eq(studentPlacements.studentId, studentId))
        .orderBy(desc(studentPlacements.startDate));
      return rows.map(({ p, sectionName, gradeName }) => ({
        id: p.id,
        sectionId: p.sectionId,
        sectionName,
        gradeName,
        startDate: p.startDate,
        endDate: p.endDate,
        reason: p.reason,
        note: p.note,
      }));
    });
  }

  private async activeEnrollment(tx: Tx, studentId: string, date: string) {
    const [row] = await tx
      .select({ e: studentEnrollments, p: studentPlacements })
      .from(studentEnrollments)
      .innerJoin(studentPlacements, eq(studentPlacements.enrollmentId, studentEnrollments.id))
      .where(
        and(
          eq(studentEnrollments.studentId, studentId),
          eq(studentEnrollments.status, 'active'),
          or(isNull(studentPlacements.endDate), gt(studentPlacements.endDate, date)),
          lte(studentPlacements.startDate, date),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Effective-dated section transfer with group membership follow-through. */
  async changeSection(actor: Actor, studentId: string, raw: z.input<typeof changeSectionRequest>) {
    requireAdmin(actor);
    const input = changeSectionRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const current = await this.activeEnrollment(tx, studentId, input.effectiveDate);
      if (!current) throw errors.rule('The student has no active placement on the effective date.');
      await assertYearWritable(tx, current.e.academicYearId);
      if (current.p.sectionId === input.sectionId) throw errors.field('sectionId', 'The student is already in this section');
      if (current.p.startDate >= input.effectiveDate) {
        throw errors.field('effectiveDate', 'The move must take effect after the current placement started. Use a correction instead.');
      }
      const [target] = await tx
        .select()
        .from(sections)
        .where(and(eq(sections.id, input.sectionId), eq(sections.classOfferingId, current.e.classOfferingId), isNull(sections.archivedAt)));
      if (!target) throw errors.field('sectionId', 'Choose a section of the same class');

      await tx.update(studentPlacements).set({ endDate: input.effectiveDate }).where(eq(studentPlacements.id, current.p.id));
      await tx.insert(studentPlacements).values({
        schoolId: actor.schoolId,
        enrollmentId: current.e.id,
        studentId,
        sectionId: target.id,
        startDate: input.effectiveDate,
        reason: 'transfer',
        note: input.note ?? null,
        createdByAccountId: actor.accountId,
      });

      // Leave section-specific groups of the old section; join the equivalent groups of the new one.
      const oldGroups = await tx
        .select({ m: teachingGroupMemberships })
        .from(teachingGroupMemberships)
        .innerJoin(teachingGroups, eq(teachingGroups.id, teachingGroupMemberships.teachingGroupId))
        .where(
          and(
            eq(teachingGroupMemberships.studentId, studentId),
            eq(teachingGroups.sectionId, current.p.sectionId),
            activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, input.effectiveDate),
          ),
        );
      if (oldGroups.length) {
        await tx
          .update(teachingGroupMemberships)
          .set({ endDate: input.effectiveDate })
          .where(inArray(teachingGroupMemberships.id, oldGroups.map((g) => g.m.id)));
        const courseEnrollments = await tx
          .select()
          .from(studentCourseEnrollments)
          .where(inArray(studentCourseEnrollments.id, oldGroups.map((g) => g.m.studentCourseEnrollmentId)));
        await this.joinGroups(tx, actor, studentId, target.id, courseEnrollments, input.effectiveDate);
      }
      await assertNoPublishedStudentConflicts(tx, input.effectiveDate);
      await audit(tx, actor, {
        action: 'student.section_changed',
        entityType: 'student',
        entityId: studentId,
        summary: { from: current.p.sectionId, to: target.id, effectiveDate: input.effectiveDate },
      });
    });
  }

  /** Stream change with an impact preview; applying preserves previous subject history. */
  async changeStream(actor: Actor, studentId: string, raw: z.input<typeof changeStreamRequest>) {
    requireAdmin(actor);
    const input = changeStreamRequest.parse(raw);
    return this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const current = await this.activeEnrollment(tx, studentId, input.effectiveDate);
      if (!current) throw errors.rule('The student has no active enrollment on the effective date.');
      await assertYearWritable(tx, current.e.academicYearId);
      const [currentStream] = await tx
        .select()
        .from(studentStreamAssignments)
        .where(
          and(
            eq(studentStreamAssignments.enrollmentId, current.e.id),
            activeOn(studentStreamAssignments.startDate, studentStreamAssignments.endDate, input.effectiveDate),
          ),
        );
      if (currentStream?.streamId === input.streamId) throw errors.field('streamId', 'The student is already in this stream');

      const courses = await tx
        .select({ c: courseOfferings, subjectName: subjects.name })
        .from(courseOfferings)
        .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
        .where(and(eq(courseOfferings.classOfferingId, current.e.classOfferingId), isNull(courseOfferings.archivedAt)));
      const enrolled = await tx
        .select()
        .from(studentCourseEnrollments)
        .where(
          and(
            eq(studentCourseEnrollments.enrollmentId, current.e.id),
            eq(studentCourseEnrollments.status, 'active'),
            activeOn(studentCourseEnrollments.startDate, studentCourseEnrollments.endDate, input.effectiveDate),
          ),
        );
      const enrolledCourseIds = new Set(enrolled.map((e) => e.courseOfferingId));
      const drop = courses.filter((c) => c.c.streamId && c.c.streamId !== input.streamId && enrolledCourseIds.has(c.c.id));
      const add = courses.filter((c) => c.c.streamId === input.streamId && !enrolledCourseIds.has(c.c.id));

      const dropEnrollmentIds = enrolled.filter((e) => drop.some((d) => d.c.id === e.courseOfferingId)).map((e) => e.id);
      const leavingGroups = dropEnrollmentIds.length
        ? await tx
            .select({ id: teachingGroups.id, name: teachingGroups.name, membershipId: teachingGroupMemberships.id })
            .from(teachingGroupMemberships)
            .innerJoin(teachingGroups, eq(teachingGroups.id, teachingGroupMemberships.teachingGroupId))
            .where(
              and(
                inArray(teachingGroupMemberships.studentCourseEnrollmentId, dropEnrollmentIds),
                activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, input.effectiveDate),
              ),
            )
        : [];
      const joiningGroups = add.length
        ? await tx
            .select({ id: teachingGroups.id, name: teachingGroups.name })
            .from(teachingGroups)
            .where(
              and(
                inArray(teachingGroups.courseOfferingId, add.map((a) => a.c.id)),
                or(eq(teachingGroups.sectionId, current.p.sectionId), isNull(teachingGroups.sectionId)),
                isNull(teachingGroups.archivedAt),
              ),
            )
        : [];
      const upcomingPapers = drop.length
        ? await tx
            .select({ id: examPapers.id, courseOfferingId: examPapers.courseOfferingId })
            .from(examRegistrations)
            .innerJoin(examPapers, eq(examPapers.id, examRegistrations.examPaperId))
            .innerJoin(examCycles, eq(examCycles.id, examPapers.examCycleId))
            .where(
              and(
                eq(examRegistrations.studentId, studentId),
                inArray(examPapers.courseOfferingId, drop.map((d) => d.c.id)),
                inArray(examCycles.state, ['draft', 'scheduled', 'marking']),
              ),
            )
        : [];

      const preview = {
        addSubjects: add.map((a) => ({ courseOfferingId: a.c.id, subjectName: a.subjectName })),
        dropSubjects: drop.map((d) => ({ courseOfferingId: d.c.id, subjectName: d.subjectName })),
        affectedTeachingGroups: [
          ...leavingGroups.map((g) => ({ teachingGroupId: g.id, name: g.name, change: 'leave' as const })),
          ...joiningGroups.map((g) => ({ teachingGroupId: g.id, name: g.name, change: 'join' as const })),
        ],
        upcomingExamPapers: upcomingPapers.map((p) => ({
          examPaperId: p.id,
          subjectName: drop.find((d) => d.c.id === p.courseOfferingId)?.subjectName ?? '',
        })),
        applied: false,
      };
      if (!input.apply) return preview;

      if (currentStream) {
        if (currentStream.startDate >= input.effectiveDate) throw errors.field('effectiveDate', 'The change must take effect after the current stream started');
        await tx.update(studentStreamAssignments).set({ endDate: input.effectiveDate }).where(eq(studentStreamAssignments.id, currentStream.id));
      }
      await tx.insert(studentStreamAssignments).values({
        schoolId: actor.schoolId,
        enrollmentId: current.e.id,
        streamId: input.streamId,
        startDate: input.effectiveDate,
        note: input.note ?? null,
      });
      if (dropEnrollmentIds.length) {
        await tx
          .update(studentCourseEnrollments)
          .set({ endDate: input.effectiveDate, status: 'dropped' })
          .where(inArray(studentCourseEnrollments.id, dropEnrollmentIds));
      }
      if (leavingGroups.length) {
        await tx
          .update(teachingGroupMemberships)
          .set({ endDate: input.effectiveDate })
          .where(inArray(teachingGroupMemberships.id, leavingGroups.map((g) => g.membershipId)));
      }
      await this.addCourses(tx, actor, current.e.id, studentId, current.p.sectionId, add.map((a) => a.c), input.effectiveDate);
      await assertNoPublishedStudentConflicts(tx, input.effectiveDate);
      await audit(tx, actor, {
        action: 'student.stream_changed',
        entityType: 'student',
        entityId: studentId,
        summary: { from: currentStream?.streamId ?? null, to: input.streamId, effectiveDate: input.effectiveDate },
      });
      return { ...preview, applied: true };
    });
  }

  async subjectEnrollments(actor: Actor, studentId: string, date = today(actor)) {
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ ce: studentCourseEnrollments, c: courseOfferings, subjectName: subjects.name })
        .from(studentCourseEnrollments)
        .innerJoin(courseOfferings, eq(courseOfferings.id, studentCourseEnrollments.courseOfferingId))
        .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
        .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentCourseEnrollments.enrollmentId))
        .where(and(eq(studentCourseEnrollments.studentId, studentId), eq(studentEnrollments.status, 'active')))
        .orderBy(asc(subjects.name), desc(studentCourseEnrollments.startDate));
      const ids = rows.map((r) => r.ce.id);
      const groups = ids.length
        ? await tx
            .select({ ceId: teachingGroupMemberships.studentCourseEnrollmentId, id: teachingGroups.id, name: teachingGroups.name })
            .from(teachingGroupMemberships)
            .innerJoin(teachingGroups, eq(teachingGroups.id, teachingGroupMemberships.teachingGroupId))
            .where(
              and(
                inArray(teachingGroupMemberships.studentCourseEnrollmentId, ids),
                activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date),
              ),
            )
        : [];
      return rows.map(({ ce, c, subjectName }) => ({
        id: ce.id,
        courseOfferingId: c.id,
        subjectName,
        requirement: c.requirement,
        startDate: ce.startDate,
        endDate: ce.endDate,
        status: ce.status,
        teachingGroups: groups.filter((g) => g.ceId === ce.id).map((g) => ({ id: g.id, name: g.name })),
      }));
    });
  }

  /** Elective adds/drops. Dropped history is preserved with an end date. */
  async updateSubjectEnrollments(actor: Actor, studentId: string, raw: z.input<typeof updateSubjectEnrollmentsRequest>) {
    requireAdmin(actor);
    const input = updateSubjectEnrollmentsRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const current = await this.activeEnrollment(tx, studentId, input.effectiveDate);
      if (!current) throw errors.rule('The student has no active enrollment on the effective date.');
      await assertYearWritable(tx, current.e.academicYearId);
      if (input.drop.length) {
        const toDrop = await tx
          .select()
          .from(studentCourseEnrollments)
          .where(
            and(
              eq(studentCourseEnrollments.enrollmentId, current.e.id),
              inArray(studentCourseEnrollments.courseOfferingId, input.drop),
              activeOn(studentCourseEnrollments.startDate, studentCourseEnrollments.endDate, input.effectiveDate),
            ),
          );
        if (toDrop.length) {
          await tx
            .update(studentCourseEnrollments)
            .set({ endDate: input.effectiveDate, status: 'dropped' })
            .where(inArray(studentCourseEnrollments.id, toDrop.map((d) => d.id)));
          await tx
            .update(teachingGroupMemberships)
            .set({ endDate: input.effectiveDate })
            .where(
              and(
                inArray(teachingGroupMemberships.studentCourseEnrollmentId, toDrop.map((d) => d.id)),
                or(isNull(teachingGroupMemberships.endDate), gt(teachingGroupMemberships.endDate, input.effectiveDate)),
              ),
            );
        }
      }
      if (input.add.length) {
        const courses = await tx
          .select()
          .from(courseOfferings)
          .where(and(inArray(courseOfferings.id, input.add), eq(courseOfferings.classOfferingId, current.e.classOfferingId)));
        if (courses.length !== input.add.length) throw errors.field('add', 'A subject is not offered to this class');
        await this.addCourses(tx, actor, current.e.id, studentId, current.p.sectionId, courses, input.effectiveDate);
      }
      await assertNoPublishedStudentConflicts(tx, input.effectiveDate);
      await audit(tx, actor, {
        action: 'student.subjects_changed',
        entityType: 'student',
        entityId: studentId,
        summary: { add: input.add, drop: input.drop, effectiveDate: input.effectiveDate },
      });
    });
  }

  /** Withdrawal/transfer out: closes the enrollment on the date; fees and records remain. */
  async endEnrollment(actor: Actor, studentId: string, raw: z.input<typeof endEnrollmentRequest>) {
    requireAdmin(actor);
    const input = endEnrollmentRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [enrollment] = await tx
        .select()
        .from(studentEnrollments)
        .where(and(eq(studentEnrollments.studentId, studentId), eq(studentEnrollments.status, 'active')))
        .orderBy(desc(studentEnrollments.startDate))
        .limit(1);
      const e = required(enrollment, 'Active enrollment');
      await assertYearWritable(tx, e.academicYearId);
      if (input.endDate <= e.startDate) throw errors.field('endDate', 'The end date must be after the enrollment started');
      await this.closeEnrollmentRows(tx, e.id, input.endDate);
      await tx
        .update(studentEnrollments)
        .set({ status: input.status, endDate: input.endDate, statusReason: input.reason, version: sql`${studentEnrollments.version} + 1` })
        .where(eq(studentEnrollments.id, e.id));
      await audit(tx, actor, {
        action: `student.enrollment_${input.status}`,
        entityType: 'student',
        entityId: studentId,
        reason: input.reason,
        summary: { endDate: input.endDate },
      });
    });
  }

  /** Ends open placements, subject enrollments and memberships of an enrollment on `endDate`. */
  async closeEnrollmentRows(tx: Tx, enrollmentId: string, endDate: string) {
    const open = (end: typeof studentPlacements.endDate) => or(isNull(end), gt(end, endDate));
    await tx
      .update(studentPlacements)
      .set({ endDate })
      .where(and(eq(studentPlacements.enrollmentId, enrollmentId), open(studentPlacements.endDate), lt(studentPlacements.startDate, endDate)));
    await tx
      .update(studentStreamAssignments)
      .set({ endDate })
      .where(
        and(
          eq(studentStreamAssignments.enrollmentId, enrollmentId),
          or(isNull(studentStreamAssignments.endDate), gt(studentStreamAssignments.endDate, endDate)),
          lt(studentStreamAssignments.startDate, endDate),
        ),
      );
    const courseRows = await tx
      .update(studentCourseEnrollments)
      .set({ endDate })
      .where(
        and(
          eq(studentCourseEnrollments.enrollmentId, enrollmentId),
          or(isNull(studentCourseEnrollments.endDate), gt(studentCourseEnrollments.endDate, endDate)),
          lt(studentCourseEnrollments.startDate, endDate),
        ),
      )
      .returning({ id: studentCourseEnrollments.id });
    if (courseRows.length) {
      await tx
        .update(teachingGroupMemberships)
        .set({ endDate })
        .where(
          and(
            inArray(teachingGroupMemberships.studentCourseEnrollmentId, courseRows.map((c) => c.id)),
            or(isNull(teachingGroupMemberships.endDate), gt(teachingGroupMemberships.endDate, endDate)),
            lt(teachingGroupMemberships.startDate, endDate),
          ),
        );
    }
  }
}
