import { z } from 'zod';
import {
  allocatePaymentRequest,
  assignFeePlanRequest,
  assignmentResult,
  bankAccount,
  bankImportProfile,
  createAdjustmentRequest,
  createBankAccountRequest,
  createBankImportProfileRequest,
  createBankImportRequest,
  createFeePlanRequest,
  createFeeTypeRequest,
  feePlan,
  feeStatement,
  feeSummary,
  feeType,
  generateInvoicesRequest,
  generationResult,
  id,
  IDEMPOTENCY_HEADER,
  importBatch,
  importBatchDetail,
  importRowsQuery,
  invoiceDetail,
  invoiceListQuery,
  invoicePage,
  manualChargeRequest,
  payment,
  paymentListQuery,
  paymentPage,
  recordPaymentRequest,
  reminderCandidate,
  reminderPreviewRequest,
  resolveBankRowRequest,
  reversePaymentRequest,
  sendRemindersRequest,
  updateFeePlanRequest,
  voidInvoiceRequest,
} from '@edventure/contracts';
import type { Container } from '../../container';
import { idParams, list, ok, OK, reasonBody } from '../../http/schemas';
import type { App } from '../../http/types';

export function registerFinanceRoutes(app: App, c: Container) {
  const tags = ['Fees'];
  const admin = { roles: ['school_admin' as const] };
  const idem = (headers: Record<string, unknown>) => headers[IDEMPOTENCY_HEADER] as string | undefined;

  app.get('/fee-types', { schema: { tags, response: { 200: list(feeType) } }, config: admin }, async (req) => ({ items: await c.fees.listFeeTypes(req.actor) }));
  app.post('/fee-types', { schema: { tags, body: createFeeTypeRequest, response: { 200: list(feeType) } }, config: admin }, async (req) => ({ items: await c.fees.createFeeType(req.actor, req.body) }));
  app.get('/fee-plans', { schema: { tags, querystring: z.object({ academicYearId: id.optional() }), response: { 200: list(feePlan) } }, config: admin }, async (req) => ({
    items: await c.fees.listPlans(req.actor, req.query.academicYearId),
  }));
  app.post('/fee-plans', { schema: { tags, body: createFeePlanRequest, response: { 200: feePlan } }, config: admin }, (req) => c.fees.createPlan(req.actor, req.body));
  app.patch('/fee-plans/:id', { schema: { tags, params: idParams, body: updateFeePlanRequest, response: { 200: feePlan } }, config: admin }, (req) => c.fees.updatePlan(req.actor, req.params.id, req.body));
  app.post('/fee-plans/:id/assignments', { schema: { tags, params: idParams, body: assignFeePlanRequest, response: { 200: assignmentResult } }, config: admin }, (req) =>
    c.fees.assignPlan(req.actor, req.params.id, req.body),
  );
  app.post('/fee-plans/:id/invoices', { schema: { tags, params: idParams, body: generateInvoicesRequest, response: { 200: generationResult } }, config: admin }, (req) =>
    c.fees.generateInvoices(req.actor, req.params.id, req.body),
  );

  app.get('/invoices', { schema: { tags, querystring: invoiceListQuery, response: { 200: invoicePage } } }, (req) => c.fees.listInvoices(req.actor, req.query));
  app.post('/invoices', { schema: { tags, body: manualChargeRequest, response: { 200: invoiceDetail } }, config: admin }, (req) => c.fees.createCharge(req.actor, req.body));
  app.get('/invoices/:id', { schema: { tags, params: idParams, response: { 200: invoiceDetail } } }, (req) => c.fees.getInvoice(req.actor, req.params.id));
  app.post('/invoices/:id/void', { schema: { tags, params: idParams, body: voidInvoiceRequest, response: { 200: ok } }, config: admin }, async (req) => {
    await c.fees.voidInvoice(req.actor, req.params.id, req.body);
    return OK;
  });

  app.get('/payments', { schema: { tags, querystring: paymentListQuery, response: { 200: paymentPage } }, config: admin }, (req) => c.fees.listPayments(req.actor, req.query));
  app.post('/payments', { schema: { tags, body: recordPaymentRequest, response: { 200: payment } }, config: admin }, (req) => c.fees.recordPayment(req.actor, req.body, idem(req.headers)));
  app.get('/payments/:id', { schema: { tags, params: idParams, response: { 200: payment } } }, (req) => c.fees.getPayment(req.actor, req.params.id));
  app.post('/payments/:id/allocations', { schema: { tags, params: idParams, body: allocatePaymentRequest, response: { 200: payment } }, config: admin }, (req) =>
    c.fees.allocate(req.actor, req.params.id, req.body),
  );
  app.post('/payments/:id/reverse', { schema: { tags, params: idParams, body: reversePaymentRequest, response: { 200: payment } }, config: admin }, (req) =>
    c.fees.reversePayment(req.actor, req.params.id, req.body.reason),
  );
  app.post('/adjustments', { schema: { tags, body: createAdjustmentRequest, response: { 200: z.object({ id }) } }, config: admin }, async (req) => ({
    id: (await c.fees.createAdjustment(req.actor, req.body)).id,
  }));
  app.post('/adjustments/:id/reverse', { schema: { tags, params: idParams, body: reasonBody, response: { 200: ok } }, config: admin }, async (req) => {
    await c.fees.reverseAdjustment(req.actor, req.params.id, req.body.reason);
    return OK;
  });
  app.get('/students/:id/fee-statement', { schema: { tags, params: idParams, response: { 200: feeStatement } } }, (req) => c.fees.statement(req.actor, req.params.id));
  app.get('/fees/me', { schema: { tags, response: { 200: feeStatement } }, config: { roles: ['student'] } }, (req) => c.fees.statement(req.actor, req.actor.studentId!));
  app.get('/fees/summary', { schema: { tags, querystring: z.object({ academicYearId: id.optional() }), response: { 200: feeSummary } }, config: admin }, (req) =>
    c.fees.summary(req.actor, req.query.academicYearId),
  );
  app.post('/fees/reminders/preview', { schema: { tags, body: reminderPreviewRequest, response: { 200: list(reminderCandidate) } }, config: admin }, async (req) => ({
    items: await c.fees.reminderPreview(req.actor, req.body),
  }));
  app.post('/fees/reminders/send', { schema: { tags, body: sendRemindersRequest, response: { 200: z.object({ sent: z.number().int() }) } }, config: admin }, (req) =>
    c.fees.sendReminders(req.actor, req.body.studentIds),
  );

  const btags = ['Bank reconciliation'];
  app.get('/bank-accounts', { schema: { tags: btags, response: { 200: list(bankAccount) } }, config: admin }, async (req) => ({ items: await c.bank.listAccounts(req.actor) }));
  app.post('/bank-accounts', { schema: { tags: btags, body: createBankAccountRequest, response: { 200: list(bankAccount) } }, config: admin }, async (req) => ({
    items: await c.bank.createAccount(req.actor, req.body),
  }));
  app.get('/bank-import-profiles', { schema: { tags: btags, response: { 200: list(bankImportProfile) } }, config: admin }, async (req) => ({ items: await c.bank.listProfiles(req.actor) }));
  app.post('/bank-import-profiles', { schema: { tags: btags, body: createBankImportProfileRequest, response: { 200: list(bankImportProfile) } }, config: admin }, async (req) => ({
    items: await c.bank.createProfile(req.actor, req.body),
  }));
  app.get('/bank-imports', { schema: { tags: btags, response: { 200: list(importBatch) } }, config: admin }, async (req) => ({ items: await c.bank.list(req.actor) }));
  app.post('/bank-imports', { schema: { tags: btags, body: createBankImportRequest, response: { 200: importBatchDetail } }, config: admin }, (req) => c.bank.create(req.actor, req.body));
  app.get('/bank-imports/:id', { schema: { tags: btags, params: idParams, querystring: importRowsQuery, response: { 200: importBatchDetail } }, config: admin }, (req) =>
    c.bank.get(req.actor, req.params.id, req.query),
  );
  app.patch(
    '/bank-imports/:id/rows/:rowId',
    { schema: { tags: btags, params: z.object({ id, rowId: id }), body: resolveBankRowRequest, response: { 200: importBatchDetail } }, config: admin },
    (req) => c.bank.resolveRow(req.actor, req.params.id, req.params.rowId, req.body),
  );
  app.post('/bank-imports/:id/commit', { schema: { tags: btags, params: idParams, response: { 200: importBatchDetail } }, config: admin }, (req) =>
    c.bank.commit(req.actor, req.params.id, idem(req.headers)),
  );
}
