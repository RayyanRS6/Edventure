import { z } from 'zod';
import {
  assignClassTeacherRequest,
  assignTeacherRequest,
  changeSectionRequest,
  changeStreamRequest,
  classOffering,
  classTeacherAssignment,
  classTeacherSuggestion,
  createClassOfferingRequest,
  createCourseOfferingRequest,
  createCurriculumRequest,
  createDelegationRequest,
  createGradeLevelRequest,
  createSectionRequest,
  createStreamRequest,
  createSubjectRequest,
  createTeachingGroupRequest,
  curriculum,
  delegation,
  endEnrollmentRequest,
  enrollmentSummary,
  enrollStudentRequest,
  gradeLevel,
  groupMember,
  id,
  isoDate,
  placementHistoryItem,
  stream,
  streamChangePreview,
  subject,
  subjectEnrollment,
  teachingGroup,
  updateCourseOfferingRequest,
  updateCurriculumRequest,
  updateGradeLevelRequest,
  updateGroupMembersRequest,
  updateSectionRequest,
  updateStreamRequest,
  updateSubjectEnrollmentsRequest,
  updateSubjectRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { dateQuery, endDateBody, idParams, list, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerAcademicsRoutes(app: App, c: Container) {
  const tags = ['Academics'];
  const admin = { roles: ['school_admin' as const] };
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };

  // Structure
  app.get('/grade-levels', { schema: { tags, response: { 200: list(gradeLevel) } } }, async (req) => ({ items: await c.academics.listGradeLevels(req.actor) }));
  app.post('/grade-levels', { schema: { tags, body: createGradeLevelRequest, response: { 200: gradeLevel } }, config: admin }, (req) => c.academics.createGradeLevel(req.actor, req.body));
  app.patch('/grade-levels/:id', { schema: { tags, params: idParams, body: updateGradeLevelRequest, response: { 200: gradeLevel } }, config: admin }, (req) =>
    c.academics.updateGradeLevel(req.actor, req.params.id, req.body),
  );
  app.get('/subjects', { schema: { tags, response: { 200: list(subject) } } }, async (req) => ({ items: await c.academics.listSubjects(req.actor) }));
  app.post('/subjects', { schema: { tags, body: createSubjectRequest, response: { 200: subject } }, config: admin }, (req) => c.academics.createSubject(req.actor, req.body));
  app.patch('/subjects/:id', { schema: { tags, params: idParams, body: updateSubjectRequest, response: { 200: subject } }, config: admin }, (req) =>
    c.academics.updateSubject(req.actor, req.params.id, req.body),
  );
  app.get('/streams', { schema: { tags, response: { 200: list(stream) } } }, async (req) => ({ items: await c.academics.listStreams(req.actor) }));
  app.post('/streams', { schema: { tags, body: createStreamRequest, response: { 200: stream } }, config: admin }, (req) => c.academics.createStream(req.actor, req.body));
  app.patch('/streams/:id', { schema: { tags, params: idParams, body: updateStreamRequest, response: { 200: stream } }, config: admin }, (req) =>
    c.academics.updateStream(req.actor, req.params.id, req.body),
  );
  app.get('/curricula', { schema: { tags, querystring: z.object({ gradeLevelId: id.optional() }), response: { 200: list(curriculum) } }, config: staff }, async (req) => ({
    items: await c.academics.listCurricula(req.actor, req.query.gradeLevelId),
  }));
  app.post('/curricula', { schema: { tags, body: createCurriculumRequest, response: { 200: curriculum } }, config: admin }, (req) => c.academics.createCurriculum(req.actor, req.body));
  app.patch('/curricula/:id', { schema: { tags, params: idParams, body: updateCurriculumRequest, response: { 200: curriculum } }, config: admin }, (req) =>
    c.academics.updateCurriculum(req.actor, req.params.id, req.body),
  );

  // Classes, sections, subject offerings
  app.get('/classes', { schema: { tags, querystring: z.object({ academicYearId: id }), response: { 200: list(classOffering) } } }, async (req) => ({
    items: await c.academics.listClassOfferings(req.actor, req.query.academicYearId),
  }));
  app.get('/classes/:id', { schema: { tags, params: idParams, response: { 200: classOffering } } }, (req) => c.academics.getClassOffering(req.actor, req.params.id));
  app.post('/classes', { schema: { tags, body: createClassOfferingRequest, response: { 200: classOffering } }, config: admin }, (req) =>
    c.academics.createClassOffering(req.actor, req.body),
  );
  app.post('/classes/:id/sections', { schema: { tags, params: idParams, body: createSectionRequest, response: { 200: classOffering } }, config: admin }, (req) =>
    c.academics.createSection(req.actor, req.params.id, req.body),
  );
  app.patch('/sections/:id', { schema: { tags, params: idParams, body: updateSectionRequest, response: { 200: classOffering } }, config: admin }, (req) =>
    c.academics.updateSection(req.actor, req.params.id, req.body),
  );
  app.post('/classes/:id/courses', { schema: { tags, params: idParams, body: createCourseOfferingRequest, response: { 200: classOffering } }, config: admin }, (req) =>
    c.academics.createCourseOffering(req.actor, req.params.id, req.body),
  );
  app.patch('/courses/:id', { schema: { tags, params: idParams, body: updateCourseOfferingRequest, response: { 200: classOffering } }, config: admin }, (req) =>
    c.academics.updateCourseOffering(req.actor, req.params.id, req.body),
  );

  // Teaching groups
  const groupQuery = z.object({
    classOfferingId: id.optional(),
    sectionId: id.optional(),
    teacherId: id.optional(),
    academicYearId: id.optional(),
    mine: z.enum(['true', 'false']).optional(),
  });
  app.get('/teaching-groups', { schema: { tags, querystring: groupQuery, response: { 200: list(teachingGroup) } }, config: staff }, async (req) => ({
    items: await c.teaching.listGroups(req.actor, { ...req.query, mine: req.query.mine === 'true' }),
  }));
  app.get('/teaching-groups/:id', { schema: { tags, params: idParams, response: { 200: teachingGroup } }, config: staff }, (req) => c.teaching.getGroup(req.actor, req.params.id));
  app.post('/teaching-groups', { schema: { tags, body: createTeachingGroupRequest, response: { 200: teachingGroup } }, config: admin }, (req) =>
    c.teaching.createGroup(req.actor, req.body),
  );
  app.post('/teaching-groups/:id/archive', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.teaching.archiveGroup(req.actor, req.params.id);
    return OK;
  });
  app.get('/teaching-groups/:id/members', { schema: { tags, params: idParams, querystring: dateQuery, response: { 200: list(groupMember) } }, config: staff }, async (req) => ({
    items: await c.teaching.members(req.actor, req.params.id, req.query.date),
  }));
  app.post('/teaching-groups/:id/members', { schema: { tags, params: idParams, body: updateGroupMembersRequest, response: { 200: list(groupMember) } }, config: admin }, async (req) => ({
    items: await c.teaching.updateMembers(req.actor, req.params.id, req.body),
  }));

  // Assignments
  app.post('/teacher-assignments', { schema: { tags, body: assignTeacherRequest, response: { 200: teachingGroup } }, config: admin }, (req) => c.teaching.assignTeacher(req.actor, req.body));
  app.post('/teacher-assignments/:id/end', { schema: { tags, params: idParams, body: endDateBody, response: { 200: ok } }, config: admin }, async (req) => {
    await c.teaching.endAssignment(req.actor, req.params.id, req.body.endDate);
    return OK;
  });
  app.get(
    '/class-teacher-assignments',
    { schema: { tags, querystring: z.object({ sectionId: id.optional(), teacherId: id.optional(), date: isoDate.optional() }), response: { 200: list(classTeacherAssignment) } } },
    async (req) => ({ items: await c.teaching.listClassTeachers(req.actor, req.query) }),
  );
  app.post('/class-teacher-assignments', { schema: { tags, body: assignClassTeacherRequest, response: { 200: list(classTeacherAssignment) } }, config: admin }, async (req) => ({
    items: await c.teaching.assignClassTeacher(req.actor, req.body),
  }));
  app.post('/class-teacher-assignments/:id/end', { schema: { tags, params: idParams, body: endDateBody, response: { 200: ok } }, config: admin }, async (req) => {
    await c.teaching.endClassTeacher(req.actor, req.params.id, req.body.endDate);
    return OK;
  });
  app.get('/sections/:id/class-teacher-suggestion', { schema: { tags, params: idParams, response: { 200: classTeacherSuggestion } }, config: admin }, (req) =>
    c.teaching.suggestClassTeacher(req.actor, req.params.id),
  );
  app.get(
    '/attendance-delegations',
    { schema: { tags, querystring: z.object({ sectionId: id.optional(), teacherId: id.optional() }), response: { 200: list(delegation) } }, config: staff },
    async (req) => ({ items: await c.teaching.listDelegations(req.actor, req.query) }),
  );
  app.post('/attendance-delegations', { schema: { tags, body: createDelegationRequest, response: { 200: list(delegation) } }, config: admin }, async (req) => ({
    items: await c.teaching.createDelegation(req.actor, req.body),
  }));
  app.delete('/attendance-delegations/:id', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.teaching.revokeDelegation(req.actor, req.params.id);
    return OK;
  });

  // Enrollment history and changes
  const etags = ['Enrollment'];
  app.get('/students/:id/enrollments', { schema: { tags: etags, params: idParams, response: { 200: list(enrollmentSummary) } } }, async (req) => {
    await c.people.getStudent(req.actor, req.params.id); // authorization
    return { items: await c.enrollment.history(req.actor, req.params.id) };
  });
  app.post('/students/:id/enrollments', { schema: { tags: etags, params: idParams, body: enrollStudentRequest, response: { 200: list(enrollmentSummary) } }, config: admin }, async (req) => ({
    items: await c.enrollment.enrollExisting(req.actor, req.params.id, req.body),
  }));
  app.get('/students/:id/placements', { schema: { tags: etags, params: idParams, response: { 200: list(placementHistoryItem) } }, config: admin }, async (req) => ({
    items: await c.enrollment.placementHistory(req.actor, req.params.id),
  }));
  app.post('/students/:id/section-change', { schema: { tags: etags, params: idParams, body: changeSectionRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.enrollment.changeSection(req.actor, req.params.id, req.body);
    return OK;
  });
  app.post('/students/:id/stream-change', { schema: { tags: etags, params: idParams, body: changeStreamRequest, response: { 200: streamChangePreview } }, config: admin }, (req) =>
    c.enrollment.changeStream(req.actor, req.params.id, req.body),
  );
  app.get('/students/:id/subject-enrollments', { schema: { tags: etags, params: idParams, response: { 200: list(subjectEnrollment) } } }, async (req) => {
    await c.people.getStudent(req.actor, req.params.id);
    return { items: await c.enrollment.subjectEnrollments(req.actor, req.params.id) };
  });
  app.post('/students/:id/subject-enrollments', { schema: { tags: etags, params: idParams, body: updateSubjectEnrollmentsRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.enrollment.updateSubjectEnrollments(req.actor, req.params.id, req.body);
    return OK;
  });
  app.post('/students/:id/enrollment/end', { schema: { tags: etags, params: idParams, body: endEnrollmentRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.enrollment.endEnrollment(req.actor, req.params.id, req.body);
    return OK;
  });
}
