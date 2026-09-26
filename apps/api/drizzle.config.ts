import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle generates the table DDL from `src/db/schema`. The committed SQL files in `migrations/`
 * are the source of truth that runs against every environment; custom migrations add what Drizzle
 * cannot express (roles, row-level security, exclusion constraints, triggers and grants).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './migrations',
  schemaFilter: ['app'],
  migrations: {
    table: '__migrations',
    schema: 'app_meta',
  },
});
