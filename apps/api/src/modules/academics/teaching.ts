import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import type { TeachingGroup } from '@edventure/contracts';
import {
  assignClassTeacherRequest,
  assignTeacherRequest,
  createDelegationRequest,
  createTeachingGroupRequest,
  updateGroupMembersRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  attendanceDelegations,
  classOfferings,
  classTeacherAssignments,
  courseOfferings,
  gradeLevels,
  periodDefinitions,
  sections,
  studentCourseEnrollments,
  studentEnrollments,
  studentPlacements,
  students,
  subjects,
  teacherAssignments,
  teachers,
  teachingGroupMemberships,
  teachingGroups,
  timetableLessons,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { activeOn, requireAdmin, teacherGroupIds, today } from '../../platform/scope';
import { assertYearWritable } from '../school/service';
import { assertNoPublishedStudentConflicts, publishedVersionOn } from '../timetable/conflicts';
import { lockSchedule } from './enrollment';

export class TeachingService {
  constructor(private readonly db: Db) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Teaching groups ---------------- */

  async listGroups(
    actor: Actor,
    filter: { classOfferingId?: string; sectionId?: string; teacherId?: string; academicYearId?: string; mine?: boolean },
  ): Promise<TeachingGroup[]> {
    return this.run(actor, async (tx) => {
      const date = today(actor);
      let restrictTo: string[] | null = null;
      if (filter.mine || !isAdmin(actor)) {
        if (!actor.teacherId) throw errors.forbidden();
        restrictTo = await teacherGroupIds(tx, actor.teacherId, date);
        if (!restrictTo.length) return [];
      }
      if (filter.teacherId) {
        const ids = await teacherGroupIds(tx, filter.teacherId, date);
        restrictTo = restrictTo ? restrictTo.filter((i) => ids.includes(i)) : ids;
        if (!restrictTo.length) return [];
      }
      return this.loadGroups(tx, date, {
        ids: restrictTo ?? undefined,
        classOfferingId: filter.classOfferingId,
        sectionId: filter.sectionId,
        academicYearId: filter.academicYearId,
      });
    });
  }

  async getGroup(actor: Actor, groupId: string) {
    return this.run(actor, async (tx) => {
      const date = today(actor);
      if (!isAdmin(actor)) {
        const mine = actor.teacherId ? await teacherGroupIds(tx, actor.teacherId, date) : [];
        if (!mine.includes(groupId)) throw errors.forbidden();
      }
      const [group] = await this.loadGroups(tx, date, { ids: [groupId] });
      return required(group, 'Teaching group');
    });
  }

  async loadGroups(tx: Tx, date: string, f: { ids?: string[]; classOfferingId?: string; sectionId?: string; academicYearId?: string }) {
    const rows = await tx
      .select({ g: teachingGroups, c: courseOfferings, s: subjects, sec: sections, grade: gradeLevels, co: classOfferings })
      .from(teachingGroups)
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .innerJoin(classOfferings, eq(classOfferings.id, courseOfferings.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .leftJoin(sections, eq(sections.id, teachingGroups.sectionId))
      .where(
        and(
          f.ids ? inArray(teachingGroups.id, f.ids) : undefined,
          f.classOfferingId ? eq(courseOfferings.classOfferingId, f.classOfferingId) : undefined,
          f.sectionId ? eq(teachingGroups.sectionId, f.sectionId) : undefined,
          f.academicYearId ? eq(classOfferings.academicYearId, f.academicYearId) : undefined,
        ),
      )
      .orderBy(asc(gradeLevels.sortOrder), asc(sections.code), asc(subjects.name));
    const ids = rows.map((r) => r.g.id);
    if (!ids.length) return [];
    const [members, staff] = await Promise.all([
      tx
        .select({ groupId: teachingGroupMemberships.teachingGroupId, n: count() })
        .from(teachingGroupMemberships)
        .where(and(inArray(teachingGroupMemberships.teachingGroupId, ids), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date)))
        .groupBy(teachingGroupMemberships.teachingGroupId),
      tx
        .select({ a: teacherAssignments, name: accounts.displayName })
        .from(teacherAssignments)
        .innerJoin(teachers, eq(teachers.id, teacherAssignments.teacherId))
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .where(and(inArray(teacherAssignments.teachingGroupId, ids), activeOn(teacherAssignments.startDate, teacherAssignments.endDate, date))),
    ]);
    const countBy = new Map(members.map((m) => [m.groupId, m.n]));
    return rows.map(({ g, c, s, sec, grade }) => ({
      id: g.id,
      courseOfferingId: c.id,
      subjectName: s.name,
      subjectNameUr: s.nameUr,
      classOfferingId: c.classOfferingId,
      gradeName: grade.name,
      sectionId: sec?.id ?? null,
      sectionName: sec?.name ?? null,
      code: g.code,
      name: g.name,
      memberCount: countBy.get(g.id) ?? 0,
      teachers: staff
        .filter((x) => x.a.teachingGroupId === g.id)
        .map((x) => ({ teacherId: x.a.teacherId, displayName: x.name, assignmentId: x.a.id, isPrimary: x.a.isPrimary })),
      archived: g.archivedAt !== null,
    }));
  }

  async createGroup(actor: Actor, raw: z.input<typeof createTeachingGroupRequest>) {
    requireAdmin(actor);
    const input = createTeachingGroupRequest.parse(raw);
    const date = input.effectiveDate ?? today(actor);
    const id = await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const [course] = await tx
        .select({ c: courseOfferings, yearId: classOfferings.academicYearId })
        .from(courseOfferings)
        .innerJoin(classOfferings, eq(classOfferings.id, courseOfferings.classOfferingId))
        .where(eq(courseOfferings.id, input.courseOfferingId));
      const found = required(course, 'Subject offering');
      await assertYearWritable(tx, found.yearId);
      if (input.sectionId) {
        const [section] = await tx.select().from(sections).where(and(eq(sections.id, input.sectionId), eq(sections.classOfferingId, found.c.classOfferingId)));
        if (!section) throw errors.field('sectionId', 'Choose a section of the same class');
      }
      const [group] = await tx
        .insert(teachingGroups)
        .values({ schoolId: actor.schoolId, courseOfferingId: input.courseOfferingId, sectionId: input.sectionId ?? null, code: input.code, name: input.name })
        .returning();
      if (input.populate) {
        const rows = await tx.execute<{ sce_id: string; student_id: string }>(sql`
          select ce.id as sce_id, ce.student_id from app.student_course_enrollments ce
          join app.student_enrollments e on e.id = ce.enrollment_id and e.status = 'active'
          where ce.course_offering_id = ${input.courseOfferingId} and ce.status = 'active'
            and ce.start_date <= ${date} and (ce.end_date is null or ce.end_date > ${date})
            ${input.sectionId ? sql`and exists (select 1 from app.student_placements p where p.enrollment_id = e.id and p.section_id = ${input.sectionId}
              and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date}))` : sql``}
            and not exists (select 1 from app.teaching_group_memberships m join app.teaching_groups g on g.id = m.teaching_group_id
              where m.student_course_enrollment_id = ce.id and g.course_offering_id = ${input.courseOfferingId}
                and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date}))`);
        if (rows.length) {
          await tx.insert(teachingGroupMemberships).values(
            rows.map((r) => ({ schoolId: actor.schoolId, teachingGroupId: group!.id, studentCourseEnrollmentId: r.sce_id, studentId: r.student_id, startDate: date })),
          );
        }
      }
      await assertNoPublishedStudentConflicts(tx, date);
      await audit(tx, actor, { action: 'teaching_group.created', entityType: 'teaching_group', entityId: group!.id });
      return group!.id;
    });
    return this.getGroup(actor, id);
  }

  async archiveGroup(actor: Actor, groupId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const date = today(actor);
      await tx
        .update(teachingGroupMemberships)
        .set({ endDate: date })
        .where(and(eq(teachingGroupMemberships.teachingGroupId, groupId), or(isNull(teachingGroupMemberships.endDate), gt(teachingGroupMemberships.endDate, date))));
      await tx.update(teachingGroups).set({ archivedAt: new Date() }).where(eq(teachingGroups.id, groupId));
      await audit(tx, actor, { action: 'teaching_group.archived', entityType: 'teaching_group', entityId: groupId });
    });
  }

  async members(actor: Actor, groupId: string, date = today(actor)) {
    return this.run(actor, async (tx) => {
      if (!isAdmin(actor)) {
        const mine = actor.teacherId ? await teacherGroupIds(tx, actor.teacherId, date) : [];
        if (!mine.includes(groupId)) throw errors.forbidden();
      }
      const rows = await tx
        .select({ m: teachingGroupMemberships, name: accounts.displayName, admissionNumber: students.admissionNumber })
        .from(teachingGroupMemberships)
        .innerJoin(students, eq(students.id, teachingGroupMemberships.studentId))
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .where(and(eq(teachingGroupMemberships.teachingGroupId, groupId), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date)))
        .orderBy(asc(accounts.displayName));
      return rows.map(({ m, name, admissionNumber }) => ({
        studentId: m.studentId,
        displayName: name,
        admissionNumber,
        startDate: m.startDate,
        endDate: m.endDate,
      }));
    });
  }

  /** Add/remove students (by student id). Serialized with timetable edits and conflict-checked. */
  async updateMembers(actor: Actor, groupId: string, raw: z.input<typeof updateGroupMembersRequest>) {
    requireAdmin(actor);
    const input = updateGroupMembersRequest.parse(raw);
    await this.run(actor, async (tx) => {
      await lockSchedule(tx, actor.schoolId);
      const [group] = await tx.select().from(teachingGroups).where(eq(teachingGroups.id, groupId));
      const g = required(group, 'Teaching group');
      if (input.remove.length) {
        await tx
          .update(teachingGroupMemberships)
          .set({ endDate: input.effectiveDate })
          .where(
            and(
              eq(teachingGroupMemberships.teachingGroupId, groupId),
              inArray(teachingGroupMemberships.studentId, input.remove),
              activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, input.effectiveDate),
            ),
          );
      }
      if (input.add.length) {
        const courseEnrollments = await tx
          .select({ ce: studentCourseEnrollments })
          .from(studentCourseEnrollments)
          .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentCourseEnrollments.enrollmentId))
          .where(
            and(
              eq(studentCourseEnrollments.courseOfferingId, g.courseOfferingId),
              inArray(studentCourseEnrollments.studentId, input.add),
              eq(studentEnrollments.status, 'active'),
              activeOn(studentCourseEnrollments.startDate, studentCourseEnrollments.endDate, input.effectiveDate),
            ),
          );
        const missing = input.add.filter((s) => !courseEnrollments.some((c) => c.ce.studentId === s));
        if (missing.length) {
          throw errors.rule('Some students are not enrolled in this subject. Enroll them in the subject first.', { studentIds: missing });
        }
        if (g.sectionId) {
          const placed = await tx
            .select({ studentId: studentPlacements.studentId })
            .from(studentPlacements)
            .where(
              and(
                eq(studentPlacements.sectionId, g.sectionId),
                inArray(studentPlacements.studentId, input.add),
                activeOn(studentPlacements.startDate, studentPlacements.endDate, input.effectiveDate),
              ),
            );
          if (placed.length !== input.add.length) throw errors.rule('Students must be in the group’s section.');
        }
        await tx.insert(teachingGroupMemberships).values(
          courseEnrollments.map(({ ce }) => ({
            schoolId: actor.schoolId,
            teachingGroupId: groupId,
            studentCourseEnrollmentId: ce.id,
            studentId: ce.studentId,
            startDate: input.effectiveDate,
          })),
        );
      }
      await assertNoPublishedStudentConflicts(tx, input.effectiveDate);
      await audit(tx, actor, {
        action: 'teaching_group.members_changed',
        entityType: 'teaching_group',
        entityId: groupId,
        summary: { added: input.add.length, removed: input.remove.length, effectiveDate: input.effectiveDate },
      });
    });
    return this.members(actor, groupId, input.effectiveDate);
  }

  /* ---------------- Teacher assignments ---------------- */

  async assignTeacher(actor: Actor, raw: z.input<typeof assignTeacherRequest>) {
    requireAdmin(actor);
    const input = assignTeacherRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [t] = await tx
        .select({ id: teachers.id, status: accounts.status })
        .from(teachers)
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .where(eq(teachers.id, input.teacherId));
      if (!t || t.status === 'pending_deletion' || t.status === 'disabled') throw errors.field('teacherId', 'Choose an active teacher');
      const [row] = await tx
        .insert(teacherAssignments)
        .values({
          schoolId: actor.schoolId,
          teacherId: input.teacherId,
          teachingGroupId: input.teachingGroupId,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          isPrimary: input.isPrimary,
          assignedByAccountId: actor.accountId,
        })
        .returning();
      await audit(tx, actor, {
        action: 'teacher_assignment.created',
        entityType: 'teacher_assignment',
        entityId: row!.id,
        summary: { teacherId: input.teacherId, teachingGroupId: input.teachingGroupId },
      });
    });
    return this.getGroup(actor, input.teachingGroupId);
  }

  async endAssignment(actor: Actor, assignmentId: string, endDate: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [a] = await tx.select().from(teacherAssignments).where(eq(teacherAssignments.id, assignmentId));
      const assignment = required(a, 'Assignment');
      if (endDate <= assignment.startDate) {
        await tx.delete(teacherAssignments).where(eq(teacherAssignments.id, assignmentId));
      } else {
        await tx.update(teacherAssignments).set({ endDate }).where(eq(teacherAssignments.id, assignmentId));
      }
      await audit(tx, actor, { action: 'teacher_assignment.ended', entityType: 'teacher_assignment', entityId: assignmentId, summary: { endDate } });
    });
  }

  /* ---------------- Class teachers ---------------- */

  async listClassTeachers(actor: Actor, filter: { sectionId?: string; teacherId?: string; date?: string }) {
    return this.run(actor, async (tx) => {
      const date = filter.date ?? today(actor);
      const rows = await tx
        .select({ a: classTeacherAssignments, teacherName: accounts.displayName, sectionName: sections.name, gradeName: gradeLevels.name })
        .from(classTeacherAssignments)
        .innerJoin(teachers, eq(teachers.id, classTeacherAssignments.teacherId))
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .innerJoin(sections, eq(sections.id, classTeacherAssignments.sectionId))
        .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(
          and(
            filter.sectionId ? eq(classTeacherAssignments.sectionId, filter.sectionId) : activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date),
            filter.teacherId ? eq(classTeacherAssignments.teacherId, filter.teacherId) : undefined,
          ),
        )
        .orderBy(asc(gradeLevels.sortOrder), asc(sections.code), desc(classTeacherAssignments.startDate));
      return rows.map(({ a, teacherName, sectionName, gradeName }) => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName,
        sectionId: a.sectionId,
        sectionName,
        gradeName,
        startDate: a.startDate,
        endDate: a.endDate,
      }));
    });
  }

  /** Explicit administrator assignment. Optionally ends the current class teacher on the start date. */
  async assignClassTeacher(actor: Actor, raw: z.input<typeof assignClassTeacherRequest>) {
    requireAdmin(actor);
    const input = assignClassTeacherRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [current] = await tx
        .select()
        .from(classTeacherAssignments)
        .where(
          and(
            eq(classTeacherAssignments.sectionId, input.sectionId),
            or(isNull(classTeacherAssignments.endDate), gt(classTeacherAssignments.endDate, input.startDate)),
          ),
        );
      if (current) {
        if (current.teacherId === input.teacherId) throw errors.rule('This teacher is already the class teacher of the section.');
        if (!input.replaceCurrent) {
          throw errors.conflict('This section already has a class teacher. Choose “replace” to hand over on the start date.', {
            currentAssignmentId: current.id,
          });
        }
        if (current.startDate >= input.startDate) {
          await tx.delete(classTeacherAssignments).where(eq(classTeacherAssignments.id, current.id));
        } else {
          await tx.update(classTeacherAssignments).set({ endDate: input.startDate }).where(eq(classTeacherAssignments.id, current.id));
        }
      }
      const [row] = await tx
        .insert(classTeacherAssignments)
        .values({
          schoolId: actor.schoolId,
          teacherId: input.teacherId,
          sectionId: input.sectionId,
          startDate: input.startDate,
          assignedByAccountId: actor.accountId,
        })
        .returning();
      await audit(tx, actor, {
        action: 'class_teacher.assigned',
        entityType: 'section',
        entityId: input.sectionId,
        summary: { teacherId: input.teacherId, replaced: current?.teacherId ?? null, assignmentId: row!.id },
      });
    });
    return this.listClassTeachers(actor, { sectionId: input.sectionId });
  }

  async endClassTeacher(actor: Actor, assignmentId: string, endDate: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [a] = await tx.select().from(classTeacherAssignments).where(eq(classTeacherAssignments.id, assignmentId));
      const assignment = required(a, 'Class teacher assignment');
      if (endDate <= assignment.startDate) await tx.delete(classTeacherAssignments).where(eq(classTeacherAssignments.id, assignmentId));
      else await tx.update(classTeacherAssignments).set({ endDate }).where(eq(classTeacherAssignments.id, assignmentId));
      await audit(tx, actor, { action: 'class_teacher.ended', entityType: 'section', entityId: assignment.sectionId, summary: { endDate } });
    });
  }

  /**
   * Suggestion only (the original brief's "first-period teacher" rule): the teacher of the section's
   * earliest lesson on the first working day in the published timetable. Administrators decide.
   */
  async suggestClassTeacher(actor: Actor, sectionId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const version = await publishedVersionOn(tx, today(actor));
      if (!version) return { sectionId, teacherId: null, teacherName: null, reason: 'No published timetable yet' };
      const [first] = await tx
        .select({ teacherId: timetableLessons.teacherId, name: accounts.displayName, weekday: timetableLessons.weekday, seq: periodDefinitions.sequence })
        .from(timetableLessons)
        .innerJoin(teachingGroups, eq(teachingGroups.id, timetableLessons.teachingGroupId))
        .innerJoin(periodDefinitions, eq(periodDefinitions.id, timetableLessons.periodDefinitionId))
        .innerJoin(teachers, eq(teachers.id, timetableLessons.teacherId))
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .where(and(eq(timetableLessons.timetableVersionId, version.id), eq(teachingGroups.sectionId, sectionId)))
        .orderBy(asc(timetableLessons.weekday), asc(periodDefinitions.sequence))
        .limit(1);
      if (!first) return { sectionId, teacherId: null, teacherName: null, reason: 'The section has no lessons in the published timetable' };
      return { sectionId, teacherId: first.teacherId, teacherName: first.name, reason: `Teaches the section's first period (period ${first.seq})` };
    });
  }

  /* ---------------- Attendance delegations ---------------- */

  async listDelegations(actor: Actor, filter: { sectionId?: string; teacherId?: string }) {
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ d: attendanceDelegations, teacherName: accounts.displayName, sectionName: sections.name })
        .from(attendanceDelegations)
        .innerJoin(teachers, eq(teachers.id, attendanceDelegations.teacherId))
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .innerJoin(sections, eq(sections.id, attendanceDelegations.sectionId))
        .where(
          and(
            isNull(attendanceDelegations.revokedAt),
            filter.sectionId ? eq(attendanceDelegations.sectionId, filter.sectionId) : undefined,
            filter.teacherId ? eq(attendanceDelegations.teacherId, filter.teacherId) : undefined,
          ),
        )
        .orderBy(desc(attendanceDelegations.startDate));
      return rows.map(({ d, teacherName, sectionName }) => ({
        id: d.id,
        sectionId: d.sectionId,
        sectionName,
        teacherId: d.teacherId,
        teacherName,
        startDate: d.startDate,
        endDate: d.endDate,
        reason: d.reason,
      }));
    });
  }

  /** Delegation dates are inclusive for users; stored as inclusive `[start, end]`. */
  async createDelegation(actor: Actor, raw: z.input<typeof createDelegationRequest>) {
    requireAdmin(actor);
    const input = createDelegationRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx
        .insert(attendanceDelegations)
        .values({
          schoolId: actor.schoolId,
          sectionId: input.sectionId,
          teacherId: input.teacherId,
          startDate: input.startDate,
          endDate: input.lastDate,
          reason: input.reason ?? null,
          grantedByAccountId: actor.accountId,
        })
        .returning();
      await audit(tx, actor, { action: 'attendance_delegation.created', entityType: 'section', entityId: input.sectionId, summary: { delegationId: row!.id } });
    });
    return this.listDelegations(actor, { sectionId: input.sectionId });
  }

  async revokeDelegation(actor: Actor, delegationId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(attendanceDelegations)
        .set({ revokedAt: new Date() })
        .where(and(eq(attendanceDelegations.id, delegationId), isNull(attendanceDelegations.revokedAt)))
        .returning({ id: attendanceDelegations.id });
      if (!rows.length) throw errors.notFound('Delegation');
      await audit(tx, actor, { action: 'attendance_delegation.revoked', entityType: 'attendance_delegation', entityId: delegationId });
    });
  }
}
