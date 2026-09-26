import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const list = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    /** Routine connections: the non-owner `edventure_app` role (no BYPASSRLS). */
    DATABASE_URL: z.string().min(1),
    /** Owner connection: migrations, platform provisioning and the job-queue schema only. */
    DATABASE_OWNER_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().default(10),

    /** `supabase` in staging/production. `local` is a development/test stand-in and refuses to run in production. */
    AUTH_PROVIDER: z.enum(['supabase', 'local']).default('local'),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_JWT_ISSUER: z.string().optional(),
    /** Domain for immutable, opaque internal auth identifiers (`<account-id>@<domain>`). Never emailed. */
    AUTH_IDENTITY_DOMAIN: z.string().default('accounts.edventure.invalid'),
    LOCAL_AUTH_SECRET: z.string().min(32).optional(),

    STORAGE_PROVIDER: z.enum(['supabase', 'local']).default('local'),
    SUPABASE_STORAGE_BUCKET: z.string().default('edventure-private'),
    LOCAL_STORAGE_DIR: z.string().default('../../.data/storage'),

    /** Public base URL of this API (used to build local upload/download URLs). */
    PUBLIC_API_URL: z.string().default('http://localhost:4000'),
    /** Browser origins allowed to call the API with cookies (the admin website). */
    WEB_ORIGINS: list,
    COOKIE_SECURE: bool.optional(),
    COOKIE_DOMAIN: z.string().optional(),

    EXPO_ACCESS_TOKEN: z.string().optional(),
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().default(3310),
    /** Development only: mark uploads clean without a malware scanner. Ignored in production. */
    SKIP_MALWARE_SCAN: bool.default(false),

    /** PDF rendering browser: a Playwright channel (msedge, chrome) or an executable path. */
    PDF_BROWSER_CHANNEL: z.string().optional(),
    PDF_BROWSER_PATH: z.string().optional(),

    /** Minimum mobile app version accepted (semver). Older clients receive 426. */
    MIN_MOBILE_VERSION: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.AUTH_PROVIDER !== 'supabase') {
        ctx.addIssue({ code: 'custom', path: ['AUTH_PROVIDER'], message: 'Production requires AUTH_PROVIDER=supabase' });
      }
      if (env.STORAGE_PROVIDER !== 'supabase') {
        ctx.addIssue({ code: 'custom', path: ['STORAGE_PROVIDER'], message: 'Production requires STORAGE_PROVIDER=supabase' });
      }
    }
    if (env.AUTH_PROVIDER === 'supabase' || env.STORAGE_PROVIDER === 'supabase') {
      for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for Supabase` });
      }
    }
    if (env.AUTH_PROVIDER === 'local' && !env.LOCAL_AUTH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['LOCAL_AUTH_SECRET'], message: 'LOCAL_AUTH_SECRET (32+ chars) is required' });
    }
  });

export type Config = z.infer<typeof envSchema> & {
  cookieSecure: boolean;
  isProduction: boolean;
  localStorageDir: string;
};

let loaded = false;

/** Loads `.env` from the API package directory (if present) without overriding real environment variables. */
export function loadEnvFile(dir = process.cwd()) {
  if (loaded) return;
  loaded = true;
  const file = path.join(dir, '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${lines}`);
  }
  const c = parsed.data;
  return {
    ...c,
    isProduction: c.NODE_ENV === 'production',
    cookieSecure: c.COOKIE_SECURE ?? c.NODE_ENV === 'production',
    localStorageDir: path.resolve(process.cwd(), c.LOCAL_STORAGE_DIR),
  };
}
