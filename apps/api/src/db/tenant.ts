import { sql } from 'drizzle-orm';
import type { Role } from '@edventure/contracts';
import type { Db, Tx } from './client';

export interface TenantContext {
  schoolId: string;
  accountId: string | null;
  roles: readonly Role[];
}

export type IsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

/**
 * Runs `fn` in a transaction whose tenant context is set with `set_config(..., is_local => true)`.
 * The settings vanish at commit/rollback, so pooled connections never carry another request's
 * tenant. Row-level security policies read these settings; missing context denies access.
 */
export async function withTenant<T>(
  db: Db,
  ctx: TenantContext,
  fn: (tx: Tx) => Promise<T>,
  options: { isolation?: IsolationLevel; readOnly?: boolean } = {},
): Promise<T> {
  return db.transaction(
    async (tx) => {
      await setTenant(tx, ctx);
      return fn(tx);
    },
    {
      isolationLevel: options.isolation ?? 'read committed',
      accessMode: options.readOnly ? 'read only' : 'read write',
    },
  );
}

export async function setTenant(tx: Tx, ctx: TenantContext) {
  await tx.execute(sql`select
    set_config('app.school_id', ${ctx.schoolId}, true),
    set_config('app.account_id', ${ctx.accountId ?? ''}, true),
    set_config('app.roles', ${ctx.roles.join(',')}, true)`);
}
