import { createUploadRequest, createUploadResponse, downloadLink, fileInfo, uploadRules } from '@edventure/contracts';
import { z } from 'zod';
import type { Container } from '../../container';
import { idParams, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';
import { AppError, errors } from '../../platform/errors';
import { LocalStorageProvider } from '../../storage/local';

const MAX_UPLOAD = Math.max(...Object.values(uploadRules).filter((r) => r.clientUpload).map((r) => r.maxBytes));

export function registerFileRoutes(app: App, c: Container) {
  const tags = ['Files'];

  app.post('/files/uploads', { schema: { tags, body: createUploadRequest, response: { 200: createUploadResponse } } }, (req) => c.files.createUpload(req.actor, req.body));
  app.post('/files/:id/complete', { schema: { tags, params: idParams, response: { 200: fileInfo } } }, (req) => c.files.complete(req.actor, req.params.id));
  app.get('/files/:id', { schema: { tags, params: idParams, response: { 200: fileInfo } } }, (req) => c.files.info(req.actor, req.params.id));
  app.get('/files/:id/download', { schema: { tags, params: idParams, response: { 200: downloadLink } } }, (req) => c.files.download(req.actor, req.params.id));
  app.get('/files/:id/content', { schema: { tags, params: idParams } }, async (req, reply) => {
    const file = await c.files.content(req.actor, req.params.id);
    reply
      .header('content-type', file.mimeType)
      .header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .header('cache-control', 'private, no-store');
    return reply.send(file.body);
  });
  app.delete('/files/:id', { schema: { tags, params: idParams, response: { 200: ok } } }, async (req) => {
    await c.files.remove(req.actor, req.params.id);
    return OK;
  });

  // Development storage endpoints (signed-token authorization, mirroring Supabase signed URLs).
  const storage = c.files.storageProvider;
  if (storage instanceof LocalStorageProvider) {
    app.register(async (sub) => {
      sub.removeAllContentTypeParsers();
      sub.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: MAX_UPLOAD + 1024 }, (_req, body, done) => done(null, body));
      sub.put('/files/local/:token', { config: { auth: 'public' }, schema: { hide: true, params: z.object({ token: z.string() }) } }, async (req) => {
        const token = storage.verify((req.params as { token: string }).token, 'put');
        if (!token) throw errors.forbidden('Upload link is invalid or expired');
        const body = req.body as Buffer;
        if (!Buffer.isBuffer(body) || body.length === 0) throw errors.badRequest('Empty upload');
        if (token.max && body.length > token.max) throw new AppError('payload_too_large', 'The upload is too large');
        await storage.write(token.k, body);
        return OK;
      });
      sub.get('/files/local/:token', { config: { auth: 'public' }, schema: { hide: true, params: z.object({ token: z.string() }) } }, async (req, reply) => {
        const token = storage.verify((req.params as { token: string }).token, 'get');
        if (!token) throw errors.forbidden('Download link is invalid or expired');
        const body = await storage.read(token.k);
        reply.header('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(token.n ?? 'download')}`);
        reply.header('content-type', 'application/octet-stream');
        return reply.send(body);
      });
    });
  }
}
