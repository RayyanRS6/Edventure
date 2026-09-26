import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { ProviderSession } from '../auth/provider';
import type { Config } from '../config';

export const ACCESS_COOKIE = 'edv_at';
export const REFRESH_COOKIE = 'edv_rt';
export const CSRF_COOKIE = 'edv_csrf';

/**
 * Web sessions live in HttpOnly cookies (never readable by page scripts). The CSRF cookie is
 * readable so the website can echo it in the `x-csrf-token` header (double-submit).
 */
export function setSessionCookies(reply: FastifyReply, config: Config, session: ProviderSession) {
  const base = { httpOnly: true, secure: config.cookieSecure, domain: config.COOKIE_DOMAIN } as const;
  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    ...base,
    sameSite: 'lax',
    path: '/api',
    expires: session.expiresAt,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 3600,
  });
  reply.setCookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    httpOnly: false,
    secure: config.cookieSecure,
    domain: config.COOKIE_DOMAIN,
    sameSite: 'strict',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });
}

export function clearSessionCookies(reply: FastifyReply, config: Config) {
  const opts = { domain: config.COOKIE_DOMAIN, secure: config.cookieSecure } as const;
  reply.clearCookie(ACCESS_COOKIE, { ...opts, path: '/api' });
  reply.clearCookie(REFRESH_COOKIE, { ...opts, path: '/api/v1/auth' });
  reply.clearCookie(CSRF_COOKIE, { ...opts, path: '/' });
}
