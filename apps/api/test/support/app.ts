import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../../src/app';
import { readConfig } from '../../src/config';
import { createContainer, type Container } from '../../src/container';
import type { LocalAuthProvider } from '../../src/auth/local-provider';
import type { App } from '../../src/http/types';
import { createTestDatabase, type TestDatabase } from './db';

export interface TestApp {
  db: TestDatabase;
  container: Container;
  app: App;
  storageDir: string;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const db = await createTestDatabase();
  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edventure-test-storage-'));
  const config = readConfig({
    NODE_ENV: 'test',
    DATABASE_URL: db.appUrl,
    DATABASE_OWNER_URL: db.ownerUrl,
    AUTH_PROVIDER: 'local',
    LOCAL_AUTH_SECRET: 'test-only-secret-test-only-secret-000000',
    STORAGE_PROVIDER: 'local',
    LOCAL_STORAGE_DIR: storageDir,
    PUBLIC_API_URL: 'http://localhost:4000',
    WEB_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    SKIP_MALWARE_SCAN: 'true',
    ...overrides,
  });
  const container = await createContainer(config, { role: 'api' });
  // Set TEST_LOG=1 to see server errors while debugging a failing test.
  const app = await buildApp(container, { logger: process.env.TEST_LOG ? { level: 'error' } : false });
  await app.ready();
  return {
    db,
    container,
    app,
    storageDir,
    async close() {
      await app.close();
      await container.close();
      await db.drop();
      fs.rmSync(storageDir, { recursive: true, force: true });
    },
  };
}

export type Res<T = any> = LightMyRequestResponse & { body: string; data: T };

/** A mobile-style API client (bearer token) over Fastify's in-process injection. */
export function client(app: App, token?: string, extraHeaders: Record<string, string> = {}) {
  const call = async <T = any>(method: InjectOptions['method'], url: string, payload?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> => {
    const res = await app.inject({
      method,
      url: `/api/v1${url}`,
      payload: payload as InjectOptions['payload'],
      headers: {
        'x-edventure-client': 'mobile',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
        ...headers,
      },
    });
    let data: T;
    try {
      data = res.json() as T;
    } catch {
      data = undefined as T;
    }
    return Object.assign(res, { data }) as Res<T>;
  };
  return {
    get: <T = any>(url: string, headers?: Record<string, string>) => call<T>('GET', url, undefined, headers),
    post: <T = any>(url: string, body?: unknown, headers?: Record<string, string>) => call<T>('POST', url, body ?? {}, headers),
    put: <T = any>(url: string, body?: unknown, headers?: Record<string, string>) => call<T>('PUT', url, body ?? {}, headers),
    patch: <T = any>(url: string, body?: unknown, headers?: Record<string, string>) => call<T>('PATCH', url, body ?? {}, headers),
    delete: <T = any>(url: string, body?: unknown, headers?: Record<string, string>) => call<T>('DELETE', url, body, headers),
  };
}
export type Client = ReturnType<typeof client>;

export const PASSWORD = 'Str0ng-Passw0rd!';

/** Logs in, replaces the temporary password and completes MFA when required. Returns a ready client. */
export async function signIn(t: TestApp, schoolCode: string, username: string, temporaryPassword: string) {
  const anon = client(t.app);
  let res = await anon.post('/auth/login', { schoolCode, username, password: temporaryPassword });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  let tokens = res.data.tokens;
  let next = res.data.next as string;
  if (next === 'change_password') {
    const change = await client(t.app, tokens.accessToken).post('/auth/password', {
      currentPassword: temporaryPassword,
      newPassword: PASSWORD,
    });
    if (change.statusCode !== 200) throw new Error(`password change failed: ${change.body}`);
    const me = await client(t.app, tokens.accessToken).get('/me');
    next = me.data.next;
  }
  if (next === 'mfa_enroll' || next === 'mfa_verify') {
    const authed = client(t.app, tokens.accessToken);
    const enroll = next === 'mfa_enroll' ? await authed.post('/auth/mfa/enroll') : null;
    const local = t.container.auth as LocalAuthProvider;
    const factorId = enroll?.data.factorId;
    const code = await local.currentTotp(factorId);
    const verify = await authed.post('/auth/mfa/verify', { code, factorId });
    if (verify.statusCode !== 200) throw new Error(`mfa verify failed: ${verify.body}`);
    tokens = verify.data.tokens;
  }
  return { client: client(t.app, tokens.accessToken), tokens };
}

/** Provisions a school with its first administrator and returns a fully signed-in admin client. */
export async function bootstrapSchool(t: TestApp, code = 'PILOT') {
  const { school, credential } = await t.container.platform.provisionSchool(
    { code, name: `${code} School`, admin: { username: 'admin', displayName: 'Principal' } },
    'test',
  );
  const admin = await signIn(t, code, 'admin', credential.temporaryPassword);
  return { school, admin: admin.client, adminTokens: admin.tokens, adminAccountId: credential.accountId };
}
