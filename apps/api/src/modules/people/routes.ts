import { z } from 'zod';
import {
  accountStatusChange,
  accountSummary,
  adminListItem,
  compensationRecord,
  createAdminRequest,
  createCompensationRequest,
  createStudentRequest,
  createStudentResponse,
  createTeacherRequest,
  createTeacherResponse,
  deleteAccountRequest,
  deletionPreview,
  deletionResult,
  disciplinarySuspension,
  endEmploymentRequest,
  endEmploymentResponse,
  issueCredentialsRequest,
  issueCredentialsResponse,
  issuedCredential,
  restoreResult,
  studentDetail,
  studentListPage,
  studentListQuery,
  suspensionRequest,
  teacherDetail,
  teacherListPage,
  teacherListQuery,
  updateRolesRequest,
  updateStudentRequest,
  updateTeacherRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list, ok, OK, reasonBody } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerPeopleRoutes(app: App, c: Container) {
  const tags = ['People'];
  const admin = { roles: ['school_admin' as const] };
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };

  // Students
  app.get('/students', { schema: { tags, querystring: studentListQuery, response: { 200: studentListPage } }, config: staff }, (req) => c.people.listStudents(req.actor, req.query));
  app.post('/students', { schema: { tags, body: createStudentRequest, response: { 200: createStudentResponse } }, config: admin }, (req) => c.people.createStudent(req.actor, req.body));
  app.get('/students/:id', { schema: { tags, params: idParams, response: { 200: studentDetail } } }, (req) => c.people.getStudent(req.actor, req.params.id));
  app.patch('/students/:id', { schema: { tags, params: idParams, body: updateStudentRequest, response: { 200: studentDetail } }, config: admin }, (req) =>
    c.people.updateStudent(req.actor, req.params.id, req.body),
  );
  app.get('/students/:id/suspensions', { schema: { tags, params: idParams, response: { 200: list(disciplinarySuspension) } } }, async (req) => ({
    items: await c.people.listSuspensions(req.actor, req.params.id),
  }));
  app.post('/students/:id/suspensions', { schema: { tags, params: idParams, body: suspensionRequest, response: { 200: disciplinarySuspension } }, config: admin }, (req) =>
    c.people.suspendStudent(req.actor, req.params.id, req.body),
  );
  app.post('/suspensions/:id/revoke', { schema: { tags, params: idParams, body: reasonBody, response: { 200: ok } }, config: admin }, async (req) => {
    await c.people.revokeSuspension(req.actor, req.params.id, req.body.reason);
    return OK;
  });

  // Teachers
  app.get('/teachers', { schema: { tags, querystring: teacherListQuery, response: { 200: teacherListPage } }, config: admin }, (req) => c.people.listTeachers(req.actor, req.query));
  app.post('/teachers', { schema: { tags, body: createTeacherRequest, response: { 200: createTeacherResponse } }, config: admin }, (req) => c.people.createTeacher(req.actor, req.body));
  app.get('/teachers/:id', { schema: { tags, params: idParams, response: { 200: teacherDetail } }, config: staff }, (req) => c.people.getTeacher(req.actor, req.params.id));
  app.patch('/teachers/:id', { schema: { tags, params: idParams, body: updateTeacherRequest, response: { 200: teacherDetail } }, config: staff }, (req) =>
    c.people.updateTeacher(req.actor, req.params.id, req.body),
  );
  app.post('/teachers/:id/end-employment', { schema: { tags, params: idParams, body: endEmploymentRequest, response: { 200: endEmploymentResponse } }, config: admin }, (req) =>
    c.people.endEmployment(req.actor, req.params.id, req.body),
  );
  app.get('/teachers/:id/compensation', { schema: { tags, params: idParams, response: { 200: list(compensationRecord) } }, config: admin }, async (req) => ({
    items: await c.people.listCompensation(req.actor, req.params.id),
  }));
  app.post('/teachers/:id/compensation', { schema: { tags, params: idParams, body: createCompensationRequest, response: { 200: list(compensationRecord) } }, config: admin }, async (req) => ({
    items: await c.people.addCompensation(req.actor, req.params.id, req.body),
  }));

  // Administrators
  app.get('/admins', { schema: { tags, response: { 200: list(adminListItem) } }, config: admin }, async (req) => ({ items: await c.people.listAdmins(req.actor) }));
  app.post(
    '/admins',
    {
      schema: {
        tags,
        body: createAdminRequest,
        response: { 200: z.object({ account: accountSummary, credential: issuedCredential.nullable(), provisioningError: z.string().nullable() }) },
      },
      config: admin,
    },
    (req) => c.people.createAdmin(req.actor, req.body),
  );

  // Accounts: credentials, status, roles, deletion and recovery
  const atags = ['Accounts'];
  app.post('/accounts/:id/reset-password', { schema: { tags: atags, params: idParams, response: { 200: issuedCredential } }, config: admin }, (req) =>
    c.accounts.issueCredential(req.actor, req.params.id),
  );
  app.post('/accounts/issue-credentials', { schema: { tags: atags, body: issueCredentialsRequest, response: { 200: issueCredentialsResponse } }, config: admin }, async (req) => {
    const issued = [];
    const failed = [];
    for (const accountId of req.body.accountIds) {
      try {
        issued.push(await c.accounts.issueCredential(req.actor, accountId));
      } catch (e) {
        failed.push({ accountId, message: e instanceof Error ? e.message : 'Failed' });
      }
    }
    return { issued, failed };
  });
  app.post('/accounts/:id/suspend', { schema: { tags: atags, params: idParams, body: accountStatusChange, response: { 200: ok } }, config: admin }, async (req) => {
    await c.accounts.suspend(req.actor, req.params.id, req.body.reason);
    return OK;
  });
  app.post('/accounts/:id/reactivate', { schema: { tags: atags, params: idParams, body: accountStatusChange, response: { 200: ok } }, config: admin }, async (req) => {
    await c.accounts.reactivate(req.actor, req.params.id, req.body.reason);
    return OK;
  });
  app.put('/accounts/:id/roles', { schema: { tags: atags, params: idParams, body: updateRolesRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.people.setRoles(req.actor, req.params.id, req.body.roles, req.body.version);
    return OK;
  });
  app.get('/accounts/:id/deletion-preview', { schema: { tags: atags, params: idParams, response: { 200: deletionPreview } }, config: admin }, (req) =>
    c.people.deletionPreview(req.actor, req.params.id),
  );
  app.post('/accounts/:id/delete', { schema: { tags: atags, params: idParams, body: deleteAccountRequest, response: { 200: deletionResult } }, config: admin }, (req) =>
    c.people.deleteAccount(req.actor, req.params.id, req.body.reason),
  );
  app.post('/accounts/:id/restore', { schema: { tags: atags, params: idParams, response: { 200: restoreResult } }, config: admin }, (req) =>
    c.people.restoreAccount(req.actor, req.params.id),
  );
}
