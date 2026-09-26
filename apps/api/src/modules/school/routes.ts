import { z } from 'zod';
import {
  academicYear,
  academicYearClosureCheck,
  calendarDay,
  calendarQuery,
  createAcademicYearRequest,
  createRoomRequest,
  createTermRequest,
  room,
  schoolSettings,
  term,
  updateAcademicYearRequest,
  updateSchoolSettingsRequest,
  upsertCalendarDayRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list, ok, OK, reasonBody } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerSchoolRoutes(app: App, c: Container) {
  const tags = ['School'];
  const admin = { roles: ['school_admin' as const] };

  app.get('/school', { schema: { tags, response: { 200: schoolSettings } } }, (req) => c.school.settings(req.actor));
  app.patch('/school', { schema: { tags, body: updateSchoolSettingsRequest, response: { 200: schoolSettings } }, config: admin }, (req) =>
    c.school.updateSettings(req.actor, req.body),
  );

  app.get('/academic-years', { schema: { tags, response: { 200: list(academicYear) } } }, async (req) => ({ items: await c.school.listYears(req.actor) }));
  app.post('/academic-years', { schema: { tags, body: createAcademicYearRequest, response: { 200: academicYear } }, config: admin }, (req) =>
    c.school.createYear(req.actor, req.body),
  );
  app.patch('/academic-years/:id', { schema: { tags, params: idParams, body: updateAcademicYearRequest, response: { 200: academicYear } }, config: admin }, (req) =>
    c.school.updateYear(req.actor, req.params.id, req.body),
  );
  app.post('/academic-years/:id/activate', { schema: { tags, params: idParams, response: { 200: academicYear } }, config: admin }, (req) =>
    c.school.activateYear(req.actor, req.params.id),
  );
  app.get('/academic-years/:id/closure-check', { schema: { tags, params: idParams, response: { 200: academicYearClosureCheck } }, config: admin }, (req) =>
    c.school.closureCheck(req.actor, req.params.id),
  );
  app.post('/academic-years/:id/close', { schema: { tags, params: idParams, response: { 200: academicYear } }, config: admin }, (req) =>
    c.school.closeYear(req.actor, req.params.id),
  );
  app.post('/academic-years/:id/reopen', { schema: { tags, params: idParams, body: reasonBody, response: { 200: academicYear } }, config: admin }, (req) =>
    c.school.reopenYear(req.actor, req.params.id, req.body.reason),
  );

  app.get('/academic-years/:id/terms', { schema: { tags, params: idParams, response: { 200: list(term) } } }, async (req) => ({
    items: await c.school.listTerms(req.actor, req.params.id),
  }));
  app.post('/academic-years/:id/terms', { schema: { tags, params: idParams, body: createTermRequest, response: { 200: list(term) } }, config: admin }, async (req) => ({
    items: await c.school.createTerm(req.actor, req.params.id, req.body),
  }));
  app.delete('/terms/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.school.deleteTerm(req.actor, req.params.id);
    return OK;
  });

  app.get('/calendar', { schema: { tags, querystring: calendarQuery, response: { 200: list(calendarDay) } } }, async (req) => ({
    items: await c.school.calendar(req.actor, req.query.from, req.query.to),
  }));
  app.put('/calendar', { schema: { tags, body: upsertCalendarDayRequest, response: { 200: calendarDay } }, config: admin }, (req) =>
    c.school.upsertCalendarDay(req.actor, req.body),
  );
  app.delete('/calendar/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.school.deleteCalendarDay(req.actor, req.params.id);
    return OK;
  });

  app.get('/rooms', { schema: { tags, response: { 200: list(room) } } }, async (req) => ({ items: await c.school.listRooms(req.actor) }));
  app.post('/rooms', { schema: { tags, body: createRoomRequest, response: { 200: room } }, config: admin }, (req) => c.school.createRoom(req.actor, req.body));
  app.post('/rooms/:id/archive', { schema: { tags, params: idParams, body: z.object({ archived: z.boolean() }), response: { 200: ok } }, config: admin }, async (req) => {
    await c.school.archiveRoom(req.actor, req.params.id, req.body.archived);
    return OK;
  });
}
