import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run a query: the pool or an open transaction. */
export type Executor = Db | Tx;

export interface DbHandle {
  db: Db;
  sql: postgres.Sql;
  close(): Promise<void>;
}

export function connect(url: string, options: { max?: number; application?: string } = {}): DbHandle {
  const sql = postgres(url, {
    max: options.max ?? 10,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    onnotice: () => {},
    connection: { application_name: options.application ?? 'edventure-api' },
  });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: () => sql.end({ timeout: 5 }),
  };
}
