import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import type { ApiErrorBody, ErrorCode } from '@edventure/contracts';
import { errorStatus } from '@edventure/contracts';
import { constraintMessages } from '../db/constraint-messages';
import { PG, pgErrorOf } from '../db/errors';
import { AppError } from '../platform/errors';

function send(reply: FastifyReply, request: FastifyRequest, code: ErrorCode, message: string, extra: Partial<ApiErrorBody> = {}, status?: number) {
  const body: ApiErrorBody = { code, message, requestId: request.id, ...extra };
  return reply.status(status ?? errorStatus[code]).send(body);
}

/** Converts every failure into the shared structured error body `{ code, message, fieldErrors?, requestId }`. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => send(reply, request, 'not_found', 'This endpoint does not exist'));

  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof AppError) {
      return send(reply, request, error.code, error.message, { fieldErrors: error.fieldErrors, details: error.details }, error.status);
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.validation) {
        const path = String(issue.instancePath ?? '')
          .replace(/^\//, '')
          .replace(/\//g, '.');
        const key = path || '_';
        (fieldErrors[key] ??= []).push(issue.message ?? 'Invalid value');
      }
      return send(reply, request, 'validation_failed', 'Some fields need attention', { fieldErrors });
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, issues: error.cause.issues }, 'response did not match its contract');
      return send(reply, request, 'internal', 'Something went wrong. Please try again.');
    }

    const pg = pgErrorOf(error);
    if (pg) {
      const mapped = pg.constraint ? constraintMessages[pg.constraint] : undefined;
      const fieldErrors = mapped?.field ? { [mapped.field]: [mapped.message] } : undefined;
      switch (pg.code) {
        case PG.uniqueViolation:
        case PG.exclusionViolation:
          return send(reply, request, 'conflict', mapped?.message ?? 'This conflicts with an existing record', { fieldErrors });
        case PG.checkViolation:
          return send(reply, request, 'business_rule', mapped?.message ?? 'The change breaks a data rule', { fieldErrors });
        case PG.foreignKeyViolation:
          return send(
            reply,
            request,
            'conflict',
            /is still referenced/.test(pg.detail ?? '')
              ? 'This record is in use and cannot be removed. Archive it instead.'
              : 'A referenced record does not exist',
          );
        case PG.serializationFailure:
        case PG.deadlockDetected:
          return send(reply, request, 'conflict', 'Another change happened at the same time. Please try again.');
        case PG.insufficientPrivilege:
          request.log.error({ err: error }, 'database privilege violation');
          return send(reply, request, 'forbidden', 'You do not have permission to do this');
      }
      if (/row-level security/.test(pg.message)) {
        request.log.error({ err: error }, 'row-level security violation');
        return send(reply, request, 'forbidden', 'You do not have permission to do this');
      }
    }

    const fe = error as FastifyError;
    if (fe.statusCode === 413 || fe.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return send(reply, request, 'payload_too_large', 'The upload is too large');
    }
    if (fe.statusCode === 415 || fe.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return send(reply, request, 'unsupported_media_type', 'Unsupported content type');
    }
    if (fe.statusCode === 429) {
      return send(reply, request, 'rate_limited', 'Too many attempts. Please wait a moment and try again.');
    }
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      return send(reply, request, 'bad_request', fe.message || 'Bad request');
    }

    request.log.error({ err: error }, 'unhandled error');
    return send(reply, request, 'internal', 'Something went wrong. Please try again.');
  });
}
