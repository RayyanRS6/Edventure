import { PgBoss } from 'pg-boss';
import postgres from 'postgres';
import { DEAD_LETTER_QUEUE, queues, schedules } from './queues';

export const JOB_SCHEMA = 'pgboss';

/**
 * Installs/migrates the pg-boss schema with the owner connection, creates every queue, registers
 * schedules, and grants the application role exactly what it needs to enqueue jobs inside its
 * own business transactions (the durable outbox): SELECT/INSERT, never UPDATE/DELETE.
 */
export async function ensureJobSchema(ownerUrl: string) {
  const boss = new PgBoss({
    connectionString: ownerUrl,
    schema: JOB_SCHEMA,
    max: 2,
    supervise: false,
    schedule: false,
    migrate: true,
    createSchema: true,
    application_name: 'edventure-migrate',
  });
  boss.on('error', (err) => console.error('[pg-boss]', err));
  await boss.start();
  try {
    const existing = new Set((await boss.getQueues()).map((q) => q.name));
    if (!existing.has(DEAD_LETTER_QUEUE)) await boss.createQueue(DEAD_LETTER_QUEUE, { retentionSeconds: 14 * 24 * 3600 });
    for (const def of Object.values(queues)) {
      const options = {
        retryLimit: def.retryLimit,
        retryDelay: def.retryDelay,
        retryBackoff: def.retryBackoff,
        expireInSeconds: def.expireInSeconds,
        deadLetter: DEAD_LETTER_QUEUE,
      };
      if (existing.has(def.name)) await boss.updateQueue(def.name, options);
      else await boss.createQueue(def.name, options);
    }
    for (const s of schedules) {
      await boss.schedule(queues[s.key].name, s.cron, {}, { tz: 'UTC' });
    }
  } finally {
    await boss.stop({ graceful: false, close: true });
  }

  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`
      GRANT USAGE ON SCHEMA ${JOB_SCHEMA} TO edventure_app;
      GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ${JOB_SCHEMA} TO edventure_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${JOB_SCHEMA} TO edventure_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${JOB_SCHEMA} GRANT SELECT, INSERT ON TABLES TO edventure_app;
    `).simple();
  } finally {
    await sql.end({ timeout: 5 });
  }
}
