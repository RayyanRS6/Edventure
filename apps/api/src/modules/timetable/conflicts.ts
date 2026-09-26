import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type { Tx } from '../../db/client';
import { timetableVersions, type TimetableValidation } from '../../db/schema';
import { errors } from '../../platform/errors';

export type Conflict = TimetableValidation['conflicts'][number];

/**
 * Detects clashes in one timetable version on a reference date: a teacher or room in two lessons
 * at once, or any student belonging to two teaching groups scheduled in the same slot.
 * Disjoint elective groups (e.g. Biology and Computer Science in 9A) may share a slot.
 */
export async function detectConflicts(tx: Tx, versionId: string, date: string): Promise<Conflict[]> {
  const teacher = await tx.execute<{ weekday: number; period_id: string; lesson_ids: string[]; detail: string }>(sql`
    select l.weekday, l.period_definition_id as period_id, array_agg(l.id::text) as lesson_ids, max(a.display_name) as detail
    from app.timetable_lessons l
    join app.teachers t on t.id = l.teacher_id
    join app.accounts a on a.id = t.account_id
    where l.timetable_version_id = ${versionId}
    group by l.weekday, l.period_definition_id, l.teacher_id having count(*) > 1`);
  const room = await tx.execute<{ weekday: number; period_id: string; lesson_ids: string[]; detail: string }>(sql`
    select l.weekday, l.period_definition_id as period_id, array_agg(l.id::text) as lesson_ids, max(r.name) as detail
    from app.timetable_lessons l join app.rooms r on r.id = l.room_id
    where l.timetable_version_id = ${versionId} and l.room_id is not null
    group by l.weekday, l.period_definition_id, l.room_id having count(*) > 1`);
  const student = await tx.execute<{ weekday: number; period_id: string; a: string; b: string; students: number; group_a: string; group_b: string }>(sql`
    select l1.weekday, l1.period_definition_id as period_id, l1.id::text as a, l2.id::text as b,
           count(distinct m1.student_id)::int as students, max(g1.name) as group_a, max(g2.name) as group_b
    from app.timetable_lessons l1
    join app.timetable_lessons l2
      on l2.timetable_version_id = l1.timetable_version_id and l2.weekday = l1.weekday
     and l2.period_definition_id = l1.period_definition_id and l2.id > l1.id
     and l2.teaching_group_id <> l1.teaching_group_id
    join app.teaching_groups g1 on g1.id = l1.teaching_group_id
    join app.teaching_groups g2 on g2.id = l2.teaching_group_id
    join app.teaching_group_memberships m1 on m1.teaching_group_id = l1.teaching_group_id
     and m1.start_date <= ${date} and (m1.end_date is null or m1.end_date > ${date})
    join app.teaching_group_memberships m2 on m2.teaching_group_id = l2.teaching_group_id and m2.student_id = m1.student_id
     and m2.start_date <= ${date} and (m2.end_date is null or m2.end_date > ${date})
    where l1.timetable_version_id = ${versionId}
    group by l1.weekday, l1.period_definition_id, l1.id, l2.id`);
  return [
    ...teacher.map((r) => ({ kind: 'teacher' as const, weekday: r.weekday, periodId: r.period_id, lessonIds: r.lesson_ids, detail: `${r.detail} is double-booked` })),
    ...room.map((r) => ({ kind: 'room' as const, weekday: r.weekday, periodId: r.period_id, lessonIds: r.lesson_ids, detail: `${r.detail} is double-booked` })),
    ...student.map((r) => ({
      kind: 'student' as const,
      weekday: r.weekday,
      periodId: r.period_id,
      lessonIds: [r.a, r.b],
      detail: `${r.students} student(s) are in both ${r.group_a} and ${r.group_b}`,
    })),
  ];
}

/** Published timetable in effect on `date`, if any. */
export async function publishedVersionOn(tx: Tx, date: string) {
  const [v] = await tx
    .select()
    .from(timetableVersions)
    .where(
      and(
        eq(timetableVersions.status, 'published'),
        lte(timetableVersions.effectiveFrom, date),
        or(isNull(timetableVersions.effectiveTo), gt(timetableVersions.effectiveTo, date)),
      ),
    )
    .limit(1);
  return v ?? null;
}

/**
 * Called (under the schedule lock) after membership changes: rejects a change that would make the
 * published timetable put a student in two places at once.
 */
export async function assertNoPublishedStudentConflicts(tx: Tx, date: string) {
  const version = await publishedVersionOn(tx, date);
  if (!version) return;
  const conflicts = (await detectConflicts(tx, version.id, date)).filter((c) => c.kind === 'student');
  if (conflicts.length) {
    throw errors.rule('This change would give students two lessons at the same time in the published timetable.', {
      conflicts,
    });
  }
}
