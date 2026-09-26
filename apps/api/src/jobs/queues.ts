/**
 * Background job queues. Payloads carry identifiers only (never personal data); every handler
 * re-establishes tenant context from `schoolId` before touching application tables.
 */
export interface QueueDefinition {
  name: string;
  retryLimit: number;
  retryDelay: number;
  retryBackoff: boolean;
  expireInSeconds: number;
}

const q = (name: string, overrides: Partial<Omit<QueueDefinition, 'name'>> = {}): QueueDefinition => ({
  name,
  retryLimit: 5,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 15 * 60,
  ...overrides,
});

export const DEAD_LETTER_QUEUE = 'dead-letter';

export const queues = {
  accountProvision: q('account-provision'),
  fileScan: q('file-scan', { retryLimit: 3 }),
  notificationDeliver: q('notification-deliver', { retryLimit: 4, retryDelay: 60 }),
  notificationReceipts: q('notification-receipts', { retryLimit: 2 }),
  importCommit: q('import-commit', { retryLimit: 1, expireInSeconds: 30 * 60 }),
  reportGenerate: q('report-generate', { retryLimit: 2, expireInSeconds: 30 * 60 }),
  feeReminders: q('fee-reminders', { retryLimit: 2 }),
  retentionProcess: q('retention-process', { retryLimit: 3 }),
  maintenance: q('maintenance', { retryLimit: 2 }),
} as const satisfies Record<string, QueueDefinition>;

export type QueueKey = keyof typeof queues;

export interface JobPayloads {
  accountProvision: { schoolId: string; accountId: string };
  fileScan: { schoolId: string; fileId: string };
  notificationDeliver: { schoolId: string; notificationId: string };
  notificationReceipts: Record<string, never>;
  importCommit: { schoolId: string; batchId: string; accountId: string };
  reportGenerate: { schoolId: string; reportJobId: string };
  /** Daily fan-out over schools that chose scheduled reminders. */
  feeReminders: Record<string, never>;
  retentionProcess: Record<string, never>;
  maintenance: Record<string, never>;
}

/** Recurring schedules (cron, UTC). Per-school work fans out from these. */
export const schedules: Array<{ key: QueueKey; cron: string }> = [
  { key: 'retentionProcess', cron: '15 21 * * *' }, // 02:15 Asia/Karachi
  { key: 'maintenance', cron: '45 21 * * *' },
  { key: 'notificationReceipts', cron: '*/15 * * * *' },
  { key: 'feeReminders', cron: '0 5 * * *' }, // 10:00 Asia/Karachi
];
