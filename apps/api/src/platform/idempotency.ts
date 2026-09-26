import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { idempotencyRecords } from '../db/schema';
import type { Actor } from './actor';
import { AppError } from './errors';

export interface StoredResponse<T> {
  status: number;
  body: T;
  replayed: boolean;
}

export const hashRequest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex');

/**
 * Runs `fn` at most once per (account, scope, key). The record is written in the SAME transaction
 * as the business change: a concurrent duplicate waits on the unique index, then replays the
 * committed response; if the first attempt rolls back, the retry simply executes.
 */
export async function withIdempotency<T>(
  tx: Tx,
  actor: Actor,
  scope: string,
  key: string | undefined,
  request: unknown,
  fn: () => Promise<{ status: number; body: T }>,
): Promise<StoredResponse<T>> {
  if (!key) {
    const result = await fn();
    return { ...result, replayed: false };
  }
  if (key.length < 8 || key.length > 128) {
    throw new AppError('bad_request', 'Idempotency-Key must be 8–128 characters');
  }
  const requestHash = hashRequest(request);
  const inserted = await tx
    .insert(idempotencyRecords)
    .values({
      schoolId: actor.schoolId,
      accountId: actor.accountId,
      scope,
      key,
      requestHash,
      expiresAt: sql`now() + interval '7 days'`,
    })
    .onConflictDoNothing()
    .returning({ id: idempotencyRecords.id });

  if (inserted.length === 0) {
    const [existing] = await tx
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.schoolId, actor.schoolId),
          eq(idempotencyRecords.accountId, actor.accountId),
          eq(idempotencyRecords.scope, scope),
          eq(idempotencyRecords.key, key),
        ),
      );
    if (!existing || existing.requestHash !== requestHash) {
      throw new AppError('idempotency_conflict', 'This Idempotency-Key was already used for a different request');
    }
    if (existing.completedAt === null || existing.responseStatus === null) {
      throw new AppError('idempotency_conflict', 'The original request is still being processed');
    }
    return { status: existing.responseStatus, body: existing.responseBody as T, replayed: true };
  }

  const result = await fn();
  await tx
    .update(idempotencyRecords)
    .set({ responseStatus: result.status, responseBody: result.body as never, completedAt: new Date() })
    .where(eq(idempotencyRecords.id, inserted[0]!.id));
  return { ...result, replayed: false };
}
