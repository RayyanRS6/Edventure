import { expect } from 'vitest';
import { pgErrorOf } from '../../src/db/errors';

/** Asserts that a database call fails with a PostgreSQL error whose message (or code) matches. */
export async function expectDbError(promise: Promise<unknown>, match: RegExp | string) {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, 'expected the database call to fail').toBeDefined();
  const pg = pgErrorOf(error);
  expect(pg, `expected a PostgreSQL error, got: ${String(error)}`).not.toBeNull();
  if (typeof match === 'string') expect(pg!.code).toBe(match);
  else expect(pg!.message).toMatch(match);
}
