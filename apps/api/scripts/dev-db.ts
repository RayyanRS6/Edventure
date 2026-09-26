/**
 * Starts a persistent local PostgreSQL for development at <repo>/.data/postgres, creates the
 * `edventure` database and application role, and applies migrations. Keep it running while you
 * develop (Ctrl+C stops it).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/db/migrate';
import { ensureJobSchema } from '../src/jobs/schema';
import { ensureAppRole, ensureDatabase, localUrl, startLocalPostgres } from './lib/local-postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const dataDir = path.join(root, '.data', 'postgres');
const appPassword = process.env.LOCAL_APP_DB_PASSWORD ?? 'edventure_app_dev';

const pg = await startLocalPostgres({ dataDir, port, persistent: true });
const ownerUrl = localUrl(port, 'edventure');
await ensureDatabase(port, 'edventure');
await ensureAppRole(ownerUrl, appPassword);
await runMigrations(ownerUrl);
await ensureJobSchema(ownerUrl);

console.log(`\nPostgreSQL is running on port ${port} (data: ${dataDir})`);
console.log(`  DATABASE_OWNER_URL=${ownerUrl}`);
console.log(`  DATABASE_URL=${localUrl(port, 'edventure', 'edventure_app', appPassword)}`);
console.log('Press Ctrl+C to stop.\n');

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
