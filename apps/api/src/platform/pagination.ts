import { and, asc, desc, gt, lt, or, eq, type AnyColumn, type SQL } from 'drizzle-orm';
import { errors } from './errors';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

type CursorValue = string | number | null;

export function encodeCursor(values: CursorValue[]): string {
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined, length: number): CursorValue[] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== length) throw new Error('shape');
    return parsed as CursorValue[];
  } catch {
    throw errors.badRequest('Invalid pagination cursor');
  }
}

/**
 * Keyset pagination over (sortColumn, id). Stable under inserts and never scans skipped rows.
 * Returns the extra WHERE condition and ORDER BY for the query.
 */
export function keyset(options: {
  sort: AnyColumn;
  id: AnyColumn;
  direction?: 'asc' | 'desc';
  cursor?: string;
}): { where: SQL | undefined; orderBy: SQL[] } {
  const dir = options.direction ?? 'asc';
  const decoded = decodeCursor(options.cursor, 2);
  const cmp = dir === 'asc' ? gt : lt;
  const where = decoded
    ? or(cmp(options.sort, decoded[0]), and(eq(options.sort, decoded[0]), cmp(options.id, decoded[1])))
    : undefined;
  const order = dir === 'asc' ? asc : desc;
  return { where, orderBy: [order(options.sort), order(options.id)] };
}

/** Fetch `limit + 1` rows, then call this to trim and compute the next cursor. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => CursorValue[]) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null };
}
