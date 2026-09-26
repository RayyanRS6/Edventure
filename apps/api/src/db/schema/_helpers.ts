import {
  date,
  foreignKey,
  integer,
  numeric,
  pgSchema,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * All application tables live in the private `app` schema. It is never exposed through the
 * Supabase Data API; clients reach data only through the Edventure backend.
 */
export const app = pgSchema('app');

export const pk = () => uuid('id').primaryKey().defaultRandom();
export const schoolIdColumn = () => uuid('school_id').notNull();
export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
export const version = () => integer('version').notNull().default(1);

/** UTC instant. */
export const ts = (name: string) => timestamp(name, { withTimezone: true });
/** School-local calendar date, returned as `YYYY-MM-DD`. */
export const day = (name: string) => date(name, { mode: 'string' });
/** Exact money (PKR by default). */
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
/** Exact marks/scores. */
export const marks = (name: string) => numeric(name, { precision: 7, scale: 2 });
export const pct = (name: string) => numeric(name, { precision: 5, scale: 2 });

/** Columns shared by every tenant-owned table. */
export const tenantColumns = () => ({
  id: pk(),
  schoolId: schoolIdColumn(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

type Keyed = { id: AnyPgColumn; schoolId: AnyPgColumn };

/**
 * Every tenant table exposes `(school_id, id)` as a unique key so other tables can reference it
 * with a composite foreign key. That makes cross-school relationships impossible at the database level.
 */
export const tenantConstraints = (name: string, t: Keyed, schools: { id: AnyPgColumn }) => [
  unique(`${name}_tenant_uk`).on(t.schoolId, t.id),
  foreignKey({ name: `${name}_school_fk`, columns: [t.schoolId], foreignColumns: [schools.id] }),
];

/** Composite tenant foreign key: `(school_id, <col>) → target(school_id, id)`. Restrictive delete by default. */
export const tfk = (
  name: string,
  schoolId: AnyPgColumn,
  column: AnyPgColumn,
  target: Keyed,
  onDelete: 'restrict' | 'cascade' | 'no action' = 'no action',
) => foreignKey({ name, columns: [schoolId, column], foreignColumns: [target.schoolId, target.id] }).onDelete(onDelete);
