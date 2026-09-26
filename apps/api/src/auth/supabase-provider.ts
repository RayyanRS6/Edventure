import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';
import type { AuthProvider, MfaEnrollment, ProviderSession, VerifiedAccessToken } from './provider';

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/**
 * Supabase Auth adapter. Public sign-up must be disabled in the Supabase project; identities are
 * created only here, server-side, with the service-role key (which never leaves the backend).
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly kind = 'supabase' as const;
  private readonly admin: SupabaseClient;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly url: string,
    serviceRoleKey: string,
    private readonly anonKey: string,
    private readonly issuer = `${url.replace(/\/$/, '')}/auth/v1`,
  ) {
    this.admin = createClient(url, serviceRoleKey, clientOptions);
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async init() {}
  async close() {}

  private anon() {
    return createClient(this.url, this.anonKey, clientOptions);
  }

  async createIdentity(input: { id: string; email: string; password: string; metadata: Record<string, string> }) {
    const existing = await this.admin.auth.admin.getUserById(input.id);
    if (existing.data.user) {
      await this.setPassword(input.id, input.password);
      return { authUserId: input.id };
    }
    const { data, error } = await this.admin.auth.admin.createUser({
      id: input.id,
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: input.metadata,
    });
    if (error || !data.user) throw new Error(`Supabase createUser failed: ${error?.message ?? 'no user returned'}`);
    return { authUserId: data.user.id };
  }

  async setPassword(authUserId: string, password: string) {
    const { error } = await this.admin.auth.admin.updateUserById(authUserId, { password });
    if (error) throw new Error(`Supabase password update failed: ${error.message}`);
  }

  async setDisabled(authUserId: string, disabled: boolean) {
    const { error } = await this.admin.auth.admin.updateUserById(authUserId, { ban_duration: disabled ? '876000h' : 'none' });
    if (error) throw new Error(`Supabase ban update failed: ${error.message}`);
  }

  async deleteIdentity(authUserId: string) {
    const { error } = await this.admin.auth.admin.deleteUser(authUserId);
    if (error && !/not found/i.test(error.message)) throw new Error(`Supabase deleteUser failed: ${error.message}`);
  }

  async signInWithPassword(email: string, password: string) {
    const { data, error } = await this.anon().auth.signInWithPassword({ email, password });
    if (error || !data.session) return null;
    return this.toSession(data.session);
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.anon().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return null;
    return this.toSession(data.session);
  }

  async verifyAccessToken(token: string): Promise<VerifiedAccessToken | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer, audience: 'authenticated' });
      return this.claims(payload);
    } catch {
      return null;
    }
  }

  async signOut(accessToken: string) {
    await this.admin.auth.admin.signOut(accessToken, 'local').catch(() => undefined);
  }

  async mfaFactors(accessToken: string) {
    const user = await this.rest<{ factors?: Array<{ id: string; status: string; factor_type: string }> }>('GET', '/user', accessToken);
    return (user.factors ?? []).filter((f) => f.factor_type === 'totp').map((f) => ({ id: f.id, verified: f.status === 'verified' }));
  }

  async mfaEnroll(accessToken: string, _authUserId: string, label: string): Promise<MfaEnrollment> {
    const res = await this.rest<{ id: string; totp: { secret: string; uri: string } }>('POST', '/factors', accessToken, {
      factor_type: 'totp',
      friendly_name: `${label}-${Date.now()}`,
    });
    return { factorId: res.id, otpauthUri: res.totp.uri, secret: res.totp.secret };
  }

  async mfaVerify(accessToken: string, _authUserId: string, factorId: string, code: string) {
    try {
      const challenge = await this.rest<{ id: string }>('POST', `/factors/${factorId}/challenge`, accessToken, {});
      const session = await this.rest<Session>('POST', `/factors/${factorId}/verify`, accessToken, {
        challenge_id: challenge.id,
        code,
      });
      return this.toSession(session);
    } catch {
      return null;
    }
  }

  private async rest<T>(method: string, path: string, accessToken: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.issuer}${path}`, {
      method,
      headers: { apikey: this.anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase auth ${method} ${path} failed with ${res.status}`);
    return (await res.json()) as T;
  }

  private claims(payload: JWTPayload): VerifiedAccessToken | null {
    const sessionId = payload['session_id'];
    if (typeof payload.sub !== 'string' || typeof sessionId !== 'string' || typeof payload.exp !== 'number') return null;
    return {
      authUserId: payload.sub,
      sessionId,
      aal: payload['aal'] === 'aal2' ? 'aal2' : 'aal1',
      expiresAt: new Date(payload.exp * 1000),
    };
  }

  private toSession(session: Session): ProviderSession {
    const claims = this.claims(decodeJwt(session.access_token));
    if (!claims) throw new Error('Supabase session is missing required claims');
    return {
      authUserId: claims.authUserId,
      sessionId: claims.sessionId,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: claims.expiresAt,
      aal: claims.aal,
    };
  }
}
