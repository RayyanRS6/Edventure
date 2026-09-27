import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/** The package's `migrations/` folder, found from source (`src/db`) or from the bundle (`dist`). */
function findMigrationsFolder(start: string) {
  for (let dir = start, i = 0; i < 4; i++, dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'migrations');
    if (fs.existsSync(path.join(candidate, 'meta', '_journal.json'))) return candidate;
  }
  throw new Error(`Cannot find the migrations folder above ${start}`);
}

export const migrationsFolder = findMigrationsFolder(path.dirname(fileURLToPath(import.meta.url)));

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
