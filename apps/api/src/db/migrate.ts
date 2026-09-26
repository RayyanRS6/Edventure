import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(here, '../../migrations');

/** Applies committed SQL migrations using the owner connection. */
export async function runMigrations(ownerUrl: string) {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder,
      migrationsTable: '__migrations',
      migrationsSchema: 'app_meta',
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
