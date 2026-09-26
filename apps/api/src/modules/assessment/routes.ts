import { z } from 'zod';
import {
  calculateResultsRequest,
  createExamCycleRequest,
  createPapersRequest,
  createPromotionBatchRequest,
  dateSheetQuery,
  dateSheetRow,
  examCycle,
  examCycleTransition,
  examPaper,
  gradingPolicy,
  gradingPolicyRequest,
  id,
  IDEMPOTENCY_HEADER,
  markSheet,
  myResult,
  promotionBatch,
  promotionExecutionResult,
  publishResultsRequest,
  remarksRequest,
  reportCard,
  rescheduleSittingRequest,
  resultPublication,
  reviseResultsRequest,
  saveMarksRequest,
  scheduleSittingRequest,
  updatePaperRequest,
  updatePromotionDecisionRequest,
  versioned,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list, ok, OK } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerAssessmentRoutes(app: App, c: Container) {
  const tags = ['Exams'];
  const admin = { roles: ['school_admin' as const] };
  const staff = { roles: ['school_admin' as const, 'teacher' as const] };

  app.get('/exams', { schema: { tags, querystring: z.object({ academicYearId: id }), response: { 200: list(examCycle) } } }, async (req) => ({
    items: await c.exams.listCycles(req.actor, req.query.academicYearId),
  }));
  app.post('/exams', { schema: { tags, body: createExamCycleRequest, response: { 200: examCycle } }, config: admin }, (req) => c.exams.createCycle(req.actor, req.body));
  app.post('/exams/:id/state', { schema: { tags, params: idParams, body: examCycleTransition, response: { 200: examCycle } }, config: admin }, (req) =>
    c.exams.transition(req.actor, req.params.id, req.body),
  );
  app.get('/exams/:id/papers', { schema: { tags, params: idParams, querystring: z.object({ classOfferingId: id.optional() }), response: { 200: list(examPaper) } }, config: staff }, async (req) => ({
    items: await c.exams.listPapers(req.actor, req.params.id, req.query.classOfferingId),
  }));
  app.post('/exams/:id/papers', { schema: { tags, params: idParams, body: createPapersRequest, response: { 200: list(examPaper) } }, config: admin }, async (req) => ({
    items: await c.exams.createPapers(req.actor, req.params.id, req.body),
  }));
  app.patch('/exam-papers/:id', { schema: { tags, params: idParams, body: updatePaperRequest, response: { 200: examPaper } }, config: admin }, (req) =>
    c.exams.updatePaper(req.actor, req.params.id, req.body),
  );
  app.post('/exam-papers/:id/registrations/sync', { schema: { tags, params: idParams, response: { 200: z.object({ added: z.number().int(), removed: z.number().int() }) } }, config: admin }, (req) =>
    c.exams.syncRegistrations(req.actor, req.params.id),
  );
  app.post('/exam-sittings', { schema: { tags, body: scheduleSittingRequest, response: { 200: examPaper } }, config: admin }, (req) => c.exams.scheduleSitting(req.actor, req.body));
  app.post('/exam-sittings/:id/reschedule', { schema: { tags, params: idParams, body: rescheduleSittingRequest, response: { 200: examPaper } }, config: admin }, (req) =>
    c.exams.reschedule(req.actor, req.params.id, req.body),
  );
  app.post('/exam-sittings/:id/cancel', { schema: { tags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.exams.cancelSitting(req.actor, req.params.id);
    return OK;
  });
  app.get('/date-sheet', { schema: { tags, querystring: dateSheetQuery, response: { 200: list(dateSheetRow) } } }, async (req) => ({ items: await c.exams.dateSheet(req.actor, req.query) }));
  app.get('/exam-papers/:id/marks', { schema: { tags, params: idParams, querystring: z.object({ sectionId: id.optional() }), response: { 200: markSheet } }, config: staff }, (req) =>
    c.exams.markSheet(req.actor, req.params.id, req.query.sectionId),
  );
  app.put('/exam-papers/:id/marks', { schema: { tags, params: idParams, body: saveMarksRequest, response: { 200: markSheet } }, config: staff }, (req) =>
    c.exams.saveMarks(req.actor, req.params.id, req.body),
  );

  const gtags = ['Grading'];
  app.get('/grading-policies', { schema: { tags: gtags, response: { 200: list(gradingPolicy) } }, config: admin }, async (req) => ({ items: await c.results.listPolicies(req.actor) }));
  app.post('/grading-policies', { schema: { tags: gtags, body: gradingPolicyRequest, response: { 200: gradingPolicy } }, config: admin }, (req) => c.results.createPolicy(req.actor, req.body));
  app.put('/grading-policies/:id', { schema: { tags: gtags, params: idParams, body: gradingPolicyRequest, response: { 200: gradingPolicy } }, config: admin }, (req) =>
    c.results.updatePolicy(req.actor, req.params.id, req.body),
  );
  app.post('/grading-policies/:id/activate', { schema: { tags: gtags, params: idParams, response: { 200: gradingPolicy } }, config: admin }, (req) =>
    c.results.activatePolicy(req.actor, req.params.id),
  );

  const rtags = ['Results'];
  app.get('/results', { schema: { tags: rtags, querystring: z.object({ examCycleId: id.optional(), classOfferingId: id.optional() }), response: { 200: list(resultPublication) } }, config: admin }, async (req) => ({
    items: await c.results.list(req.actor, req.query),
  }));
  app.post('/results/calculate', { schema: { tags: rtags, body: calculateResultsRequest, response: { 200: resultPublication } }, config: admin }, (req) => c.results.calculate(req.actor, req.body));
  app.get('/results/me', { schema: { tags: rtags, response: { 200: list(myResult) } } }, async (req) => ({ items: await c.results.forStudent(req.actor) }));
  app.get('/results/:id', { schema: { tags: rtags, params: idParams, response: { 200: resultPublication } }, config: staff }, (req) => c.results.get(req.actor, req.params.id));
  app.post('/results/:id/publish', { schema: { tags: rtags, params: idParams, body: publishResultsRequest, response: { 200: resultPublication } }, config: admin }, (req) =>
    c.results.publish(req.actor, req.params.id, req.body),
  );
  app.post('/results/:id/revise', { schema: { tags: rtags, params: idParams, body: reviseResultsRequest, response: { 200: resultPublication } }, config: admin }, (req) =>
    c.results.revise(req.actor, req.params.id, req.body.reason),
  );
  app.put('/results/:id/remarks', { schema: { tags: rtags, params: idParams, body: remarksRequest, response: { 200: ok } }, config: staff }, async (req) => {
    await c.results.setRemarks(req.actor, req.params.id, req.body.studentResultId, req.body.remarks);
    return OK;
  });
  app.get('/students/:id/results', { schema: { tags: rtags, params: idParams, response: { 200: list(myResult) } } }, async (req) => ({
    items: await c.results.forStudent(req.actor, req.params.id),
  }));
  app.get('/results/:id/report-cards/:studentId', { schema: { tags: rtags, params: z.object({ id, studentId: id }), response: { 200: reportCard } } }, (req) =>
    c.results.reportCard(req.actor, req.params.id, req.params.studentId),
  );

  const ptags = ['Promotion'];
  app.get('/promotion-batches', { schema: { tags: ptags, querystring: z.object({ targetAcademicYearId: id.optional() }), response: { 200: list(promotionBatch) } }, config: admin }, async (req) => ({
    items: await c.promotion.list(req.actor, req.query.targetAcademicYearId),
  }));
  app.post('/promotion-batches', { schema: { tags: ptags, body: createPromotionBatchRequest, response: { 200: promotionBatch } }, config: admin }, (req) => c.promotion.create(req.actor, req.body));
  app.get('/promotion-batches/:id', { schema: { tags: ptags, params: idParams, response: { 200: promotionBatch } }, config: admin }, (req) => c.promotion.get(req.actor, req.params.id));
  app.patch('/promotion-decisions/:id', { schema: { tags: ptags, params: idParams, body: updatePromotionDecisionRequest, response: { 200: promotionBatch } }, config: admin }, (req) =>
    c.promotion.updateDecision(req.actor, req.params.id, req.body),
  );
  app.post('/promotion-batches/:id/approve', { schema: { tags: ptags, params: idParams, body: versioned, response: { 200: promotionBatch } }, config: admin }, (req) =>
    c.promotion.approve(req.actor, req.params.id, req.body.version),
  );
  app.post('/promotion-batches/:id/execute', { schema: { tags: ptags, params: idParams, response: { 200: promotionExecutionResult } }, config: admin }, (req) =>
    c.promotion.execute(req.actor, req.params.id, req.headers[IDEMPOTENCY_HEADER] as string | undefined),
  );
  app.post('/promotion-batches/:id/cancel', { schema: { tags: ptags, params: idParams, response: { 200: ok } }, config: admin }, async (req) => {
    await c.promotion.cancel(req.actor, req.params.id);
    return OK;
  });
}
