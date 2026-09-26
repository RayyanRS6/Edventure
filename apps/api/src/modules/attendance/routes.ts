import { z } from 'zod';
import {
  attendanceRangeQuery,
  correctAttendanceRequest,
  createLeaveRequest,
  createLeaveTypeRequest,
  dailyOverview,
  decideLeaveRequest,
  id,
  IDEMPOTENCY_HEADER,
  isoDate,
  leaveDecisionResult,
  leaveListQuery,
  leavePage,
  leaveRequest,
  leaveType,
  rollCall,
  rollCallTask,
  saveRollCallRequest,
  saveTeacherAttendanceRequest,
  sectionAttendanceReport,
  studentAttendanceReport,
  teacherAttendanceDay,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { dateQuery, idParams, list, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';
import { today } from '../../platform/scope';

export function registerAttendanceRoutes(app: App, c: Container) {
  const tags = ['Attendance'];
  const admin = { roles: ['school_admin' as const] };
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };
  const rollCallParams = z.object({ sectionId: id, date: isoDate });

  app.get('/attendance/roll-call-tasks', { schema: { tags, querystring: dateQuery, response: { 200: list(rollCallTask) } }, config: staff }, async (req) => ({
    items: await c.attendance.rollCallTasks(req.actor, req.query.date ?? today(req.actor)),
  }));
  app.get('/attendance/sections/:sectionId/:date', { schema: { tags, params: rollCallParams, response: { 200: rollCall } }, config: staff }, (req) =>
    c.attendance.getRollCall(req.actor, req.params.sectionId, req.params.date),
  );
  app.put('/attendance/sections/:sectionId/:date', { schema: { tags, params: rollCallParams, body: saveRollCallRequest, response: { 200: rollCall } }, config: staff }, (req) =>
    c.attendance.saveRollCall(req.actor, req.params.sectionId, req.params.date, req.body, req.headers[IDEMPOTENCY_HEADER] as string | undefined),
  );
  app.post('/attendance/students/corrections', { schema: { tags, body: correctAttendanceRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.attendance.correct(req.actor, req.body);
    return OK;
  });
  app.get('/attendance/students/:id/report', { schema: { tags, params: idParams, querystring: attendanceRangeQuery, response: { 200: studentAttendanceReport } } }, (req) =>
    c.attendance.studentReport(req.actor, req.params.id, req.query.from, req.query.to),
  );
  app.get('/attendance/sections/:id/report', { schema: { tags, params: idParams, querystring: attendanceRangeQuery, response: { 200: sectionAttendanceReport } }, config: staff }, (req) =>
    c.attendance.sectionReport(req.actor, req.params.id, req.query.from, req.query.to),
  );
  app.get('/attendance/overview', { schema: { tags, querystring: dateQuery, response: { 200: dailyOverview } }, config: admin }, (req) =>
    c.attendance.dailyOverview(req.actor, req.query.date ?? today(req.actor)),
  );
  app.get('/attendance/teachers', { schema: { tags, querystring: dateQuery, response: { 200: teacherAttendanceDay } }, config: admin }, (req) =>
    c.attendance.teacherDay(req.actor, req.query.date ?? today(req.actor)),
  );
  app.put('/attendance/teachers', { schema: { tags, body: saveTeacherAttendanceRequest, response: { 200: teacherAttendanceDay } }, config: admin }, (req) =>
    c.attendance.saveTeacherDay(req.actor, req.body),
  );

  const ltags = ['Leave'];
  app.get('/leave-types', { schema: { tags: ltags, response: { 200: list(leaveType) } } }, async (req) => ({ items: await c.leave.listTypes(req.actor) }));
  app.post('/leave-types', { schema: { tags: ltags, body: createLeaveTypeRequest, response: { 200: list(leaveType) } }, config: admin }, async (req) => ({
    items: await c.leave.createType(req.actor, req.body),
  }));
  app.post('/leave-types/:id/archive', { schema: { tags: ltags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.leave.archiveType(req.actor, req.params.id);
    return OK;
  });
  app.get('/leave-requests', { schema: { tags: ltags, querystring: leaveListQuery, response: { 200: leavePage } } }, (req) => c.leave.list(req.actor, req.query));
  app.post('/leave-requests', { schema: { tags: ltags, body: createLeaveRequest, response: { 200: leaveRequest } } }, (req) => c.leave.create(req.actor, req.body));
  app.get('/leave-requests/:id', { schema: { tags: ltags, params: idParams, response: { 200: leaveRequest } } }, (req) => c.leave.get(req.actor, req.params.id));
  app.post('/leave-requests/:id/decision', { schema: { tags: ltags, params: idParams, body: decideLeaveRequest, response: { 200: leaveDecisionResult } }, config: admin }, (req) =>
    c.leave.decide(req.actor, req.params.id, req.body),
  );
  app.post('/leave-requests/:id/cancel', { schema: { tags: ltags, params: idParams, response: { 200: leaveRequest } } }, (req) => c.leave.cancel(req.actor, req.params.id));
}
