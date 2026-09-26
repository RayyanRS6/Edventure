import { z } from 'zod';
import {
  createLessonExceptionRequest,
  createPeriodRequest,
  createTimetableVersionRequest,
  daySchedule,
  id,
  isoDate,
  lessonException,
  periodDefinition,
  publishTimetableRequest,
  timetableDetail,
  timetableVersion,
  updatePeriodRequest,
  upsertLessonRequest,
  weekSchedule,
  weekScheduleQuery,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { dateQuery, idParams, list, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerTimetableRoutes(app: App, c: Container) {
  const tags = ['Timetables'];
  const admin = { roles: ['school_admin' as const] };
  const yearQuery = z.object({ academicYearId: id });

  app.get('/periods', { schema: { tags, querystring: yearQuery, response: { 200: list(periodDefinition) } } }, async (req) => ({
    items: await c.timetable.listPeriods(req.actor, req.query.academicYearId),
  }));
  app.post('/periods', { schema: { tags, body: createPeriodRequest, response: { 200: periodDefinition } }, config: admin }, (req) => c.timetable.createPeriod(req.actor, req.body));
  app.patch('/periods/:id', { schema: { tags, params: idParams, body: updatePeriodRequest, response: { 200: periodDefinition } }, config: admin }, (req) =>
    c.timetable.updatePeriod(req.actor, req.params.id, req.body),
  );
  app.delete('/periods/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.timetable.deletePeriod(req.actor, req.params.id);
    return OK;
  });

  app.get('/timetables', { schema: { tags, querystring: yearQuery, response: { 200: list(timetableVersion) } }, config: admin }, async (req) => ({
    items: await c.timetable.listVersions(req.actor, req.query.academicYearId),
  }));
  app.post('/timetables', { schema: { tags, body: createTimetableVersionRequest, response: { 200: timetableDetail } }, config: admin }, (req) =>
    c.timetable.createVersion(req.actor, req.body),
  );
  app.get('/timetables/:id', { schema: { tags, params: idParams, response: { 200: timetableDetail } }, config: admin }, (req) => c.timetable.getVersion(req.actor, req.params.id));
  app.delete('/timetables/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.timetable.deleteDraft(req.actor, req.params.id);
    return OK;
  });
  app.post('/timetables/:id/lessons', { schema: { tags, params: idParams, body: upsertLessonRequest, response: { 200: timetableDetail } }, config: admin }, (req) =>
    c.timetable.addLesson(req.actor, req.params.id, req.body),
  );
  app.delete('/timetable-lessons/:id', { schema: { tags, params: idParams, response: { 200: timetableDetail } }, config: admin }, (req) =>
    c.timetable.removeLesson(req.actor, req.params.id),
  );
  app.post('/timetables/:id/validate', { schema: { tags, params: idParams, body: z.object({ date: isoDate.optional() }).optional(), response: { 200: timetableDetail } }, config: admin }, (req) =>
    c.timetable.validate(req.actor, req.params.id, req.body?.date),
  );
  app.post('/timetables/:id/publish', { schema: { tags, params: idParams, body: publishTimetableRequest, response: { 200: timetableDetail } }, config: admin }, (req) =>
    c.timetable.publish(req.actor, req.params.id, req.body),
  );

  app.get('/lesson-exceptions', { schema: { tags, querystring: z.object({ from: isoDate, to: isoDate }), response: { 200: list(lessonException) } } }, async (req) => ({
    items: await c.timetable.exceptionsFor(req.actor, req.query),
  }));
  app.post('/lesson-exceptions', { schema: { tags, body: createLessonExceptionRequest, response: { 200: lessonException } }, config: admin }, (req) =>
    c.timetable.createException(req.actor, req.body),
  );
  app.delete('/lesson-exceptions/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.timetable.removeException(req.actor, req.params.id);
    return OK;
  });

  // Views for every experience (student, teacher, class teacher, admin)
  app.get('/schedule/week', { schema: { tags, querystring: weekScheduleQuery, response: { 200: weekSchedule } } }, (req) => c.timetable.week(req.actor, req.query));
  app.get('/schedule/day', { schema: { tags, querystring: dateQuery, response: { 200: daySchedule } } }, (req) => c.timetable.day(req.actor, req.query.date));
}
