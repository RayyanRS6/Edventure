import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { CLIENT_HEADER, CLIENT_VERSION_HEADER, CSRF_HEADER, IDEMPOTENCY_HEADER, REQUEST_ID_HEADER } from '@edventure/contracts';
import type { Container } from './container';
import { registerAuthHook } from './http/auth-hook';
import { registerErrorHandler } from './http/error-handler';
import type { App } from './http/types';
import { registerRoutes } from './routes';

export const API_PREFIX = '/api/v1';

export async function buildApp(c: Container, options: { logger?: FastifyServerOptions['logger'] } = {}): Promise<App> {
  const app = Fastify({
    logger: options.logger ?? {
      level: c.config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    trustProxy: true,
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: () => randomUUID(),
    bodyLimit: 2 * 1024 * 1024,
    // Signed storage tokens travel in the path, so allow longer path parameters than the default 100.
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 1024 },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cookie);
  await app.register(cors, {
    // The admin website normally calls the API through its own origin (reverse proxy), so CORS is
    // only needed for explicitly allowed origins. Mobile apps are not subject to CORS.
    origin: c.config.WEB_ORIGINS.length ? c.config.WEB_ORIGINS : false,
    credentials: true,
    allowedHeaders: [
      'content-type',
      'authorization',
      CSRF_HEADER,
      IDEMPOTENCY_HEADER,
      CLIENT_HEADER,
      CLIENT_VERSION_HEADER,
      REQUEST_ID_HEADER,
      'if-match',
    ],
    exposedHeaders: [REQUEST_ID_HEADER, 'content-disposition'],
  });
  await app.register(rateLimit, { global: false });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Edventure API',
        version: '1.0.0',
        description:
          'The single Edventure backend used by the admin website and the Android/iOS app (admin, teacher and student experiences).',
      },
      servers: [{ url: c.config.PUBLIC_API_URL }],
      components: {
        securitySchemes: {
          bearer: { type: 'http', scheme: 'bearer' },
          cookie: { type: 'apiKey', in: 'cookie', name: 'edv_at' },
        },
      },
      security: [{ bearer: [] }, { cookie: [] }],
    },
    transform: jsonSchemaTransform,
  });

  registerErrorHandler(app);
  registerAuthHook(app, c.identity, c.config);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    return payload;
  });

  app.get('/health', { config: { auth: 'public' }, schema: { hide: true } }, async () => ({ ok: true }));

  await app.register(
    async (v1) => {
      registerRoutes(v1 as App, c);
    },
    { prefix: API_PREFIX },
  );

  app.get('/api/openapi.json', { config: { auth: 'public' }, schema: { hide: true } }, async () => app.swagger());

  return app as App;
}
