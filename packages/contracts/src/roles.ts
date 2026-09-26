import { z } from 'zod';

/**
 * School-scoped roles. A class teacher is NOT a role: it is a section-scoped assignment held by a teacher.
 */
export const roles = ['school_admin', 'teacher', 'student'] as const;
export const role = z.enum(roles);
export type Role = z.infer<typeof role>;

/** The app experience a signed-in account is routed to. Admins may use web or mobile; others mobile. */
export const experiences = ['admin', 'teacher', 'student'] as const;
export const experience = z.enum(experiences);
export type Experience = z.infer<typeof experience>;

export const experienceForRole: Record<Role, Experience> = {
  school_admin: 'admin',
  teacher: 'teacher',
  student: 'student',
};

export const accountStatuses = ['pending', 'active', 'suspended', 'disabled', 'pending_deletion'] as const;
export const accountStatus = z.enum(accountStatuses);
export type AccountStatus = z.infer<typeof accountStatus>;

export const provisioningStates = ['pending', 'provisioning', 'provisioned', 'failed'] as const;
export const provisioningState = z.enum(provisioningStates);

export const enrollmentStatuses = ['active', 'withdrawn', 'transferred', 'completed'] as const;
export const enrollmentStatus = z.enum(enrollmentStatuses);

export const employmentStatuses = ['active', 'on_leave', 'ended'] as const;
export const employmentStatus = z.enum(employmentStatuses);

/** Which client is calling. Web uses HttpOnly cookies; mobile uses bearer tokens stored in SecureStore. */
export const clientKinds = ['web', 'mobile'] as const;
export const clientKind = z.enum(clientKinds);
export type ClientKind = z.infer<typeof clientKind>;

export const CLIENT_HEADER = 'x-edventure-client';
export const CLIENT_VERSION_HEADER = 'x-edventure-client-version';
export const CSRF_HEADER = 'x-csrf-token';
export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const REQUEST_ID_HEADER = 'x-request-id';
