import { loadEnvFile, readConfig } from '../src/config';
import { runMigrations } from '../src/db/migrate';
import { ensureJobSchema } from '../src/jobs/schema';

loadEnvFile();
const config = readConfig();

await runMigrations(config.DATABASE_OWNER_URL);
await ensureJobSchema(config.DATABASE_OWNER_URL);
console.log('Migrations applied.');
