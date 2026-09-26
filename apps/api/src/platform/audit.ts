import type { Tx } from '../db/client';
import { auditEvents } from '../db/schema';
import { NIL_ACCOUNT, type Actor } from './actor';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Keep summaries free of secrets and sensitive values (passwords, tokens, salary amounts, marks). */
  summary?: Record<string, unknown>;
  reason?: string | null;
}

/** Appends an audit event in the same transaction as the change it describes. */
export async function audit(tx: Tx, actor: Actor, entry: AuditEntry) {
  await tx.insert(auditEvents).values({
    schoolId: actor.schoolId,
    actorAccountId: actor.accountId === NIL_ACCOUNT ? null : actor.accountId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary ?? {},
    reason: entry.reason ?? null,
    requestId: actor.requestId,
    ipAddress: actor.ip,
  });
}
