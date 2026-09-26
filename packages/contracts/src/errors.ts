import { z } from 'zod';

export const errorCodes = [
  'bad_request',
  'validation_failed',
  'unauthenticated',
  'invalid_credentials',
  'session_revoked',
  'password_change_required',
  'mfa_required',
  'forbidden',
  'not_found',
  'conflict',
  'version_conflict',
  'idempotency_conflict',
  'business_rule',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'client_outdated',
  'internal',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export const apiErrorBody = z.object({
  code: z.enum(errorCodes),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string(),
});

export type ApiErrorBody = z.infer<typeof apiErrorBody>;

export const errorStatus: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  session_revoked: 401,
  password_change_required: 403,
  mfa_required: 403,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  version_conflict: 409,
  idempotency_conflict: 409,
  business_rule: 422,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  client_outdated: 426,
  internal: 500,
};
