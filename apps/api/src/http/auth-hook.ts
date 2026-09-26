import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CLIENT_HEADER, CLIENT_VERSION_HEADER, CSRF_HEADER, type ClientKind } from '@edventure/contracts';
import type { Config } from '../config';
import type { IdentityService, RequestMeta } from '../modules/identity/service';
import { AppError, errors } from '../platform/errors';
import { ACCESS_COOKIE, CSRF_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function clientOf(request: FastifyRequest): ClientKind {
  return request.headers[CLIENT_HEADER] === 'mobile' ? 'mobile' : 'web';
}

export function metaOf(request: FastifyRequest): RequestMeta {
  return {
    client: clientOf(request),
    ip: request.ip ?? null,
    userAgent: request.headers['user-agent'] ?? null,
    requestId: request.id,
  };
}

function semverLess(a: string, b: string) {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Authenticates every non-public route: bearer token (mobile) or HttpOnly cookie (web), then the
 * live application session and account status are checked on EVERY request, so suspension,
 * password resets and revocation take effect immediately even while a signed token is unexpired.
 */
export function registerAuthHook(app: FastifyInstance, identity: IdentityService, config: Config) {
  app.decorateRequest('session', null);
  app.decorateRequest('accessToken', null);
  app.decorateRequest('authViaCookie', false);
  app.decorateRequest('actor', {
    getter(this: FastifyRequest) {
      if (!this.session) throw errors.unauthenticated();
      return this.session.actor;
    },
  });

  app.addHook('preHandler', async (request) => {
    const mode = request.routeOptions.config.auth ?? 'full';

    if (config.MIN_MOBILE_VERSION && clientOf(request) === 'mobile') {
      const version = request.headers[CLIENT_VERSION_HEADER];
      if (typeof version === 'string' && semverLess(version, config.MIN_MOBILE_VERSION)) {
        throw new AppError('client_outdated', 'Please update the Edventure app to continue.');
      }
    }

    if (mode === 'public') return;

    const header = request.headers.authorization;
    let token: string | null = null;
    if (header?.startsWith('Bearer ')) token = header.slice(7).trim();
    else if (request.cookies[ACCESS_COOKIE]) {
      token = request.cookies[ACCESS_COOKIE] ?? null;
      request.authViaCookie = true;
    }
    if (!token) throw errors.unauthenticated();

    if (request.authViaCookie && !SAFE_METHODS.has(request.method)) {
      const origin = request.headers.origin;
      if (origin && config.WEB_ORIGINS.length > 0 && !config.WEB_ORIGINS.includes(origin)) {
        throw errors.forbidden('Request origin is not allowed');
      }
      const cookie = request.cookies[CSRF_COOKIE];
      const sent = request.headers[CSRF_HEADER];
      if (!cookie || typeof sent !== 'string' || !safeEqual(cookie, sent)) {
        throw errors.forbidden('Missing or invalid CSRF token. Reload the page and try again.');
      }
    }

    const resolved = await identity.authenticate(token, metaOf(request));
    request.session = resolved;
    request.accessToken = token;

    if (mode === 'full') {
      if (resolved.mustChangePassword) {
        throw new AppError('password_change_required', 'Please choose a new password to continue.');
      }
      if (resolved.mfaRequired && !resolved.mfaSatisfied) {
        throw new AppError('mfa_required', 'Enter the code from your authenticator app to continue.');
      }
    }

    const roles = request.routeOptions.config.roles;
    if (roles && roles.length > 0 && !roles.some((r) => resolved.actor.roles.includes(r))) {
      throw errors.forbidden();
    }
  });
}
