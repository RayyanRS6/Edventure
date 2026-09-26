/**
 * Assignment-scoped authorization queries. "Assigned" means an assignment active on the date in
 * question; historical assignments never grant current access.
 */
import { and, eq, gt, gte, inArray, isNull, lte, or, sql, type AnyColumn } from 'drizzle-orm';
import type { Tx } from '../db/client';
import {
  academicYears,
  attendanceDelegations,
  classOfferings,
  classTeacherAssignments,
  studentEnrollments,
  studentPlacements,
  teacherAssignments,
  teachingGroupMemberships,
  teachingGroups,
} from '../db/schema';
import { isAdmin, type Actor } from './actor';
import { errors } from './errors';
import { todayIn } from './dates';

/** `[start, end)` contains `date`. */
export const activeOn = (start: AnyColumn, end: AnyColumn, date: string) =>
  and(lte(start, date), or(isNull(end), gt(end, date)))!;

/** Inclusive `[start, last]` contains `date`. */
export const coversInclusive = (start: AnyColumn, last: AnyColumn, date: string) => and(lte(start, date), gte(last, date))!;

export const today = (actor: Pick<Actor, 'timezone'>) => todayIn(actor.timezone);

export function requireAdmin(actor: Actor) {
  if (!isAdmin(actor)) throw errors.forbidden();
}

export async function activeAcademicYear(tx: Tx) {
  const [year] = await tx.select().from(academicYears).where(eq(academicYears.status, 'active')).limit(1);
  return year ?? null;
}

export async function academicYearForDate(tx: Tx, date: string) {
  const [year] = await tx
    .select()
    .from(academicYears)
    .where(and(lte(academicYears.startDate, date), gte(academicYears.endDate, date)))
    .limit(1);
  return year ?? null;
}

export async function currentPlacement(tx: Tx, studentId: string, date: string) {
  const [row] = await tx
    .select({
      placementId: studentPlacements.id,
      enrollmentId: studentPlacements.enrollmentId,
      sectionId: studentPlacements.sectionId,
      classOfferingId: studentEnrollments.classOfferingId,
      academicYearId: studentEnrollments.academicYearId,
      enrollmentStatus: studentEnrollments.status,
    })
    .from(studentPlacements)
    .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentPlacements.enrollmentId))
    .where(and(eq(studentPlacements.studentId, studentId), activeOn(studentPlacements.startDate, studentPlacements.endDate, date)))
    .limit(1);
  return row ?? null;
}

export async function teacherGroupIds(tx: Tx, teacherId: string, date: string) {
  const rows = await tx
    .select({ id: teacherAssignments.teachingGroupId })
    .from(teacherAssignments)
    .where(and(eq(teacherAssignments.teacherId, teacherId), activeOn(teacherAssignments.startDate, teacherAssignments.endDate, date)));
  return [...new Set(rows.map((r) => r.id))];
}

export async function classTeacherSectionIds(tx: Tx, teacherId: string, date: string) {
  const rows = await tx
    .select({ id: classTeacherAssignments.sectionId })
    .from(classTeacherAssignments)
    .where(
      and(
        eq(classTeacherAssignments.teacherId, teacherId),
        activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date),
      ),
    );
  return rows.map((r) => r.id);
}

export async function delegatedSectionIds(tx: Tx, teacherId: string, date: string) {
  const rows = await tx
    .select({ id: attendanceDelegations.sectionId })
    .from(attendanceDelegations)
    .where(
      and(
        eq(attendanceDelegations.teacherId, teacherId),
        isNull(attendanceDelegations.revokedAt),
        coversInclusive(attendanceDelegations.startDate, attendanceDelegations.endDate, date),
      ),
    );
  return rows.map((r) => r.id);
}

/** Sections whose daily roll call the teacher may record on `date`. */
export async function rollCallSectionIds(tx: Tx, teacherId: string, date: string) {
  const [own, delegated] = await Promise.all([classTeacherSectionIds(tx, teacherId, date), delegatedSectionIds(tx, teacherId, date)]);
  return [...new Set([...own, ...delegated])];
}

export async function assertCanTeachGroup(tx: Tx, actor: Actor, groupId: string, date = today(actor)) {
  if (isAdmin(actor)) return;
  if (!actor.teacherId) throw errors.forbidden();
  const groups = await teacherGroupIds(tx, actor.teacherId, date);
  if (!groups.includes(groupId)) throw errors.forbidden('You are not assigned to teach this group');
}

export async function studentIdsInGroup(tx: Tx, groupId: string, date: string) {
  const rows = await tx
    .select({ id: teachingGroupMemberships.studentId })
    .from(teachingGroupMemberships)
    .where(
      and(
        eq(teachingGroupMemberships.teachingGroupId, groupId),
        activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date),
      ),
    );
  return rows.map((r) => r.id);
}

export async function studentIdsInSection(tx: Tx, sectionId: string, date: string) {
  const rows = await tx
    .select({ id: studentPlacements.studentId })
    .from(studentPlacements)
    .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentPlacements.enrollmentId))
    .where(
      and(
        eq(studentPlacements.sectionId, sectionId),
        eq(studentEnrollments.status, 'active'),
        activeOn(studentPlacements.startDate, studentPlacements.endDate, date),
      ),
    );
  return rows.map((r) => r.id);
}

/** Minimal-roster rule: teachers see students they teach or whose section they lead. */
export async function teacherCanSeeStudent(tx: Tx, teacherId: string, studentId: string, date: string) {
  const [row] = await tx.execute<{ ok: boolean }>(sql`
    select exists (
      select 1 from app.teaching_group_memberships m
      join app.teacher_assignments a on a.teaching_group_id = m.teaching_group_id
      where m.student_id = ${studentId} and a.teacher_id = ${teacherId}
        and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date})
        and a.start_date <= ${date} and (a.end_date is null or a.end_date > ${date})
    ) or exists (
      select 1 from app.student_placements p
      join app.class_teacher_assignments c on c.section_id = p.section_id
      where p.student_id = ${studentId} and c.teacher_id = ${teacherId}
        and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})
        and c.start_date <= ${date} and (c.end_date is null or c.end_date > ${date})
    ) as ok`);
  return row?.ok === true;
}

export async function assertCanViewStudent(tx: Tx, actor: Actor, studentId: string) {
  if (isAdmin(actor)) return;
  if (actor.studentId === studentId) return;
  if (actor.teacherId && (await teacherCanSeeStudent(tx, actor.teacherId, studentId, today(actor)))) return;
  throw errors.forbidden();
}

export async function groupsForSection(tx: Tx, sectionId: string) {
  return tx.select().from(teachingGroups).where(eq(teachingGroups.sectionId, sectionId));
}

export async function classOfferingIdsForYear(tx: Tx, academicYearId: string) {
  const rows = await tx.select({ id: classOfferings.id }).from(classOfferings).where(eq(classOfferings.academicYearId, academicYearId));
  return rows.map((r) => r.id);
}

export const inIds = (col: AnyColumn, ids: string[]) => (ids.length ? inArray(col, ids) : sql`false`);
