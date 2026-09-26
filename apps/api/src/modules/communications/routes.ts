import { z } from 'zod';
import {
  announcement,
  announcementListQuery,
  announcementPage,
  createAnnouncementRequest,
  markReadRequest,
  notificationPage,
  notificationQuery,
  registerDeviceRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerCommunicationsRoutes(app: App, c: Container) {
  const tags = ['Communications'];
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };

  app.get('/announcements', { schema: { tags, querystring: announcementListQuery, response: { 200: announcementPage } } }, (req) =>
    c.comms.listAnnouncements(req.actor, req.query),
  );
  app.post('/announcements', { schema: { tags, body: createAnnouncementRequest, response: { 200: announcement } }, config: staff }, (req) =>
    c.comms.createAnnouncement(req.actor, req.body),
  );
  app.get('/announcements/:id', { schema: { tags, params: idParams, response: { 200: announcement } } }, (req) => c.comms.getAnnouncement(req.actor, req.params.id));
  app.post('/announcements/:id/publish', { schema: { tags, params: idParams, response: { 200: announcement } }, config: staff }, (req) =>
    c.comms.publishAnnouncement(req.actor, req.params.id),
  );
  app.post('/announcements/:id/archive', { schema: { tags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.comms.archiveAnnouncement(req.actor, req.params.id);
    return OK;
  });

  app.get('/notifications', { schema: { tags, querystring: notificationQuery, response: { 200: notificationPage } } }, (req) => c.comms.inbox(req.actor, req.query));
  app.post('/notifications/read', { schema: { tags, body: markReadRequest, response: { 200: ok } } }, async (req) => {
    await c.comms.markRead(req.actor, req.body);
    return OK;
  });

  app.post('/devices', { schema: { tags, body: registerDeviceRequest, response: { 200: ok } } }, async (req) => {
    await c.comms.registerDevice(req.actor, req.body);
    return OK;
  });
  app.delete('/devices', { schema: { tags, body: z.object({ expoPushToken: z.string() }), response: { 200: ok } } }, async (req) => {
    await c.comms.unregisterDevice(req.actor, req.body.expoPushToken);
    return OK;
  });
}
