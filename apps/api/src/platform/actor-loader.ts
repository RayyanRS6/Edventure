import { and, eq, isNull } from 'drizzle-orm';
import type { Role } from '@edventure/contracts';
import type { Db } from '../db/client';
import { accountRoles, accounts, schools, students, teachers } from '../db/schema';
import { withTenant } from '../db/tenant';
import type { Actor } from './actor';
import { errors } from './errors';

/**
 * Rebuilds an actor for background work performed on behalf of an account (e.g. a report the user
 * requested), so the worker is subject to exactly the same authorization as the original request.
 */
export async function actorForAccount(db: Db, schoolId: string, accountId: string, requestId: string): Promise<Actor> {
  return withTenant(db, { schoolId, accountId, roles: [] }, async (tx) => {
    const [a] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
    if (!a || a.status !== 'active') throw errors.forbidden('The requesting account is no longer active');
    const roles = (await tx.select({ role: accountRoles.role }).from(accountRoles).where(and(eq(accountRoles.accountId, accountId), isNull(accountRoles.revokedAt)))).map((r) => r.role as Role);
    const [st] = await tx.select({ id: students.id }).from(students).where(eq(students.accountId, accountId));
    const [te] = await tx.select({ id: teachers.id }).from(teachers).where(eq(teachers.accountId, accountId));
    const [school] = await tx.select({ timezone: schools.timezone }).from(schools).where(eq(schools.id, schoolId));
    return {
      requestId,
      ip: null,
      schoolId,
      accountId,
      appSessionId: null,
      authSessionId: null,
      roles,
      studentId: st?.id ?? null,
      teacherId: te?.id ?? null,
      locale: a.locale,
      timezone: school?.timezone ?? 'Asia/Karachi',
      client: 'system',
    };
  });
}
