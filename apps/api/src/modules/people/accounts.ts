import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AccountSummary, IssuedCredential, Role } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import { accountRoles, accounts, appSessions } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { identityEmail, type AuthProvider } from '../../auth/provider';
import { generateTemporaryPassword, generateUnusablePassword } from '../../auth/passwords';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';

export interface NewAccount {
  username: string;
  displayName: string;
  displayNameUr?: string | null;
  roles: Role[];
  locale?: 'en' | 'ur';
}

type AccountRow = typeof accounts.$inferSelect;

export function toAccountSummary(a: AccountRow, roles: Role[]): AccountSummary {
  return {
    id: a.id,
    username: a.username,
    displayName: a.displayName,
    displayNameUr: a.displayNameUr,
    status: a.status,
    provisioningState: a.provisioningState,
    provisioningError: a.provisioningError,
    roles,
    mustChangePassword: a.mustChangePassword,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    version: a.version,
  };
}

/**
 * Account lifecycle: create (pending) → provision auth identity (retryable) → activate → issue
 * temporary credentials. Provider calls cannot share the database transaction, so each step
 * records its state and a failure stays visible instead of producing a falsely active account.
 */
export class AccountService {
  constructor(
    private readonly db: Db,
    private readonly auth: AuthProvider,
    private readonly identityDomain: string,
  ) {}

  /** Inserts a pending account and its roles inside the caller's transaction. */
  async createPending(tx: Tx, actor: Actor, input: NewAccount): Promise<AccountRow> {
    const [account] = await tx
      .insert(accounts)
      .values({
        schoolId: actor.schoolId,
        username: input.username.toLowerCase(),
        displayName: input.displayName,
        displayNameUr: input.displayNameUr ?? null,
        locale: input.locale ?? 'en',
        status: 'pending',
        provisioningState: 'pending',
        mustChangePassword: true,
        mfaRequired: input.roles.includes('school_admin'),
      })
      .returning();
    await tx.insert(accountRoles).values(
      [...new Set(input.roles)].map((role) => ({
        schoolId: actor.schoolId,
        accountId: account!.id,
        role,
        grantedByAccountId: actor.client === 'system' ? null : actor.accountId,
      })),
    );
    return account!;
  }

  async rolesOf(tx: Tx, accountIds: string[]): Promise<Map<string, Role[]>> {
    const map = new Map<string, Role[]>();
    if (accountIds.length === 0) return map;
    const rows = await tx
      .select({ accountId: accountRoles.accountId, role: accountRoles.role })
      .from(accountRoles)
      .where(and(inArray(accountRoles.accountId, accountIds), isNull(accountRoles.revokedAt)));
    for (const r of rows) map.set(r.accountId, [...(map.get(r.accountId) ?? []), r.role]);
    return map;
  }

  async summary(tx: Tx, accountId: string): Promise<AccountSummary> {
    const [a] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
    const roles = await this.rolesOf(tx, [accountId]);
    return toAccountSummary(required(a, 'Account'), roles.get(accountId) ?? []);
  }

  /**
   * Provisions the auth identity with the given password. When `activate` is set the account
   * becomes active (single creation / credential issue); bulk imports provision without activating.
   */
  async provision(actor: Actor, accountId: string, password: string, activate: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
    const ctx = tenantOf(actor);
    const account = await withTenant(this.db, ctx, async (tx) => {
      const [row] = await tx
        .update(accounts)
        .set({ provisioningState: 'provisioning', provisioningAttempts: sql`${accounts.provisioningAttempts} + 1` })
        .where(eq(accounts.id, accountId))
        .returning();
      return required(row, 'Account');
    });
    try {
      const { authUserId } = await this.auth.createIdentity({
        id: account.id,
        email: identityEmail(account.id, this.identityDomain),
        password,
        metadata: { school_id: account.schoolId, account_id: account.id },
      });
      await withTenant(this.db, ctx, async (tx) => {
        await tx
          .update(accounts)
          .set({
            authUserId,
            provisioningState: 'provisioned',
            provisioningError: null,
            mustChangePassword: true,
            ...(activate && account.status === 'pending' ? { status: 'active' as const, statusChangedAt: new Date() } : {}),
            version: sql`${accounts.version} + 1`,
          })
          .where(eq(accounts.id, accountId));
        await audit(tx, actor, { action: 'account.provisioned', entityType: 'account', entityId: accountId, summary: { activated: activate } });
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown provisioning error';
      await withTenant(this.db, ctx, async (tx) => {
        await tx
          .update(accounts)
          .set({ provisioningState: 'failed', provisioningError: message })
          .where(eq(accounts.id, accountId));
        await audit(tx, actor, { action: 'account.provisioning_failed', entityType: 'account', entityId: accountId });
      });
      return { ok: false, error: 'Sign-in could not be set up for this account yet. Use “Retry setup” to try again.' };
    }
  }

  /** Background provisioning for imported accounts (unusable password, not activated). */
  async provisionImported(actor: Actor, accountId: string) {
    return this.provision(actor, accountId, generateUnusablePassword(), false);
  }

  /**
   * Issues a new temporary password (activating pending accounts). The password is returned once
   * and never stored. Every existing session for the account is revoked immediately.
   */
  async issueCredential(actor: Actor, accountId: string): Promise<IssuedCredential> {
    const ctx = tenantOf(actor);
    const account = await withTenant(this.db, ctx, async (tx) => {
      const [row] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
      return required(row, 'Account');
    });
    if (account.status === 'pending_deletion' || account.status === 'disabled') {
      throw errors.rule('Restore or re-enable this account before issuing new credentials.');
    }
    const password = generateTemporaryPassword();
    if (account.provisioningState !== 'provisioned' || !account.authUserId) {
      const result = await this.provision(actor, accountId, password, true);
      if (!result.ok) throw errors.conflict(result.error);
    } else {
      await this.auth.setPassword(account.authUserId, password);
    }
    await withTenant(this.db, ctx, async (tx) => {
      await tx
        .update(accounts)
        .set({
          mustChangePassword: true,
          ...(account.status === 'pending' ? { status: 'active' as const, statusChangedAt: new Date() } : {}),
          version: sql`${accounts.version} + 1`,
        })
        .where(eq(accounts.id, accountId));
      await this.revokeSessions(tx, accountId, 'credentials_reset');
      await audit(tx, actor, { action: 'account.credentials_issued', entityType: 'account', entityId: accountId });
    });
    return { accountId, username: account.username, displayName: account.displayName, temporaryPassword: password };
  }

  async revokeSessions(tx: Tx, accountId: string, reason: string) {
    await tx
      .update(appSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(appSessions.accountId, accountId), isNull(appSessions.revokedAt)));
  }

  /** Suspends app access. Enrollment, fees and disciplinary records are unaffected. */
  async suspend(actor: Actor, accountId: string, reason: string) {
    if (accountId === actor.accountId) throw errors.rule('You cannot suspend your own account.');
    const account = await withTenant(this.db, tenantOf(actor), async (tx) => {
      const [row] = await tx
        .update(accounts)
        .set({ status: 'suspended', statusReason: reason, statusChangedAt: new Date(), version: sql`${accounts.version} + 1` })
        .where(and(eq(accounts.id, accountId), inArray(accounts.status, ['active', 'pending'])))
        .returning();
      if (!row) throw errors.rule('Only active or pending accounts can be suspended.');
      await this.revokeSessions(tx, accountId, 'suspended');
      await audit(tx, actor, { action: 'account.suspended', entityType: 'account', entityId: accountId, reason });
      return row;
    });
    if (account.authUserId) await this.auth.setDisabled(account.authUserId, true).catch(() => undefined);
  }

  async reactivate(actor: Actor, accountId: string, reason: string) {
    const account = await withTenant(this.db, tenantOf(actor), async (tx) => {
      const [row] = await tx
        .update(accounts)
        .set({ status: 'active', statusReason: reason, statusChangedAt: new Date(), version: sql`${accounts.version} + 1` })
        .where(and(eq(accounts.id, accountId), inArray(accounts.status, ['suspended', 'disabled'])))
        .returning();
      if (!row) throw errors.rule('Only suspended or disabled accounts can be reactivated.');
      await audit(tx, actor, { action: 'account.reactivated', entityType: 'account', entityId: accountId, reason });
      return row;
    });
    if (account.authUserId) await this.auth.setDisabled(account.authUserId, false).catch(() => undefined);
  }

  async setRoles(actor: Actor, accountId: string, roles: Role[], version: number) {
    const unique = [...new Set(roles)];
    await withTenant(this.db, tenantOf(actor), async (tx) => {
      const [account] = await tx
        .update(accounts)
        .set({ version: sql`${accounts.version} + 1`, mfaRequired: unique.includes('school_admin') })
        .where(and(eq(accounts.id, accountId), eq(accounts.version, version)))
        .returning();
      if (!account) throw errors.version();
      if (accountId === actor.accountId && !unique.includes('school_admin')) {
        throw errors.rule('You cannot remove your own administrator role.');
      }
      const current = (await this.rolesOf(tx, [accountId])).get(accountId) ?? [];
      const toRevoke = current.filter((r) => !unique.includes(r));
      const toGrant = unique.filter((r) => !current.includes(r));
      if (toRevoke.length) {
        await tx
          .update(accountRoles)
          .set({ revokedAt: new Date() })
          .where(and(eq(accountRoles.accountId, accountId), inArray(accountRoles.role, toRevoke), isNull(accountRoles.revokedAt)));
      }
      if (toGrant.length) {
        await tx.insert(accountRoles).values(
          toGrant.map((role) => ({ schoolId: actor.schoolId, accountId, role, grantedByAccountId: actor.accountId })),
        );
      }
      await audit(tx, actor, {
        action: 'account.roles_changed',
        entityType: 'account',
        entityId: accountId,
        summary: { granted: toGrant, revoked: toRevoke },
      });
    });
  }
}
