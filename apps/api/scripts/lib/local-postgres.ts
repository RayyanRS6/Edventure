/**
 * Development/test PostgreSQL using the `embedded-postgres` binaries (real PostgreSQL 17, no Docker).
 * Staging and production use Supabase PostgreSQL instead.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

export const LOCAL_SUPERUSER = 'postgres';
export const LOCAL_SUPERUSER_PASSWORD = 'postgres';

export async function startLocalPostgres(options: { dataDir: string; port: number; persistent: boolean }) {
  const pg = new EmbeddedPostgres({
    databaseDir: options.dataDir,
    user: LOCAL_SUPERUSER,
    password: LOCAL_SUPERUSER_PASSWORD,
    port: options.port,
    persistent: options.persistent,
    // UTF-8 is required for Urdu. Without this, initdb on Windows picks the system code page (WIN1252).
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: (message: unknown) => {
      const text = String(message);
      if (/ERROR|FATAL|PANIC/.test(text)) console.error(`[postgres] ${text.trim()}`);
    },
  });
  if (!fs.existsSync(path.join(options.dataDir, 'PG_VERSION'))) {
    fs.mkdirSync(path.dirname(options.dataDir), { recursive: true });
    await pg.initialise();
  }
  await pg.start();
  return pg;
}

export const localUrl = (port: number, database: string, user = LOCAL_SUPERUSER, password = LOCAL_SUPERUSER_PASSWORD) =>
  `postgres://${user}:${encodeURIComponent(password)}@localhost:${port}/${database}`;

export async function ensureDatabase(port: number, name: string, template?: string) {
  const sql = postgres(localUrl(port, 'postgres'), { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`select 1 from pg_database where datname = ${name}`;
    if (rows.length === 0) {
      await sql.unsafe(`create database "${name}"${template ? ` template "${template}"` : ''}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function dropDatabase(port: number, name: string) {
  const sql = postgres(localUrl(port, 'postgres'), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`drop database if exists "${name}" with (force)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Creates/updates the non-owner application role with a login password (done out-of-band in real environments). */
export async function ensureAppRole(ownerUrl: string, password: string) {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    const exists = await sql`select 1 from pg_roles where rolname = 'edventure_app'`;
    if (exists.length === 0) {
      await sql.unsafe(
        `create role edventure_app login password '${password.replace(/'/g, "''")}' nosuperuser nocreatedb nocreaterole nobypassrls noinherit`,
      );
    } else {
      await sql.unsafe(`alter role edventure_app with login password '${password.replace(/'/g, "''")}'`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
