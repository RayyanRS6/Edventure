import { inArray, sql } from 'drizzle-orm';
import type { AudienceSpec } from '@edventure/contracts';
import type { Tx } from '../../db/client';
import { students, teachers } from '../../db/schema';

/**
 * Resolves audiences to account ids on a given school-local date. Only active and pending accounts
 * are included; the result is snapshotted into recipients at publication time.
 */
export async function resolveAudience(tx: Tx, audiences: AudienceSpec[], date: string): Promise<string[]> {
  const ids = new Set<string>();
  for (const a of audiences) {
    let rows: Array<{ id: string }> = [];
    switch (a.target) {
      case 'everyone':
        rows = await tx.execute<{ id: string }>(sql`
          select a.id from app.accounts a where a.status in ('active', 'pending')`);
        break;
      case 'role':
        rows = await tx.execute<{ id: string }>(sql`
          select distinct a.id from app.accounts a
          join app.account_roles r on r.account_id = a.id and r.revoked_at is null
          where a.status in ('active', 'pending') and r.role = ${a.role}::app.role`);
        break;
      case 'class_offering':
        rows = await tx.execute<{ id: string }>(sql`
          select distinct s.account_id as id from app.student_placements p
          join app.sections sec on sec.id = p.section_id
          join app.student_enrollments e on e.id = p.enrollment_id and e.status = 'active'
          join app.students s on s.id = p.student_id
          join app.accounts a on a.id = s.account_id and a.status in ('active', 'pending')
          where sec.class_offering_id = ${a.classOfferingId}
            and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})`);
        break;
      case 'section':
        rows = await tx.execute<{ id: string }>(sql`
          select distinct s.account_id as id from app.student_placements p
          join app.student_enrollments e on e.id = p.enrollment_id and e.status = 'active'
          join app.students s on s.id = p.student_id
          join app.accounts a on a.id = s.account_id and a.status in ('active', 'pending')
          where p.section_id = ${a.sectionId}
            and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})`);
        break;
      case 'teaching_group':
        rows = await tx.execute<{ id: string }>(sql`
          select distinct s.account_id as id from app.teaching_group_memberships m
          join app.students s on s.id = m.student_id
          join app.accounts a on a.id = s.account_id and a.status in ('active', 'pending')
          where m.teaching_group_id = ${a.teachingGroupId}
            and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date})`);
        break;
    }
    for (const r of rows) ids.add(r.id);
  }
  return [...ids];
}

export async function studentAccountIds(tx: Tx, studentIds: string[]): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const rows = await tx.select({ id: students.accountId }).from(students).where(inArray(students.id, studentIds));
  return rows.map((r) => r.id);
}

export async function teacherAccountIds(tx: Tx, teacherIds: string[]): Promise<string[]> {
  if (teacherIds.length === 0) return [];
  const rows = await tx.select({ id: teachers.accountId }).from(teachers).where(inArray(teachers.id, teacherIds));
  return rows.map((r) => r.id);
}

export async function adminAccountIds(tx: Tx): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(sql`
    select distinct a.id from app.accounts a
    join app.account_roles r on r.account_id = a.id and r.revoked_at is null and r.role = 'school_admin'
    where a.status = 'active'`);
  return rows.map((r) => r.id);
}
