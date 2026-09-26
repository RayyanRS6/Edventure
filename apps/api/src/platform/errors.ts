import { errorStatus, type ErrorCode } from '@edventure/contracts';

export interface AppErrorOptions {
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  status?: number;
}

/** A deliberate, user-presentable failure. Anything else becomes a generic 500 with a request id. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
    this.status = options.status ?? errorStatus[code];
  }
}

export const errors = {
  badRequest: (message: string, details?: Record<string, unknown>) => new AppError('bad_request', message, { details }),
  invalid: (fieldErrors: Record<string, string[]>, message = 'Some fields need attention') =>
    new AppError('validation_failed', message, { fieldErrors }),
  field: (field: string, message: string) => new AppError('validation_failed', message, { fieldErrors: { [field]: [message] } }),
  unauthenticated: (message = 'Please sign in to continue') => new AppError('unauthenticated', message),
  invalidCredentials: () => new AppError('invalid_credentials', 'The school code, username or password is incorrect'),
  sessionRevoked: (message = 'Your session has ended. Please sign in again.') => new AppError('session_revoked', message),
  forbidden: (message = 'You do not have permission to do this') => new AppError('forbidden', message),
  notFound: (what = 'Record') => new AppError('not_found', `${what} was not found`),
  conflict: (message: string, details?: Record<string, unknown>) => new AppError('conflict', message, { details }),
  version: () =>
    new AppError('version_conflict', 'This record was changed by someone else. Reload it and try again.'),
  rule: (message: string, details?: Record<string, unknown>) => new AppError('business_rule', message, { details }),
};

/** Throws `version_conflict` when an optimistic-concurrency update touched no rows. */
export function assertUpdated<T>(rows: T[], ifMissing: () => Error = errors.version): T {
  const row = rows[0];
  if (!row) throw ifMissing();
  return row;
}

export function required<T>(value: T | null | undefined, what = 'Record'): T {
  if (value === null || value === undefined) throw errors.notFound(what);
  return value;
}
