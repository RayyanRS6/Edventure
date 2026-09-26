import { eq, sql } from 'drizzle-orm';
import type { Container } from '../container';
import { files, schoolPolicies, schools } from '../db/schema';
import { withTenant } from '../db/tenant';
import { actorForAccount } from '../platform/actor-loader';
import { systemActor } from '../platform/actor';
import { todayIn } from '../platform/dates';
import { scanWithClamav } from '../storage/clamav';
import { queues, type JobPayloads, type QueueKey } from './queues';

type Handler<K extends QueueKey> = (data: JobPayloads[K], jobId: string) => Promise<unknown>;

async function schoolTimezone(c: Container, schoolId: string) {
  const [s] = await withTenant(c.app.db, { schoolId, accountId: null, roles: [] }, (tx) => tx.select({ tz: schools.timezone }).from(schools).where(eq(schools.id, schoolId)));
  return s?.tz ?? 'Asia/Karachi';
}

/**
 * Every background job re-establishes tenant context from its payload and calls the same business
 * services the API uses. Failures are retried with backoff and then land in the dead-letter queue.
 */
export function handlers(c: Container): { [K in QueueKey]: Handler<K> } {
  return {
    accountProvision: async ({ schoolId, accountId }) => {
      const result = await c.accounts.provisionImported(systemActor(schoolId, await schoolTimezone(c, schoolId)), accountId);
      if (!result.ok) throw new Error(result.error);
    },

    fileScan: async ({ schoolId, fileId }) => {
      const actor = systemActor(schoolId);
      const [file] = await withTenant(c.app.db, { schoolId, accountId: null, roles: [] }, (tx) => tx.select().from(files).where(eq(files.id, fileId)));
      if (!file || file.lifecycle !== 'quarantine') return;
      if (!c.config.CLAMAV_HOST) {
        if (c.config.isProduction || !c.config.SKIP_MALWARE_SCAN) throw new Error('No malware scanner configured (set CLAMAV_HOST)');
        await c.files.recordScan(actor, fileId, 'clean');
        return;
      }
      const body = await c.storage.read(file.objectKey);
      const verdict = await scanWithClamav(c.config.CLAMAV_HOST, c.config.CLAMAV_PORT, body);
      await c.files.recordScan(actor, fileId, verdict);
    },

    notificationDeliver: async ({ schoolId, notificationId }) => {
      await c.push.deliver(schoolId, notificationId);
    },

    notificationReceipts: async () => {
      for (const schoolId of await c.operations.activeSchoolIds()) {
        await c.push.checkReceipts(schoolId);
        for (const id of await c.push.failedNotificationIds(schoolId)) {
          await c.jobs.send('notificationDeliver', { schoolId, notificationId: id }, { singletonKey: `retry:${id}` });
        }
      }
    },

    importCommit: async ({ schoolId, batchId, accountId }) => {
      const actor = await actorForAccount(c.app.db, schoolId, accountId, `import:${batchId}`);
      try {
        await c.imports.commit(actor, batchId);
      } catch (e) {
        await c.imports.markFailed(actor, batchId, e instanceof Error ? e.message : 'Import failed');
        throw e;
      }
    },

    reportGenerate: async ({ schoolId, reportJobId }, jobId) => {
      const [job] = await c.app.db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.school_id', ${schoolId}, true)`);
        return tx.execute<{ requested_by_account_id: string }>(sql`select requested_by_account_id from app.report_jobs where id = ${reportJobId}`);
      });
      if (!job) return;
      const actor = await actorForAccount(c.app.db, schoolId, job.requested_by_account_id, `report:${jobId}`);
      await c.reports.generate(actor, reportJobId);
    },

    feeReminders: async () => {
      for (const schoolId of await c.operations.activeSchoolIds()) {
        const tz = await schoolTimezone(c, schoolId);
        const actor = systemActor(schoolId, tz);
        const [policy] = await withTenant(c.app.db, { schoolId, accountId: null, roles: ['school_admin'] }, (tx) => tx.select().from(schoolPolicies));
        if (policy?.notifications.feeReminderMode !== 'scheduled' || !policy.notifications.feeReminderDaysAfterDue.length) continue;
        const date = todayIn(tz);
        const candidates = await c.fees.reminderPreview(actor, { overdueOnly: true });
        const due = candidates.filter((x) => {
          if (!x.oldestDueDate) return false;
          const days = Math.round((Date.parse(date) - Date.parse(x.oldestDueDate)) / 86_400_000);
          return policy.notifications.feeReminderDaysAfterDue.includes(days);
        });
        if (due.length) await c.fees.sendReminders(actor, due.map((x) => x.studentId));
      }
    },

    retentionProcess: async () => {
      for (const schoolId of await c.operations.activeSchoolIds()) await c.operations.processDeletions(schoolId);
    },

    maintenance: async () => {
      for (const schoolId of await c.operations.activeSchoolIds()) await c.operations.maintenance(schoolId);
    },
  };
}

export async function startWorkers(c: Container, log: (msg: string, extra?: object) => void) {
  const h = handlers(c);
  for (const key of Object.keys(queues) as QueueKey[]) {
    const def = queues[key];
    await c.jobs.boss.work<JobPayloads[typeof key]>(def.name, { batchSize: 1, localConcurrency: key === 'reportGenerate' ? 2 : 4 }, async (jobs) => {
      for (const job of jobs) {
        const started = Date.now();
        try {
          await (h[key] as Handler<typeof key>)(job.data, job.id);
          log('job completed', { queue: def.name, id: job.id, ms: Date.now() - started });
        } catch (e) {
          log('job failed', { queue: def.name, id: job.id, error: e instanceof Error ? e.message : String(e) });
          throw e;
        }
      }
    });
  }
}
