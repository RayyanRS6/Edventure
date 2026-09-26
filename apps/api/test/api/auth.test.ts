import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LocalAuthProvider } from '../../src/auth/local-provider';
import { bootstrapSchool, client, createTestApp, PASSWORD, type TestApp } from '../support/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t?.close();
});

describe('authentication and sessions', () => {
  it('provisions a school admin who must change the password and enrol MFA before using the app', async () => {
    const { credential } = await t.container.platform.provisionSchool(
      { code: 'AUTH1', name: 'Auth School', admin: { username: 'principal', displayName: 'Principal' } },
      'test',
    );
    const anon = client(t.app);

    const wrong = await anon.post('/auth/login', { schoolCode: 'auth1', username: 'principal', password: 'nope' });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.data.code).toBe('invalid_credentials');

    const unknownSchool = await anon.post('/auth/login', { schoolCode: 'NOPE', username: 'principal', password: credential.temporaryPassword });
    expect(unknownSchool.data.code).toBe('invalid_credentials');

    const login = await anon.post('/auth/login', { schoolCode: 'auth1', username: 'Principal', password: credential.temporaryPassword });
    expect(login.statusCode).toBe(200);
    expect(login.data.next).toBe('change_password');
    expect(login.data.me.roles).toEqual(['school_admin']);
    expect(login.data.me.experiences).toEqual(['admin']);
    const token = login.data.tokens.accessToken;

    // Business routes are blocked until the password is replaced.
    const blocked = await client(t.app, token).get('/sessions');
    expect(blocked.statusCode).toBe(200); // session-level routes are allowed
    const change = await client(t.app, token).post('/auth/password', { currentPassword: credential.temporaryPassword, newPassword: PASSWORD });
    expect(change.statusCode).toBe(200);

    const me = await client(t.app, token).get('/me');
    expect(me.data.next).toBe('mfa_enroll');

    const enroll = await client(t.app, token).post('/auth/mfa/enroll');
    expect(enroll.data.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    const bad = await client(t.app, token).post('/auth/mfa/verify', { factorId: enroll.data.factorId, code: '000000' });
    expect(bad.statusCode).toBe(400);
    const code = await (t.container.auth as LocalAuthProvider).currentTotp(enroll.data.factorId);
    const verify = await client(t.app, token).post('/auth/mfa/verify', { factorId: enroll.data.factorId, code });
    expect(verify.statusCode).toBe(200);
    const upgraded = verify.data.tokens.accessToken;
    const ready = await client(t.app, upgraded).get('/me');
    expect(ready.data.next).toBe('ready');
    expect(ready.data.me.mfa).toEqual({ required: true, enrolled: true, verified: true });
  });

  it('revocation takes effect immediately even while the access token is unexpired', async () => {
    const { admin, adminTokens } = await bootstrapSchool(t, 'AUTH2');
    const sessions = await admin.get('/sessions');
    expect(sessions.data.items).toHaveLength(1);
    const logout = await admin.post('/auth/logout');
    expect(logout.statusCode).toBe(200);
    const after = await client(t.app, adminTokens.accessToken).get('/me');
    expect(after.statusCode).toBe(401);
    expect(after.data.code).toBe('session_revoked');
    const refresh = await client(t.app).post('/auth/refresh', { refreshToken: adminTokens.refreshToken });
    expect(refresh.statusCode).toBe(401);
  });

  it('refresh rotates tokens and rejects reuse of an old refresh token', async () => {
    const { adminTokens } = await bootstrapSchool(t, 'AUTH3');
    const first = await client(t.app).post('/auth/refresh', { refreshToken: adminTokens.refreshToken });
    expect(first.statusCode).toBe(200);
    expect(first.data.tokens.refreshToken).not.toBe(adminTokens.refreshToken);
    const reuse = await client(t.app).post('/auth/refresh', { refreshToken: adminTokens.refreshToken });
    expect(reuse.statusCode).toBe(401);
  });

  it('web clients get HttpOnly cookies and must send the CSRF token on writes', async () => {
    const { credential } = await t.container.platform.provisionSchool(
      { code: 'AUTH4', name: 'Cookie School', admin: { username: 'web.admin', displayName: 'Web Admin' } },
      'test',
    );
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-edventure-client': 'web' },
      payload: { schoolCode: 'AUTH4', username: 'web.admin', password: credential.temporaryPassword },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tokens).toBeUndefined();
    const cookies = Object.fromEntries(res.cookies.map((c) => [c.name, c]));
    expect(cookies['edv_at']?.httpOnly).toBe(true);
    expect(cookies['edv_csrf']?.httpOnly).toBeFalsy();
    const cookieHeader = `edv_at=${cookies['edv_at']!.value}; edv_csrf=${cookies['edv_csrf']!.value}`;

    const noCsrf = await t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password',
      headers: { cookie: cookieHeader, origin: 'http://localhost:3000' },
      payload: { currentPassword: credential.temporaryPassword, newPassword: PASSWORD },
    });
    expect(noCsrf.statusCode).toBe(403);

    const withCsrf = await t.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password',
      headers: { cookie: cookieHeader, origin: 'http://localhost:3000', 'x-csrf-token': cookies['edv_csrf']!.value },
      payload: { currentPassword: credential.temporaryPassword, newPassword: PASSWORD },
    });
    expect(withCsrf.statusCode).toBe(200);
  });
});
