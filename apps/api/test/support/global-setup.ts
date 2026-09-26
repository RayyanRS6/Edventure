import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../src/db/migrate';
import { ensureJobSchema } from '../../src/jobs/schema';
import { ensureAppRole, ensureDatabase, localUrl, startLocalPostgres } from '../../scripts/lib/local-postgres';

export const TEMPLATE_DB = 'edventure_template';
export const APP_ROLE_PASSWORD = 'edventure_app_test';

declare module 'vitest' {
  export interface ProvidedContext {
    pgPort: number;
    templateDb: string;
    appRolePassword: string;
  }
}

/** Starts a throwaway PostgreSQL 17 and builds one migrated template database for all test files. */
export default async function setup(project: TestProject) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edventure-test-pg-'));
  const port = 55000 + Math.floor(Math.random() * 5000);
  const pg = await startLocalPostgres({ dataDir, port, persistent: false });

  await ensureDatabase(port, TEMPLATE_DB);
  const ownerUrl = localUrl(port, TEMPLATE_DB);
  await ensureAppRole(ownerUrl, APP_ROLE_PASSWORD);
  await runMigrations(ownerUrl);
  await ensureJobSchema(ownerUrl);

  project.provide('pgPort', port);
  project.provide('templateDb', TEMPLATE_DB);
  project.provide('appRolePassword', APP_ROLE_PASSWORD);

  return async () => {
    await pg.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
}
