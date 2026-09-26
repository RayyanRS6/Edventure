/**
 * DEVELOPMENT/TEST ONLY stand-in for Supabase Auth so the platform runs without external services.
 * It lives in its own `auth_local` schema, never in `app`, and `readConfig` refuses it in production.
 */
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import postgres from 'postgres';
import { compactVerify, jwtVerify, SignJWT } from 'jose';
import * as OTPAuth from 'otpauth';
import type { AuthProvider, MfaEnrollment, ProviderSession, VerifiedAccessToken } from './provider';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const ISSUER = 'edventure-local-auth';
const REFRESH_TTL_DAYS = 30;
const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86);

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length || 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export class LocalAuthProvider implements AuthProvider {
  readonly kind = 'local' as const;
  private readonly sql: postgres.Sql;
  private readonly key: Uint8Array;

  constructor(
    ownerUrl: string,
    secret: string,
    private readonly accessTtlSeconds = 15 * 60,
  ) {
    this.sql = postgres(ownerUrl, { max: 3, onnotice: () => {}, prepare: false });
    this.key = new TextEncoder().encode(secret);
  }

  async init() {
    await this.sql.unsafe(`
      create schema if not exists auth_local;
      revoke all on schema auth_local from public;
      create table if not exists auth_local.users (
        id uuid primary key,
        email text not null unique,
        password_hash text not null,
        disabled boolean not null default false,
        metadata jsonb not null default '{}',
        created_at timestamptz not null default now()
      );
      create table if not exists auth_local.sessions (
        id uuid primary key,
        user_id uuid not null references auth_local.users(id) on delete cascade,
        refresh_hash text not null,
        aal text not null default 'aal1',
        created_at timestamptz not null default now(),
        expires_at timestamptz not null,
        revoked_at timestamptz
      );
      create table if not exists auth_local.mfa_factors (
        id uuid primary key,
        user_id uuid not null references auth_local.users(id) on delete cascade,
        secret text not null,
        verified_at timestamptz,
        created_at timestamptz not null default now()
      );
    `).simple();
  }

  async close() {
    await this.sql.end({ timeout: 5 });
  }

  async createIdentity(input: { id: string; email: string; password: string; metadata: Record<string, string> }) {
    await this.sql`insert into auth_local.users (id, email, password_hash, metadata)
      values (${input.id}, ${input.email.toLowerCase()}, ${await hashPassword(input.password)}, ${this.sql.json(input.metadata)})
      on conflict (id) do update set password_hash = excluded.password_hash`;
    return { authUserId: input.id };
  }

  async setPassword(authUserId: string, password: string) {
    const rows = await this.sql`update auth_local.users set password_hash = ${await hashPassword(password)}
      where id = ${authUserId} returning id`;
    if (rows.length === 0) throw new Error('Auth identity not found');
  }

  async setDisabled(authUserId: string, disabled: boolean) {
    await this.sql`update auth_local.users set disabled = ${disabled} where id = ${authUserId}`;
    if (disabled) await this.sql`update auth_local.sessions set revoked_at = now() where user_id = ${authUserId} and revoked_at is null`;
  }

  async deleteIdentity(authUserId: string) {
    await this.sql`delete from auth_local.users where id = ${authUserId}`;
  }

  async signInWithPassword(email: string, password: string): Promise<ProviderSession | null> {
    const [user] = await this.sql<{ id: string; password_hash: string; disabled: boolean }[]>`
      select id, password_hash, disabled from auth_local.users where email = ${email.toLowerCase()}`;
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok || user.disabled) return null;
    return this.createSession(user.id, 'aal1');
  }

  async refresh(refreshToken: string): Promise<ProviderSession | null> {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) return null;
    const [session] = await this.sql<{ id: string; user_id: string; refresh_hash: string; aal: 'aal1' | 'aal2'; expires_at: Date; revoked_at: Date | null; disabled: boolean }[]>`
      select s.id, s.user_id, s.refresh_hash, s.aal, s.expires_at, s.revoked_at, u.disabled
      from auth_local.sessions s join auth_local.users u on u.id = s.user_id where s.id = ${sessionId}`;
    if (!session || session.revoked_at || session.disabled || session.expires_at < new Date()) return null;
    if (session.refresh_hash !== sha256(secret)) {
      // Refresh-token reuse: treat as theft and end the session.
      await this.sql`update auth_local.sessions set revoked_at = now() where id = ${sessionId}`;
      return null;
    }
    return this.rotate(session.id, session.user_id, session.aal);
  }

  async verifyAccessToken(token: string): Promise<VerifiedAccessToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
      return {
        authUserId: payload.sub,
        sessionId: payload.sid,
        aal: payload.aal === 'aal2' ? 'aal2' : 'aal1',
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      return null;
    }
  }

  async signOut(accessToken: string) {
    try {
      const { payload } = await compactVerify(accessToken, this.key);
      const claims = JSON.parse(new TextDecoder().decode(payload)) as { sid?: string };
      if (claims.sid) await this.sql`update auth_local.sessions set revoked_at = now() where id = ${claims.sid}`;
    } catch {
      // Invalid token: nothing to sign out.
    }
  }

  async mfaFactors(_accessToken: string, authUserId: string) {
    const rows = await this.sql<{ id: string; verified_at: Date | null }[]>`
      select id, verified_at from auth_local.mfa_factors where user_id = ${authUserId} order by created_at`;
    return rows.map((r) => ({ id: r.id, verified: r.verified_at !== null }));
  }

  async mfaEnroll(_accessToken: string, authUserId: string, label: string): Promise<MfaEnrollment> {
    await this.sql`delete from auth_local.mfa_factors where user_id = ${authUserId} and verified_at is null`;
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: 'Edventure', label, secret, digits: 6, period: 30, algorithm: 'SHA1' });
    const id = randomUUID();
    await this.sql`insert into auth_local.mfa_factors (id, user_id, secret) values (${id}, ${authUserId}, ${secret.base32})`;
    return { factorId: id, otpauthUri: totp.toString(), secret: secret.base32 };
  }

  async mfaVerify(accessToken: string, authUserId: string, factorId: string, code: string) {
    const verified = await this.verifyAccessToken(accessToken);
    if (!verified || verified.authUserId !== authUserId) return null;
    const [factor] = await this.sql<{ id: string; secret: string }[]>`
      select id, secret from auth_local.mfa_factors where id = ${factorId} and user_id = ${authUserId}`;
    if (!factor) return null;
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(factor.secret), digits: 6, period: 30, algorithm: 'SHA1' });
    if (totp.validate({ token: code, window: 1 }) === null) return null;
    await this.sql`update auth_local.mfa_factors set verified_at = coalesce(verified_at, now()) where id = ${factor.id}`;
    return this.rotate(verified.sessionId, authUserId, 'aal2');
  }

  /** Test helper: current TOTP code for a factor. */
  async currentTotp(factorId: string) {
    const [factor] = await this.sql<{ secret: string }[]>`select secret from auth_local.mfa_factors where id = ${factorId}`;
    return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(factor!.secret), digits: 6, period: 30 }).generate();
  }

  private async createSession(userId: string, aal: 'aal1' | 'aal2') {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    await this.sql`insert into auth_local.sessions (id, user_id, refresh_hash, aal, expires_at)
      values (${id}, ${userId}, ${sha256(secret)}, ${aal}, now() + ${`${REFRESH_TTL_DAYS} days`}::interval)`;
    return this.issue(id, userId, aal, secret);
  }

  private async rotate(sessionId: string, userId: string, aal: 'aal1' | 'aal2') {
    const secret = randomBytes(32).toString('base64url');
    const rows = await this.sql`update auth_local.sessions
      set refresh_hash = ${sha256(secret)}, aal = ${aal}, expires_at = now() + ${`${REFRESH_TTL_DAYS} days`}::interval
      where id = ${sessionId} and revoked_at is null returning id`;
    if (rows.length === 0) return null;
    return this.issue(sessionId, userId, aal, secret);
  }

  private async issue(sessionId: string, userId: string, aal: 'aal1' | 'aal2', refreshSecret: string): Promise<ProviderSession> {
    const expiresAt = new Date(Date.now() + this.accessTtlSeconds * 1000);
    const accessToken = await new SignJWT({ sid: sessionId, aal })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { authUserId: userId, sessionId, accessToken, refreshToken: `${sessionId}.${refreshSecret}`, expiresAt, aal };
  }
}
