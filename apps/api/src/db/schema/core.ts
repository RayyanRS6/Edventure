import { sql } from 'drizzle-orm';
import { bigint, boolean, check, index, integer, jsonb, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  accountStatuses,
  clientKinds,
  fileLifecycles,
  filePurposes,
  fileScanStates,
  locales,
  provisioningStates,
  roles,
  schoolStatuses,
} from '@edventure/contracts';
import { app, createdAt, tenantColumns, tenantConstraints, tfk, ts, updatedAt, version } from './_helpers';

export const schoolStatus = app.enum('school_status', schoolStatuses);
export const localeEnum = app.enum('locale', locales);
export const accountStatus = app.enum('account_status', accountStatuses);
export const provisioningState = app.enum('provisioning_state', provisioningStates);
export const roleEnum = app.enum('role', roles);
export const clientKind = app.enum('client_kind', clientKinds);
export const filePurpose = app.enum('file_purpose', filePurposes);
export const fileScanState = app.enum('file_scan_state', fileScanStates);
export const fileLifecycle = app.enum('file_lifecycle', fileLifecycles);

/** Tenant root. RLS exposes only the school in the current transaction context. */
export const schools = app.table(
  'schools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    timezone: text('timezone').notNull().default('Asia/Karachi'),
    currency: text('currency').notNull().default('PKR'),
    defaultLocale: localeEnum('default_locale').notNull().default('en'),
    branding: jsonb('branding').$type<{ primaryColor?: string; logoFileId?: string }>().notNull().default({}),
    status: schoolStatus('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: version(),
  },
  (t) => [
    uniqueIndex('schools_code_uk').on(t.code),
    check('schools_code_format', sql`${t.code} ~ '^[A-Z0-9-]{2,32}$'`),
  ],
);

export type AttendancePolicy = {
  /** ISO weekdays (1 = Monday) that are instructional unless the calendar says otherwise. */
  workingWeekdays: number[];
  /** Teachers may correct their own roll call until the end of the same school day. */
  sameDayTeacherCorrection: boolean;
};
export type RetentionPolicy = {
  recoveryDays: number;
  /** Automatic academic/financial purging stays disabled until the school approves a schedule. */
  purgeEnabled: boolean;
  exportDownloadHours: number;
};
export type NotificationPolicy = {
  feeReminderMode: 'preview' | 'scheduled';
  feeReminderDaysAfterDue: number[];
};
export type OperationsPolicy = {
  offlineCacheDays: number;
  minimumMobileVersion: string | null;
};

export const schoolPolicies = app.table('school_policies', {
  schoolId: uuid('school_id')
    .primaryKey()
    .references(() => schools.id),
  attendance: jsonb('attendance')
    .$type<AttendancePolicy>()
    .notNull()
    .default({ workingWeekdays: [1, 2, 3, 4, 5, 6], sameDayTeacherCorrection: true }),
  retention: jsonb('retention')
    .$type<RetentionPolicy>()
    .notNull()
    .default({ recoveryDays: 30, purgeEnabled: false, exportDownloadHours: 24 }),
  notifications: jsonb('notifications')
    .$type<NotificationPolicy>()
    .notNull()
    .default({ feeReminderMode: 'preview', feeReminderDaysAfterDue: [] }),
  operations: jsonb('operations')
    .$type<OperationsPolicy>()
    .notNull()
    .default({ offlineCacheDays: 7, minimumMobileVersion: null }),
  updatedAt: updatedAt(),
  version: version(),
});

/** Separate privileged identities for platform operators. Not tenant data. */
export const platformAdmins = app.table(
  'platform_admins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id'),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('platform_admins_email_uk').on(t.email), uniqueIndex('platform_admins_auth_uk').on(t.authUserId)],
);

/** Time-limited, audited support access to one school. */
export const platformSupportGrants = app.table('platform_support_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  platformAdminId: uuid('platform_admin_id')
    .notNull()
    .references(() => platformAdmins.id),
  schoolId: uuid('school_id')
    .notNull()
    .references(() => schools.id),
  reason: text('reason').notNull(),
  startsAt: ts('starts_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
  createdAt: createdAt(),
});

export const accounts = app.table(
  'accounts',
  {
    ...tenantColumns(),
    /** Supabase Auth user id (or local development identity). Null until provisioned. */
    authUserId: uuid('auth_user_id'),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    displayNameUr: text('display_name_ur'),
    status: accountStatus('status').notNull().default('pending'),
    statusReason: text('status_reason'),
    statusChangedAt: ts('status_changed_at'),
    provisioningState: provisioningState('provisioning_state').notNull().default('pending'),
    provisioningError: text('provisioning_error'),
    provisioningAttempts: integer('provisioning_attempts').notNull().default(0),
    locale: localeEnum('locale').notNull().default('en'),
    mustChangePassword: boolean('must_change_password').notNull().default(true),
    mfaRequired: boolean('mfa_required').notNull().default(false),
    lastLoginAt: ts('last_login_at'),
    deletedAt: ts('deleted_at'),
    anonymizedAt: ts('anonymized_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('accounts', t, schools),
    uniqueIndex('accounts_username_uk').on(t.schoolId, t.username),
    uniqueIndex('accounts_auth_user_uk').on(t.authUserId),
    index('accounts_status_idx').on(t.schoolId, t.status),
    check('accounts_username_normalized', sql`${t.username} = lower(${t.username})`),
  ],
);

export const accountRoles = app.table(
  'account_roles',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    role: roleEnum('role').notNull(),
    grantedByAccountId: uuid('granted_by_account_id'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [
    ...tenantConstraints('account_roles', t, schools),
    tfk('account_roles_account_fk', t.schoolId, t.accountId, accounts),
    uniqueIndex('account_roles_active_uk')
      .on(t.schoolId, t.accountId, t.role)
      .where(sql`${t.revokedAt} is null`),
  ],
);

/** Application sessions, tracked against the auth provider session so revocation is immediate. */
export const appSessions = app.table(
  'app_sessions',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    authSessionId: text('auth_session_id').notNull(),
    client: clientKind('client').notNull(),
    deviceName: text('device_name'),
    platform: text('platform'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    mfaVerifiedAt: ts('mfa_verified_at'),
    revokedAt: ts('revoked_at'),
    revokedReason: text('revoked_reason'),
  },
  (t) => [
    ...tenantConstraints('app_sessions', t, schools),
    tfk('app_sessions_account_fk', t.schoolId, t.accountId, accounts),
    uniqueIndex('app_sessions_auth_session_uk').on(t.authSessionId),
    index('app_sessions_account_idx').on(t.schoolId, t.accountId),
  ],
);

export const files = app.table(
  'files',
  {
    ...tenantColumns(),
    objectKey: text('object_key').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: text('checksum_sha256'),
    purpose: filePurpose('purpose').notNull(),
    scanState: fileScanState('scan_state').notNull().default('pending'),
    lifecycle: fileLifecycle('lifecycle').notNull().default('upload_pending'),
    rejectionReason: text('rejection_reason'),
    uploadedByAccountId: uuid('uploaded_by_account_id'),
    availableAt: ts('available_at'),
    expiresAt: ts('expires_at'),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    ...tenantConstraints('files', t, schools),
    tfk('files_uploader_fk', t.schoolId, t.uploadedByAccountId, accounts),
    uniqueIndex('files_object_key_uk').on(t.objectKey),
    index('files_lifecycle_idx').on(t.schoolId, t.lifecycle),
  ],
);

/** Append-only. The application role has INSERT/SELECT only. */
export const auditEvents = app.table(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').references(() => schools.id),
    actorAccountId: uuid('actor_account_id'),
    actorPlatformAdminId: uuid('actor_platform_admin_id').references(() => platformAdmins.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
    reason: text('reason'),
    requestId: text('request_id'),
    ipAddress: text('ip_address'),
    occurredAt: ts('occurred_at').notNull().defaultNow(),
  },
  (t) => [
    tfk('audit_events_actor_fk', t.schoolId, t.actorAccountId, accounts),
    index('audit_events_school_time_idx').on(t.schoolId, t.occurredAt),
    index('audit_events_entity_idx').on(t.schoolId, t.entityType, t.entityId),
  ],
);

export const idempotencyRecords = app.table(
  'idempotency_records',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    completedAt: ts('completed_at'),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [
    ...tenantConstraints('idempotency_records', t, schools),
    tfk('idempotency_records_account_fk', t.schoolId, t.accountId, accounts),
    uniqueIndex('idempotency_records_key_uk').on(t.schoolId, t.accountId, t.scope, t.key),
  ],
);
