/** Normalized PostgreSQL error, unwrapped from Drizzle's "Failed query" wrapper. */
export interface PgError {
  code: string;
  message: string;
  constraint?: string;
  detail?: string;
  table?: string;
}

export function pgErrorOf(err: unknown): PgError | null {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    const e = current as { code?: unknown; message?: unknown; constraint_name?: unknown; detail?: unknown; table_name?: unknown; cause?: unknown };
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
      return {
        code: e.code,
        message: String(e.message ?? ''),
        constraint: typeof e.constraint_name === 'string' ? e.constraint_name : undefined,
        detail: typeof e.detail === 'string' ? e.detail : undefined,
        table: typeof e.table_name === 'string' ? e.table_name : undefined,
      };
    }
    current = e.cause;
  }
  return null;
}

export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  exclusionViolation: '23P01',
  notNullViolation: '23502',
  insufficientPrivilege: '42501',
  serializationFailure: '40001',
  deadlockDetected: '40P01',
} as const;

export const isPgError = (err: unknown, code: string, constraint?: string) => {
  const pg = pgErrorOf(err);
  return !!pg && pg.code === code && (constraint === undefined || pg.constraint === constraint);
};
