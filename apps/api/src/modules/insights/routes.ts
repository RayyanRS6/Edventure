import { z } from 'zod';
import {
  adminDashboard,
  auditPage,
  auditQuery,
  createPeopleImportRequest,
  createReportRequest,
  importBatch,
  importBatchDetail,
  peopleImportKind,
  reportJob,
  searchResults,
  studentDashboard,
  teacherDashboard,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerInsightRoutes(app: App, c: Container) {
  const admin = { roles: ['school_admin' as const] };
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };

  app.get('/dashboards/admin', { schema: { tags: ['Dashboards'], response: { 200: adminDashboard } }, config: admin }, (req) => c.insights.admin(req.actor));
  app.get('/dashboards/teacher', { schema: { tags: ['Dashboards'], response: { 200: teacherDashboard } }, config: { roles: ['teacher'] } }, (req) => c.insights.teacher(req.actor));
  app.get('/dashboards/student', { schema: { tags: ['Dashboards'], response: { 200: studentDashboard } }, config: { roles: ['student'] } }, (req) => c.insights.student(req.actor));
  app.get('/search', { schema: { tags: ['Search'], querystring: z.object({ q: z.string().max(100) }), response: { 200: searchResults } }, config: staff }, (req) =>
    c.insights.search(req.actor, req.query.q),
  );
  app.get('/audit-events', { schema: { tags: ['Audit'], querystring: auditQuery, response: { 200: auditPage } }, config: admin }, (req) => c.insights.audit(req.actor, req.query));

  const itags = ['Imports'];
  app.get('/imports/templates/:kind', { schema: { tags: itags, params: z.object({ kind: peopleImportKind }) }, config: admin }, async (req, reply) => {
    reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="${req.params.kind}-template.csv"`);
    return reply.send(c.imports.template(req.params.kind));
  });
  app.get('/imports', { schema: { tags: itags, response: { 200: list(importBatch) } }, config: admin }, async (req) => ({ items: await c.imports.list(req.actor) }));
  app.post('/imports', { schema: { tags: itags, body: createPeopleImportRequest, response: { 200: importBatchDetail } }, config: admin }, (req) => c.imports.create(req.actor, req.body));
  app.get('/imports/:id', { schema: { tags: itags, params: idParams, response: { 200: importBatchDetail } }, config: admin }, (req) => c.imports.get(req.actor, req.params.id));
  app.post('/imports/:id/commit', { schema: { tags: itags, params: idParams, response: { 202: importBatchDetail } }, config: admin }, async (req, reply) => {
    const result = await c.imports.requestCommit(req.actor, req.params.id);
    return reply.status(202).send(result);
  });

  const rtags = ['Reports'];
  app.get('/reports', { schema: { tags: rtags, response: { 200: list(reportJob) } } }, async (req) => ({ items: await c.reports.list(req.actor) }));
  app.post('/reports', { schema: { tags: rtags, body: createReportRequest, response: { 202: reportJob } } }, async (req, reply) => {
    const job = await c.reports.request(req.actor, req.body);
    return reply.status(202).send(job);
  });
  app.get('/reports/:id', { schema: { tags: rtags, params: idParams, response: { 200: reportJob } } }, (req) => c.reports.get(req.actor, req.params.id));
}
