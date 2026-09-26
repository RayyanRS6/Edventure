import { and, desc, eq, gt, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { ClientKind, LoginRequest, Me, NextStep, Role, SessionSummary } from '@edventure/contracts';
import { experienceForRole, loginRequest } from '@edventure/contracts';
import type { Db } from '../../db/client';
import { accounts, appSessions, classTeacherAssignments, schools } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { identityEmail, type AuthProvider, type ProviderSession } from '../../auth/provider';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { todayIn } from '../../platform/dates';
import { AppError, errors } from '../../platform/errors';

export interface RequestMeta {
  client: ClientKind;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface ResolvedSession {
  actor: Actor;
  authUserId: string;
  mustChangePassword: boolean;
  mfaRequired: boolean;
  mfaSatisfied: boolean;
}

type SessionRow = {
  app_session_id: string;
  school_id: string;
  account_id: string;
  auth_user_id: string | null;
  session_revoked: boolean;
  mfa_verified_at: string | null;
  last_seen_at: string;
  client: ClientKind;
  account_status: string;
  must_change_password: boolean;
  mfa_required: boolean;
  locale: 'en' | 'ur';
  roles: string[];
  student_id: string | null;
  teacher_id: string | null;
  school_status: string;
  timezone: string;
};

const inactiveMessage: Record<string, string> = {
  pending: 'This account has not been activated yet. Contact the school office.',
  suspended: 'This account is suspended. Contact the school office.',
  disabled: 'This account is disabled. Contact the school office.',
  pending_deletion: 'This account has been removed. Contact the school office.',
};

export class IdentityService {
  constructor(
    private readonly db: Db,
    private readonly auth: AuthProvider,
    private readonly identityDomain: string,
  ) {}

  emailFor(accountId: string) {
    return identityEmail(accountId, this.identityDomain);
  }

  /** School code + username + password → provider session + application session. */
  async login(raw: LoginRequest, meta: RequestMeta) {
    const input = loginRequest.parse(raw);
    const rows = await this.db.execute<{
      account_id: string;
      school_id: string;
      auth_user_id: string | null;
      account_status: string;
      provisioning_state: string;
      school_status: string;
    }>(sql`select * from app.resolve_login(${input.schoolCode}, ${input.username})`);
    const row = rows[0];

    // Always perform a password check so unknown usernames take comparable time.
    const email = this.emailFor(row?.account_id ?? '00000000-0000-0000-0000-000000000000');
    const session = row && row.auth_user_id ? await this.auth.signInWithPassword(email, input.password) : null;
    if (!row || !session) {
      if (!row) await this.auth.signInWithPassword(email, input.password).catch(() => null);
      if (row) {
        await withTenant(this.db, { schoolId: row.school_id, accountId: null, roles: [] }, (tx) =>
          audit(tx, this.systemish(row.school_id, meta), {
            action: 'auth.login_failed',
            entityType: 'account',
            entityId: row.account_id,
          }),
        );
      }
      throw errors.invalidCredentials();
    }
    if (row.school_status !== 'active' || row.account_status !== 'active') {
      await this.auth.signOut(session.accessToken);
      throw new AppError(
        'forbidden',
        row.school_status !== 'active'
          ? 'This school is not currently active on Edventure.'
          : (inactiveMessage[row.account_status] ?? 'This account is not active.'),
      );
    }

    await withTenant(this.db, { schoolId: row.school_id, accountId: row.account_id, roles: [] }, async (tx) => {
      await tx.insert(appSessions).values({
        schoolId: row.school_id,
        accountId: row.account_id,
        authSessionId: session.sessionId,
        client: meta.client,
        deviceName: input.deviceName ?? null,
        platform: input.platform ?? (meta.client === 'web' ? 'web' : null),
        ipAddress: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
        mfaVerifiedAt: session.aal === 'aal2' ? new Date() : null,
      });
      await tx.update(accounts).set({ lastLoginAt: new Date() }).where(eq(accounts.id, row.account_id));
      await audit(tx, this.systemish(row.school_id, meta, row.account_id), {
        action: 'auth.login',
        entityType: 'account',
        entityId: row.account_id,
        summary: { client: meta.client },
      });
    });

    const resolved = await this.resolveProviderSession(session.sessionId, session.authUserId, session.aal, meta);
    const me = await this.me(resolved, session.accessToken);
    return { session, resolved, me: me.me, next: me.next };
  }

  /** Per-request verification: signed token + live application session + active account. */
  async authenticate(accessToken: string, meta: RequestMeta): Promise<ResolvedSession> {
    const verified = await this.auth.verifyAccessToken(accessToken);
    if (!verified) throw errors.unauthenticated('Your session has expired. Please sign in again.');
    return this.resolveProviderSession(verified.sessionId, verified.authUserId, verified.aal, meta);
  }

  async resolveProviderSession(providerSessionId: string, authUserId: string, aal: 'aal1' | 'aal2', meta: RequestMeta): Promise<ResolvedSession> {
    const rows = await this.db.execute<SessionRow>(sql`select * from app.resolve_session(${providerSessionId})`);
    const row = rows[0];
    if (!row || row.session_revoked || row.auth_user_id !== authUserId) throw errors.sessionRevoked();
    if (row.account_status !== 'active' || row.school_status !== 'active') {
      throw errors.sessionRevoked(inactiveMessage[row.account_status] ?? 'Your account is not active.');
    }
    const actor: Actor = {
      requestId: meta.requestId,
      ip: meta.ip,
      schoolId: row.school_id,
      accountId: row.account_id,
      appSessionId: row.app_session_id,
      authSessionId: providerSessionId,
      roles: row.roles as Role[],
      studentId: row.student_id,
      teacherId: row.teacher_id,
      locale: row.locale,
      timezone: row.timezone,
      client: row.client,
    };
    if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1000) {
      void withTenant(this.db, tenantOf(actor), (tx) =>
        tx.update(appSessions).set({ lastSeenAt: new Date() }).where(eq(appSessions.id, row.app_session_id)),
      ).catch(() => undefined);
    }
    return {
      actor,
      authUserId,
      mustChangePassword: row.must_change_password,
      mfaRequired: row.mfa_required,
      mfaSatisfied: aal === 'aal2' || row.mfa_verified_at !== null,
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const session = await this.auth.refresh(refreshToken);
    if (!session) throw errors.sessionRevoked();
    try {
      await this.resolveProviderSession(session.sessionId, session.authUserId, session.aal, meta);
    } catch (e) {
      await this.auth.signOut(session.accessToken);
      throw e;
    }
    return session;
  }

  async logout(actor: Actor, accessToken: string | null) {
    await withTenant(this.db, tenantOf(actor), async (tx) => {
      await tx
        .update(appSessions)
        .set({ revokedAt: new Date(), revokedReason: 'logout' })
        .where(and(eq(appSessions.id, actor.appSessionId!), isNull(appSessions.revokedAt)));
      await audit(tx, actor, { action: 'auth.logout', entityType: 'account', entityId: actor.accountId });
    });
    if (accessToken) await this.auth.signOut(accessToken);
  }

  async me(resolved: ResolvedSession, accessToken: string | null): Promise<{ me: Me; next: NextStep }> {
    const { actor } = resolved;
    const today = todayIn(actor.timezone);
    const data = await withTenant(this.db, tenantOf(actor), async (tx) => {
      const [account] = await tx.select().from(accounts).where(eq(accounts.id, actor.accountId));
      const [school] = await tx.select().from(schools).where(eq(schools.id, actor.schoolId));
      const sections = actor.teacherId
        ? await tx
            .select({ sectionId: classTeacherAssignments.sectionId })
            .from(classTeacherAssignments)
            .where(
              and(
                eq(classTeacherAssignments.teacherId, actor.teacherId),
                lte(classTeacherAssignments.startDate, today),
                or(isNull(classTeacherAssignments.endDate), gt(classTeacherAssignments.endDate, today)),
              ),
            )
        : [];
      return { account: account!, school: school!, sections };
    });

    let mfaEnrolled = false;
    if (resolved.mfaRequired && accessToken) {
      const factors = await this.auth.mfaFactors(accessToken, resolved.authUserId).catch(() => []);
      mfaEnrolled = factors.some((f) => f.verified);
    }
    const me: Me = {
      accountId: actor.accountId,
      username: data.account.username,
      displayName: data.account.displayName,
      displayNameUr: data.account.displayNameUr,
      locale: data.account.locale,
      roles: actor.roles,
      experiences: [...new Set(actor.roles.map((r) => experienceForRole[r]))],
      school: {
        id: data.school.id,
        code: data.school.code,
        name: data.school.name,
        nameUr: data.school.nameUr,
        timezone: data.school.timezone,
        currency: data.school.currency,
        defaultLocale: data.school.defaultLocale,
      },
      studentId: actor.studentId,
      teacherId: actor.teacherId,
      classTeacherSectionIds: data.sections.map((s) => s.sectionId),
      mustChangePassword: resolved.mustChangePassword,
      mfa: { required: resolved.mfaRequired, enrolled: mfaEnrolled, verified: resolved.mfaSatisfied },
      sessionId: actor.appSessionId!,
    };
    return { me, next: nextStep(resolved, mfaEnrolled) };
  }

  async changePassword(resolved: ResolvedSession, currentPassword: string, newPassword: string) {
    const { actor } = resolved;
    const check = await this.auth.signInWithPassword(this.emailFor(actor.accountId), currentPassword);
    if (!check) throw errors.field('currentPassword', 'Your current password is incorrect');
    await this.auth.signOut(check.accessToken);
    if (currentPassword === newPassword) throw errors.field('newPassword', 'Choose a password you have not just used');
    await this.auth.setPassword(resolved.authUserId, newPassword);
    await withTenant(this.db, tenantOf(actor), async (tx) => {
      await tx
        .update(accounts)
        .set({ mustChangePassword: false, version: sql`${accounts.version} + 1` })
        .where(eq(accounts.id, actor.accountId));
      // Other devices must sign in again with the new password.
      await tx
        .update(appSessions)
        .set({ revokedAt: new Date(), revokedReason: 'password_changed' })
        .where(and(eq(appSessions.accountId, actor.accountId), ne(appSessions.id, actor.appSessionId!), isNull(appSessions.revokedAt)));
      await audit(tx, actor, { action: 'auth.password_changed', entityType: 'account', entityId: actor.accountId });
    });
  }

  async mfaEnroll(resolved: ResolvedSession, accessToken: string) {
    const [account] = await withTenant(this.db, tenantOf(resolved.actor), (tx) =>
      tx.select({ username: accounts.username }).from(accounts).where(eq(accounts.id, resolved.actor.accountId)),
    );
    return this.auth.mfaEnroll(accessToken, resolved.authUserId, account?.username ?? 'account');
  }

  async mfaVerify(resolved: ResolvedSession, accessToken: string, code: string, factorId?: string): Promise<ProviderSession> {
    let id = factorId;
    if (!id) {
      const factors = await this.auth.mfaFactors(accessToken, resolved.authUserId);
      id = (factors.find((f) => f.verified) ?? factors[factors.length - 1])?.id;
    }
    if (!id) throw errors.rule('Set up an authenticator app first');
    const session = await this.auth.mfaVerify(accessToken, resolved.authUserId, id, code);
    if (!session) throw errors.field('code', 'That code is not valid. Check the time on your device and try again.');
    await withTenant(this.db, tenantOf(resolved.actor), async (tx) => {
      await tx
        .update(appSessions)
        .set({ mfaVerifiedAt: new Date(), authSessionId: session.sessionId })
        .where(eq(appSessions.id, resolved.actor.appSessionId!));
      await audit(tx, resolved.actor, { action: 'auth.mfa_verified', entityType: 'account', entityId: resolved.actor.accountId });
    });
    return session;
  }

  async listSessions(actor: Actor): Promise<SessionSummary[]> {
    const rows = await withTenant(this.db, tenantOf(actor), (tx) =>
      tx
        .select()
        .from(appSessions)
        .where(and(eq(appSessions.accountId, actor.accountId), isNull(appSessions.revokedAt)))
        .orderBy(desc(appSessions.lastSeenAt)),
    );
    return rows.map((s) => ({
      id: s.id,
      client: s.client,
      deviceName: s.deviceName,
      platform: s.platform,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      current: s.id === actor.appSessionId,
    }));
  }

  async revokeSession(actor: Actor, sessionId: string) {
    await withTenant(this.db, tenantOf(actor), async (tx) => {
      const rows = await tx
        .update(appSessions)
        .set({ revokedAt: new Date(), revokedReason: 'revoked_by_user' })
        .where(and(eq(appSessions.id, sessionId), eq(appSessions.accountId, actor.accountId), isNull(appSessions.revokedAt)))
        .returning({ id: appSessions.id });
      if (rows.length === 0) throw errors.notFound('Session');
      await audit(tx, actor, { action: 'auth.session_revoked', entityType: 'app_session', entityId: sessionId });
    });
  }

  async updatePreferences(actor: Actor, locale: 'en' | 'ur' | undefined) {
    if (!locale) return;
    await withTenant(this.db, tenantOf(actor), (tx) =>
      tx.update(accounts).set({ locale }).where(eq(accounts.id, actor.accountId)),
    );
  }

  private systemish(schoolId: string, meta: RequestMeta, accountId?: string): Actor {
    return {
      requestId: meta.requestId,
      ip: meta.ip,
      schoolId,
      accountId: accountId ?? '00000000-0000-0000-0000-000000000000',
      appSessionId: null,
      authSessionId: null,
      roles: [],
      studentId: null,
      teacherId: null,
      locale: 'en',
      timezone: 'Asia/Karachi',
      client: accountId ? meta.client : 'system',
    };
  }
}

export function nextStep(resolved: Pick<ResolvedSession, 'mustChangePassword' | 'mfaRequired' | 'mfaSatisfied'>, mfaEnrolled: boolean): NextStep {
  if (resolved.mustChangePassword) return 'change_password';
  if (resolved.mfaRequired && !resolved.mfaSatisfied) return mfaEnrolled ? 'mfa_verify' : 'mfa_enroll';
  return 'ready';
}
