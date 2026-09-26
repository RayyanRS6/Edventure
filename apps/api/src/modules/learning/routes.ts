import { z } from 'zod';
import {
  attendanceRangeQuery,
  createHomeworkRequest,
  createMaterialRequest,
  createQuizRequest,
  feedbackRequest,
  homeworkDetail,
  homeworkListQuery,
  homeworkPage,
  id,
  learningMaterial,
  markAnswerRequest,
  markCompleteRequest,
  quizAttempt,
  quizAttemptRow,
  quizDetail,
  quizListQuery,
  quizPage,
  recipientStatus,
  saveAnswerRequest,
  sectionHomeworkSummary,
  submitHomeworkRequest,
  updateHomeworkRequest,
  updateQuizRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerLearningRoutes(app: App, c: Container) {
  const tags = ['Homework'];
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };
  const student = { roles: ['student' as const] };

  app.get('/homework', { schema: { tags, querystring: homeworkListQuery, response: { 200: homeworkPage } } }, (req) => c.homework.list(req.actor, req.query));
  app.post('/homework', { schema: { tags, body: createHomeworkRequest, response: { 200: homeworkDetail } }, config: staff }, (req) => c.homework.create(req.actor, req.body));
  app.get('/homework/:id', { schema: { tags, params: idParams, response: { 200: homeworkDetail } } }, (req) => c.homework.get(req.actor, req.params.id));
  app.patch('/homework/:id', { schema: { tags, params: idParams, body: updateHomeworkRequest, response: { 200: homeworkDetail } }, config: staff }, (req) =>
    c.homework.update(req.actor, req.params.id, req.body),
  );
  app.post('/homework/:id/publish', { schema: { tags, params: idParams, response: { 200: homeworkDetail } }, config: staff }, (req) => c.homework.publish(req.actor, req.params.id));
  app.post('/homework/:id/close', { schema: { tags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.homework.setState(req.actor, req.params.id, 'closed');
    return OK;
  });
  app.post('/homework/:id/archive', { schema: { tags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.homework.setState(req.actor, req.params.id, 'archived');
    return OK;
  });
  app.post('/homework/:id/recipients/sync', { schema: { tags, params: idParams, response: { 200: z.object({ added: z.number().int() }) } }, config: staff }, (req) =>
    c.homework.addNewMembers(req.actor, req.params.id),
  );
  app.get('/homework/:id/recipients', { schema: { tags, params: idParams, response: { 200: list(recipientStatus) } }, config: staff }, async (req) => ({
    items: await c.homework.recipients(req.actor, req.params.id),
  }));
  app.post('/homework/:id/completion', { schema: { tags, params: idParams, body: markCompleteRequest, response: { 200: ok } }, config: staff }, async (req) => {
    await c.homework.markCompletion(req.actor, req.params.id, req.body);
    return OK;
  });
  app.post('/homework/:id/submissions', { schema: { tags, params: idParams, body: submitHomeworkRequest, response: { 200: homeworkDetail } }, config: student }, (req) =>
    c.homework.submit(req.actor, req.params.id, req.body),
  );
  app.post('/submissions/:id/feedback', { schema: { tags, params: idParams, body: feedbackRequest, response: { 200: ok } }, config: staff }, async (req) => {
    await c.homework.feedback(req.actor, req.params.id, req.body);
    return OK;
  });
  app.get('/sections/:id/homework-summary', { schema: { tags, params: idParams, querystring: attendanceRangeQuery, response: { 200: sectionHomeworkSummary } }, config: staff }, (req) =>
    c.homework.sectionSummary(req.actor, req.params.id, req.query.from, req.query.to),
  );

  const mtags = ['Materials'];
  app.get('/materials', { schema: { tags: mtags, querystring: z.object({ teachingGroupId: id.optional() }), response: { 200: list(learningMaterial) } } }, async (req) => ({
    items: await c.homework.listMaterials(req.actor, req.query),
  }));
  app.post('/materials', { schema: { tags: mtags, body: createMaterialRequest, response: { 200: learningMaterial } }, config: staff }, (req) => c.homework.createMaterial(req.actor, req.body));
  app.post('/materials/:id/archive', { schema: { tags: mtags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.homework.archiveMaterial(req.actor, req.params.id);
    return OK;
  });

  const qtags = ['Quizzes'];
  app.get('/quizzes', { schema: { tags: qtags, querystring: quizListQuery, response: { 200: quizPage } } }, (req) => c.quizzes.list(req.actor, req.query));
  app.post('/quizzes', { schema: { tags: qtags, body: createQuizRequest, response: { 200: quizDetail } }, config: staff }, (req) => c.quizzes.create(req.actor, req.body));
  app.get('/quizzes/:id', { schema: { tags: qtags, params: idParams, response: { 200: quizDetail } } }, (req) => c.quizzes.get(req.actor, req.params.id));
  app.patch('/quizzes/:id', { schema: { tags: qtags, params: idParams, body: updateQuizRequest, response: { 200: quizDetail } }, config: staff }, (req) =>
    c.quizzes.update(req.actor, req.params.id, req.body),
  );
  app.post('/quizzes/:id/publish', { schema: { tags: qtags, params: idParams, response: { 200: quizDetail } }, config: staff }, (req) => c.quizzes.publish(req.actor, req.params.id));
  app.post('/quizzes/:id/close', { schema: { tags: qtags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.quizzes.close(req.actor, req.params.id);
    return OK;
  });
  app.post('/quizzes/:id/release-results', { schema: { tags: qtags, params: idParams, response: { 200: ok } }, config: staff }, async (req) => {
    await c.quizzes.releaseResults(req.actor, req.params.id);
    return OK;
  });
  app.post('/quizzes/:id/retakes', { schema: { tags: qtags, params: idParams, body: z.object({ studentId: id }), response: { 200: ok } }, config: staff }, async (req) => {
    await c.quizzes.grantRetake(req.actor, req.params.id, req.body.studentId);
    return OK;
  });
  app.get('/quizzes/:id/attempts', { schema: { tags: qtags, params: idParams, response: { 200: list(quizAttemptRow) } }, config: staff }, async (req) => ({
    items: await c.quizzes.attemptsFor(req.actor, req.params.id),
  }));
  app.post('/quizzes/:id/attempts', { schema: { tags: qtags, params: idParams, response: { 200: quizAttempt } }, config: student }, (req) => c.quizzes.start(req.actor, req.params.id));
  app.get('/quiz-attempts/:id', { schema: { tags: qtags, params: idParams, response: { 200: quizAttempt } } }, (req) => c.quizzes.attempt(req.actor, req.params.id));
  app.put('/quiz-attempts/:id/answers', { schema: { tags: qtags, params: idParams, body: saveAnswerRequest, response: { 200: ok } }, config: student }, async (req) => {
    await c.quizzes.saveAnswer(req.actor, req.params.id, req.body);
    return OK;
  });
  app.post('/quiz-attempts/:id/submit', { schema: { tags: qtags, params: idParams, response: { 200: quizAttempt } }, config: student }, (req) => c.quizzes.submit(req.actor, req.params.id));
  app.put(
    '/quiz-attempts/:id/answers/:questionId/mark',
    { schema: { tags: qtags, params: z.object({ id, questionId: id }), body: markAnswerRequest, response: { 200: quizAttempt } }, config: staff },
    (req) => c.quizzes.markAnswer(req.actor, req.params.id, req.params.questionId, req.body),
  );
}
