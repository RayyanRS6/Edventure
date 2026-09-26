import { sql } from 'drizzle-orm';
import { fromDrizzle, PgBoss } from 'pg-boss';
import type { Tx } from '../db/client';
import { JOB_SCHEMA } from './schema';
import { queues, type JobPayloads, type QueueKey } from './queues';

export interface EnqueueOptions {
  startAfter?: Date | number;
  /** Deduplicates queued jobs with the same key. */
  singletonKey?: string;
}

/**
 * Thin wrapper over pg-boss. `enqueue` inserts the job with the caller's open transaction, so the
 * job exists if and only if the business change commits (durable outbox, no second broker).
 */
export class JobQueue {
  readonly boss: PgBoss;
  private started = false;

  constructor(connectionString: string, options: { role: 'producer' | 'worker'; max?: number }) {
    const worker = options.role === 'worker';
    this.boss = new PgBoss({
      connectionString,
      schema: JOB_SCHEMA,
      max: options.max ?? (worker ? 6 : 2),
      application_name: worker ? 'edventure-worker' : 'edventure-api-jobs',
      migrate: false,
      createSchema: false,
      supervise: worker,
      schedule: worker,
    });
    this.boss.on('error', (err) => console.error('[jobs]', err));
  }

  async start() {
    if (this.started) return;
    await this.boss.start();
    this.started = true;
  }

  async stop() {
    if (!this.started) return;
    this.started = false;
    await this.boss.stop({ graceful: true, close: true, timeout: 10_000 });
  }

  async enqueue<K extends QueueKey>(tx: Tx, key: K, data: JobPayloads[K], options: EnqueueOptions = {}) {
    return this.boss.send(queues[key].name, data as object, {
      db: fromDrizzle(tx as never, sql as never),
      startAfter: options.startAfter,
      singletonKey: options.singletonKey,
    });
  }

  /** Outside a business transaction (e.g. operator-triggered retries). */
  async send<K extends QueueKey>(key: K, data: JobPayloads[K], options: EnqueueOptions = {}) {
    return this.boss.send(queues[key].name, data as object, {
      startAfter: options.startAfter,
      singletonKey: options.singletonKey,
    });
  }
}
