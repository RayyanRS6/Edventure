import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  announcementCategories,
  announcementStates,
  audienceTargets,
  deletionStates,
  deletionSubjects,
  deliveryStatuses,
  reportJobStates,
} from '@edventure/contracts';
import { app, tenantColumns, tenantConstraints, tfk, ts } from './_helpers';
import { accounts, appSessions, files, localeEnum, roleEnum, schools } from './core';
import { classOfferings, sections, teachingGroups } from './academics';

export const announcementCategory = app.enum('announcement_category', announcementCategories);
export const announcementState = app.enum('announcement_state', announcementStates);
export const audienceTarget = app.enum('audience_target', audienceTargets);
export const deliveryStatus = app.enum('delivery_status', deliveryStatuses);
export const reportJobState = app.enum('report_job_state', reportJobStates);
export const deletionState = app.enum('deletion_state', deletionStates);
export const deletionSubject = app.enum('deletion_subject', deletionSubjects);

export const announcements = app.table(
  'announcements',
  {
    ...tenantColumns(),
    title: text('title').notNull(),
    titleUr: text('title_ur'),
    body: text('body').notNull(),
    bodyUr: text('body_ur'),
    category: announcementCategory('category').notNull().default('general'),
    state: announcementState('state').notNull().default('draft'),
    publishedAt: ts('published_at'),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    recipientCount: integer('recipient_count'),
  },
  (t) => [
    ...tenantConstraints('announcements', t, schools),
    tfk('announcements_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    index('announcements_published_idx').on(t.schoolId, t.state, t.publishedAt),
  ],
);

export const announcementAudiences = app.table(
  'announcement_audiences',
  {
    ...tenantColumns(),
    announcementId: uuid('announcement_id').notNull(),
    target: audienceTarget('target').notNull(),
    role: roleEnum('role'),
    classOfferingId: uuid('class_offering_id'),
    sectionId: uuid('section_id'),
    teachingGroupId: uuid('teaching_group_id'),
  },
  (t) => [
    ...tenantConstraints('announcement_audiences', t, schools),
    tfk('announcement_audiences_announcement_fk', t.schoolId, t.announcementId, announcements, 'cascade'),
    tfk('announcement_audiences_class_fk', t.schoolId, t.classOfferingId, classOfferings),
    tfk('announcement_audiences_section_fk', t.schoolId, t.sectionId, sections),
    tfk('announcement_audiences_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
  ],
);

export const announcementAttachments = app.table(
  'announcement_attachments',
  {
    ...tenantColumns(),
    announcementId: uuid('announcement_id').notNull(),
    fileId: uuid('file_id').notNull(),
  },
  (t) => [
    ...tenantConstraints('announcement_attachments', t, schools),
    tfk('announcement_attachments_announcement_fk', t.schoolId, t.announcementId, announcements, 'cascade'),
    tfk('announcement_attachments_file_fk', t.schoolId, t.fileId, files),
  ],
);

/**
 * The durable in-app notification. Push delivery is best effort. Templates are localized at read
 * time from `kind` + `data`, and sensitive details (marks, amounts) never go into push text.
 */
export const notifications = app.table(
  'notifications',
  {
    ...tenantColumns(),
    kind: text('kind').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    /** Deep link path resolved with fresh authorization when opened. */
    link: text('link'),
    dedupeKey: text('dedupe_key'),
    createdByAccountId: uuid('created_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('notifications', t, schools),
    uniqueIndex('notifications_dedupe_uk').on(t.schoolId, t.dedupeKey),
  ],
);

export const notificationRecipients = app.table(
  'notification_recipients',
  {
    ...tenantColumns(),
    notificationId: uuid('notification_id').notNull(),
    accountId: uuid('account_id').notNull(),
    readAt: ts('read_at'),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('notification_recipients', t, schools),
    tfk('notification_recipients_notification_fk', t.schoolId, t.notificationId, notifications, 'cascade'),
    tfk('notification_recipients_account_fk', t.schoolId, t.accountId, accounts),
    uniqueIndex('notification_recipients_uk').on(t.schoolId, t.notificationId, t.accountId),
    index('notification_recipients_inbox_idx').on(t.schoolId, t.accountId, t.createdAt),
  ],
);

export const deviceTokens = app.table(
  'device_tokens',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    appSessionId: uuid('app_session_id'),
    expoPushToken: text('expo_push_token').notNull(),
    platform: text('platform').notNull(),
    locale: localeEnum('locale').notNull().default('en'),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    retiredAt: ts('retired_at'),
    retiredReason: text('retired_reason'),
  },
  (t) => [
    ...tenantConstraints('device_tokens', t, schools),
    tfk('device_tokens_account_fk', t.schoolId, t.accountId, accounts),
    tfk('device_tokens_session_fk', t.schoolId, t.appSessionId, appSessions),
    uniqueIndex('device_tokens_token_uk').on(t.schoolId, t.expoPushToken),
    index('device_tokens_account_idx').on(t.schoolId, t.accountId),
  ],
);

export const notificationDeliveries = app.table(
  'notification_deliveries',
  {
    ...tenantColumns(),
    recipientId: uuid('recipient_id').notNull(),
    deviceTokenId: uuid('device_token_id').notNull(),
    status: deliveryStatus('status').notNull().default('pending'),
    ticketId: text('ticket_id'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: ts('sent_at'),
    receiptCheckedAt: ts('receipt_checked_at'),
  },
  (t) => [
    ...tenantConstraints('notification_deliveries', t, schools),
    tfk('notification_deliveries_recipient_fk', t.schoolId, t.recipientId, notificationRecipients, 'cascade'),
    tfk('notification_deliveries_device_fk', t.schoolId, t.deviceTokenId, deviceTokens),
    uniqueIndex('notification_deliveries_uk').on(t.schoolId, t.recipientId, t.deviceTokenId),
    index('notification_deliveries_status_idx').on(t.status, t.sentAt),
  ],
);

/** Background exports and PDF reports. Downloads expire and are re-authorized on access. */
export const reportJobs = app.table(
  'report_jobs',
  {
    ...tenantColumns(),
    kind: text('kind').notNull(),
    format: text('format').notNull(),
    parameters: jsonb('parameters').$type<Record<string, unknown>>().notNull().default({}),
    state: reportJobState('state').notNull().default('queued'),
    fileId: uuid('file_id'),
    error: text('error'),
    requestedByAccountId: uuid('requested_by_account_id').notNull(),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
    expiresAt: ts('expires_at'),
  },
  (t) => [
    ...tenantConstraints('report_jobs', t, schools),
    tfk('report_jobs_file_fk', t.schoolId, t.fileId, files),
    tfk('report_jobs_requester_fk', t.schoolId, t.requestedByAccountId, accounts),
    index('report_jobs_requester_idx').on(t.schoolId, t.requestedByAccountId, t.createdAt),
  ],
);

/** Two-step confirmed deletion with a recovery window (30 days by default). */
export const deletionRequests = app.table(
  'deletion_requests',
  {
    ...tenantColumns(),
    subjectType: deletionSubject('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    accountId: uuid('account_id').notNull(),
    reason: text('reason'),
    requestedByAccountId: uuid('requested_by_account_id').notNull(),
    recoverUntil: ts('recover_until').notNull(),
    state: deletionState('state').notNull().default('pending'),
    restoredByAccountId: uuid('restored_by_account_id'),
    restoredAt: ts('restored_at'),
    processedAt: ts('processed_at'),
    processingSummary: jsonb('processing_summary').$type<Record<string, unknown>>(),
  },
  (t) => [
    ...tenantConstraints('deletion_requests', t, schools),
    tfk('deletion_requests_account_fk', t.schoolId, t.accountId, accounts),
    tfk('deletion_requests_requester_fk', t.schoolId, t.requestedByAccountId, accounts),
    uniqueIndex('deletion_requests_one_pending_uk')
      .on(t.schoolId, t.accountId)
      .where(sql`${t.state} = 'pending'`),
    index('deletion_requests_due_idx').on(t.state, t.recoverUntil),
  ],
);

export const retentionHolds = app.table(
  'retention_holds',
  {
    ...tenantColumns(),
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    reason: text('reason').notNull(),
    placedByAccountId: uuid('placed_by_account_id').notNull(),
    releasedAt: ts('released_at'),
    releasedByAccountId: uuid('released_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('retention_holds', t, schools),
    tfk('retention_holds_placer_fk', t.schoolId, t.placedByAccountId, accounts),
    index('retention_holds_subject_idx').on(t.schoolId, t.subjectType, t.subjectId),
    check('retention_holds_release', sql`${t.releasedAt} is null or ${t.releasedByAccountId} is not null`),
  ],
);
