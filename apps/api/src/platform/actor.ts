import type { ClientKind, Locale, Role } from '@edventure/contracts';
import type { TenantContext } from '../db/tenant';

/** The verified caller of a request or job. Tenant context is always derived from here, never from input. */
export interface Actor {
  requestId: string;
  ip: string | null;
  schoolId: string;
  accountId: string;
  appSessionId: string | null;
  authSessionId: string | null;
  roles: Role[];
  studentId: string | null;
  teacherId: string | null;
  locale: Locale;
  timezone: string;
  client: ClientKind | 'system';
}

export const tenantOf = (actor: Pick<Actor, 'schoolId' | 'accountId' | 'roles'>): TenantContext => ({
  schoolId: actor.schoolId,
  accountId: actor.accountId,
  roles: actor.roles,
});

export const isAdmin = (actor: Pick<Actor, 'roles'>) => actor.roles.includes('school_admin');
export const isTeacher = (actor: Pick<Actor, 'roles' | 'teacherId'>) => actor.roles.includes('teacher') && !!actor.teacherId;
export const isStudent = (actor: Pick<Actor, 'roles' | 'studentId'>) => actor.roles.includes('student') && !!actor.studentId;

/** Account id used by automated work that is not performed on behalf of a person. */
export const NIL_ACCOUNT = '00000000-0000-0000-0000-000000000000';

/** A system actor for background jobs acting on behalf of a school (e.g. scheduled reminders). */
export function systemActor(schoolId: string, timezone = 'Asia/Karachi', accountId = NIL_ACCOUNT): Actor {
  return {
    requestId: `job-${Date.now()}`,
    ip: null,
    schoolId,
    accountId,
    appSessionId: null,
    authSessionId: null,
    roles: ['school_admin'],
    studentId: null,
    teacherId: null,
    locale: 'en',
    timezone,
    client: 'system',
  };
}
