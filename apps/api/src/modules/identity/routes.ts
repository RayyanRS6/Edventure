import { z } from 'zod';
import {
  changePasswordRequest,
  id,
  loginRequest,
  loginResponse,
  me,
  mfaEnrollResponse,
  mfaVerifyRequest,
  okResponse,
  refreshRequest,
  refreshResponse,
  sessionSummary,
  updatePreferencesRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { clientOf, metaOf } from '../../http/auth-hook';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '../../http/cookies';
import type { App } from '../../http/types';
import type { ProviderSession } from '../../auth/provider';
import { errors } from '../../platform/errors';

const tokensFor = (session: ProviderSession) => ({
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
  expiresAt: session.expiresAt.toISOString(),
});

export function registerIdentityRoutes(app: App, c: Container) {
  const tags = ['Auth'];

  app.post(
    '/auth/login',
    {
      schema: { tags, body: loginRequest, response: { 200: loginResponse } },
      config: { auth: 'public', rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const result = await c.identity.login(request.body, metaOf(request));
      if (clientOf(request) === 'web') {
        setSessionCookies(reply, c.config, result.session);
        return { me: result.me, next: result.next };
      }
      return { me: result.me, next: result.next, tokens: tokensFor(result.session) };
    },
  );

  app.post(
    '/auth/refresh',
    {
      schema: { tags, body: refreshRequest.optional(), response: { 200: refreshResponse } },
      config: { auth: 'public', rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const web = clientOf(request) === 'web';
      const token = web ? request.cookies[REFRESH_COOKIE] : request.body?.refreshToken;
      if (!token) throw errors.unauthenticated();
      try {
        const session = await c.identity.refresh(token, metaOf(request));
        if (web) {
          setSessionCookies(reply, c.config, session);
          return { ok: true as const };
        }
        return { ok: true as const, tokens: tokensFor(session) };
      } catch (e) {
        if (web) clearSessionCookies(reply, c.config);
        throw e;
      }
    },
  );

  app.post(
    '/auth/logout',
    { schema: { tags, response: { 200: okResponse } }, config: { auth: 'session' } },
    async (request, reply) => {
      await c.identity.logout(request.actor, request.accessToken);
      clearSessionCookies(reply, c.config);
      return { ok: true as const };
    },
  );

  app.post(
    '/auth/password',
    { schema: { tags, body: changePasswordRequest, response: { 200: okResponse } }, config: { auth: 'session' } },
    async (request) => {
      await c.identity.changePassword(request.session!, request.body.currentPassword, request.body.newPassword);
      return { ok: true as const };
    },
  );

  app.post(
    '/auth/mfa/enroll',
    { schema: { tags, response: { 200: mfaEnrollResponse } }, config: { auth: 'session' } },
    async (request) => c.identity.mfaEnroll(request.session!, request.accessToken!),
  );

  app.post(
    '/auth/mfa/verify',
    {
      schema: { tags, body: mfaVerifyRequest, response: { 200: refreshResponse } },
      config: { auth: 'session', rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const session = await c.identity.mfaVerify(request.session!, request.accessToken!, request.body.code, request.body.factorId);
      if (clientOf(request) === 'web') {
        setSessionCookies(reply, c.config, session);
        return { ok: true as const };
      }
      return { ok: true as const, tokens: tokensFor(session) };
    },
  );

  app.get(
    '/me',
    { schema: { tags, response: { 200: z.object({ me, next: loginResponse.shape.next }) } }, config: { auth: 'session' } },
    async (request) => c.identity.me(request.session!, request.accessToken),
  );

  app.patch(
    '/me/preferences',
    { schema: { tags, body: updatePreferencesRequest, response: { 200: okResponse } }, config: { auth: 'session' } },
    async (request) => {
      await c.identity.updatePreferences(request.actor, request.body.locale);
      return { ok: true as const };
    },
  );

  app.get(
    '/sessions',
    { schema: { tags, response: { 200: z.object({ items: z.array(sessionSummary) }) } }, config: { auth: 'session' } },
    async (request) => ({ items: await c.identity.listSessions(request.actor) }),
  );

  app.delete(
    '/sessions/:sessionId',
    { schema: { tags, params: z.object({ sessionId: id }), response: { 200: okResponse } }, config: { auth: 'session' } },
    async (request) => {
      await c.identity.revokeSession(request.actor, request.params.sessionId);
      return { ok: true as const };
    },
  );
}
