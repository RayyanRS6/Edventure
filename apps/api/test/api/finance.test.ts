import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../../src/platform/dates';
import { createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, type SchoolFixture } from '../support/fixtures';
import { uploadFile } from '../support/files';

let t: TestApp;
let f: SchoolFixture;
let types: Record<string, any>;
let plan: any;

beforeAll(async () => {
  t = await createTestApp();
  f = await schoolFixture(t);
  types = Object.fromEntries((await ok(f.admin.get('/fee-types'))).items.map((x: any) => [x.code, x]));
});
afterAll(async () => {
  await t?.close();
});

const statement = (studentId: string) => ok(f.admin.get(`/students/${studentId}/fee-statement`));

describe('fee plans and invoices', () => {
  it('assigns a monthly plan to a class and generates invoices idempotently', async () => {
    plan = await ok(
      f.admin.post('/fee-plans', {
        academicYearId: f.academicYear.id,
        name: 'Class 9 monthly',
        frequency: 'monthly',
        items: [
          { feeTypeId: types['TUITION'].id, amount: '4500' },
          { feeTypeId: types['TRANSPORT'].id, amount: '1500.50' },
        ],
      }),
    );
    expect(plan.total).toBe('6000.50');
    const assigned = await ok(f.admin.post(`/fee-plans/${plan.id}/assignments`, { classOfferingId: f.class9.id, startDate: f.academicYear.startDate }));
    expect(assigned.assigned).toBe(3);
    // Sibling discount for Hamza on a second, separate assignment is rejected as a duplicate plan period.
    const again = await ok(f.admin.post(`/fee-plans/${plan.id}/assignments`, { studentIds: [f.students.hamza.id], startDate: f.academicYear.startDate }));
    expect(again.alreadyAssigned).toBe(1);

    const body = { periodLabel: 'P1', issueDate: addDays(TODAY, -20), dueDate: addDays(TODAY, -10) };
    expect(await ok(f.admin.post(`/fee-plans/${plan.id}/invoices`, body))).toEqual({ created: 3, skipped: 0 });
    expect(await ok(f.admin.post(`/fee-plans/${plan.id}/invoices`, body))).toEqual({ created: 0, skipped: 3 });
    const overdue = await ok(f.admin.get('/invoices?feeStatus=overdue'));
    expect(overdue.items).toHaveLength(3);
    expect(overdue.items[0]).toMatchObject({ totalAmount: '6000.50', balance: '6000.50', feeStatus: 'unpaid', overdue: true });
  });

  it('records partial payments, overpayments as credit, and derives fee status', async () => {
    const ali = f.students.ali.id;
    await ok(f.admin.post('/payments', { studentId: ali, method: 'cash', amount: '2000', receivedOn: TODAY }));
    let s = await statement(ali);
    expect(s.invoices[0]).toMatchObject({ balance: '4000.50', feeStatus: 'partially_paid' });
    const key = { 'idempotency-key': 'cash-payment-ali-0002' };
    const p1 = await ok(f.admin.post('/payments', { studentId: ali, method: 'cash', amount: '5000', receivedOn: TODAY }, key));
    const p2 = await ok(f.admin.post('/payments', { studentId: ali, method: 'cash', amount: '5000', receivedOn: TODAY }, key));
    expect(p2.id).toBe(p1.id); // retried request did not create a second receipt
    expect(p1).toMatchObject({ allocated: '4000.50', unallocated: '999.50' });
    s = await statement(ali);
    expect(s.invoices[0].feeStatus).toBe('paid');
    expect(s.totals).toMatchObject({ balance: '0.00', credit: '999.50', overdue: '0.00' });
  });

  it('issues fines, waivers and reversals with full history', async () => {
    const sara = f.students.sara.id;
    const fine = await ok(
      f.admin.post('/invoices', { studentId: sara, issueDate: TODAY, dueDate: addDays(TODAY, 7), lines: [{ feeTypeId: types['FINE'].id, description: 'Library book lost', amount: '800' }] }),
    );
    expect(fine.lines[0].source).toBe('fine');
    await ok(f.admin.post('/adjustments', { studentId: sara, invoiceId: fine.id, kind: 'waiver', amount: '300', reason: 'Book partially recovered' }));
    const tooMuch = await f.admin.post('/adjustments', { studentId: sara, invoiceId: fine.id, kind: 'waiver', amount: '600', reason: 'x'.repeat(5) });
    expect(tooMuch.statusCode).toBe(400);
    const paid = await ok(f.admin.post('/payments', { studentId: sara, method: 'bank', amount: '500', receivedOn: TODAY, allocations: [{ invoiceId: fine.id, amount: '500' }] }));
    expect((await ok(f.admin.get(`/invoices/${fine.id}`))).feeStatus).toBe('paid');
    const reversed = await ok(f.admin.post(`/payments/${paid.id}/reverse`, { reason: 'Cheque bounced' }));
    expect(reversed.status).toBe('reversed');
    const after = await ok(f.admin.get(`/invoices/${fine.id}`));
    expect(after).toMatchObject({ balance: '500.00', feeStatus: 'partially_paid' });
    expect(after.allocations[0].reversed).toBe(true);
  });

  it('shows students only their own statement', async () => {
    const mine = await ok(f.students.ali.client.get('/fees/me'));
    expect(mine.studentId).toBe(f.students.ali.id);
    const other = await f.students.ali.client.get(`/students/${f.students.sara.id}/fee-statement`);
    expect(other.statusCode).toBe(403);
    const invoices = await ok(f.students.ali.client.get('/invoices'));
    expect(invoices.items.every((i: any) => i.studentId === f.students.ali.id)).toBe(true);
  });

  it('previews and sends reminders without amounts in the notification', async () => {
    const preview = await ok(f.admin.post('/fees/reminders/preview', { overdueOnly: true }));
    expect(preview.items.map((x: any) => x.displayName).sort()).toEqual(['Hamza Tariq', 'Sara Iqbal']);
    const sent = await ok(f.admin.post('/fees/reminders/send', { studentIds: preview.items.map((x: any) => x.studentId) }));
    expect(sent.sent).toBe(2);
    const again = await ok(f.admin.post('/fees/reminders/send', { studentIds: preview.items.map((x: any) => x.studentId) }));
    expect(again.sent).toBe(0); // deduplicated per day
    const inbox = await ok(f.students.hamza.client.get('/notifications'));
    const reminder = inbox.items.find((n: any) => n.kind === 'fee.reminder');
    expect(JSON.stringify(reminder.data)).not.toMatch(/\d{3,}/);
    const summary = await ok(f.admin.get('/fees/summary'));
    expect(summary.studentsOverdue).toBe(2);
  });
});

describe('bank reconciliation', () => {
  let profile: any;
  let batch: any;

  it('validates a statement, matches exact references only and flags duplicates', async () => {
    const accounts = await ok(f.admin.post('/bank-accounts', { name: 'Fee collection', bankName: 'HBL', accountNumberMasked: '****1234' }));
    const profiles = await ok(
      f.admin.post('/bank-import-profiles', {
        bankAccountId: accounts.items[0].id,
        name: 'HBL CSV',
        mapping: {
          columns: { date: 'Txn Date', credit: 'Credit', debit: 'Debit', transactionId: 'Txn ID', description: 'Narration', reference: 'Narration' },
          dateFormat: 'DD/MM/YYYY',
          referencePattern: '(INV-\\d{6}|B-\\d{3})',
        },
      }),
    );
    profile = profiles.items[0];
    const hamzaInvoice = (await ok(f.admin.get(`/invoices?studentId=${f.students.hamza.id}`))).items[0];
    const day = `${TODAY.slice(8, 10)}/${TODAY.slice(5, 7)}/${TODAY.slice(0, 4)}`;
    const csv = [
      'Txn Date,Txn ID,Narration,Debit,Credit',
      `${day},T100,FEE ${hamzaInvoice.invoiceNumber} HAMZA,,"6,000.50"`,
      `${day},T101,FEE B-001 PAYMENT,,1000.00`,
      `${day},T102,Payment from Ali Raza,,2500.00`,
      `${day},T103,Bank charges,150.00,`,
      `31/02/2026,T104,Bad date,,10.00`,
    ].join('\n');
    const fileId = await uploadFile(t, f.admin, 'import', 'statement.csv', Buffer.from(csv), 'text/csv');
    batch = await ok(f.admin.post('/bank-imports', { bankImportProfileId: profile.id, fileId }));
    expect(batch.state).toBe('invalid'); // the bad date blocks the whole batch
    const statuses = Object.fromEntries(batch.rows.map((r: any) => [r.raw['Txn ID'], r.status]));
    expect(statuses).toMatchObject({ T100: 'matched', T101: 'matched', T102: 'unmatched', T103: 'skipped', T104: 'invalid' });
    // A student's name alone never produces a match.
    expect(batch.rows.find((r: any) => r.raw['Txn ID'] === 'T102').evidence.match).toBeUndefined();
  });

  it('commits a valid statement once and treats a re-import as duplicates', async () => {
    const hamzaInvoice = (await ok(f.admin.get(`/invoices?studentId=${f.students.hamza.id}`))).items[0];
    const day = `${TODAY.slice(8, 10)}/${TODAY.slice(5, 7)}/${TODAY.slice(0, 4)}`;
    const csv = [
      'Txn Date,Txn ID,Narration,Debit,Credit',
      `${day},T100,FEE ${hamzaInvoice.invoiceNumber} HAMZA,,"6,000.50"`,
      `${day},T102,Payment from Ali Raza,,2500.00`,
    ].join('\n');
    const fileId = await uploadFile(t, f.admin, 'import', 'statement-fixed.csv', Buffer.from(csv), 'text/csv');
    batch = await ok(f.admin.post('/bank-imports', { bankImportProfileId: profile.id, fileId }));
    expect(batch.state).toBe('validated');
    const unmatched = batch.rows.find((r: any) => r.status === 'unmatched');
    await ok(f.admin.patch(`/bank-imports/${batch.id}/rows/${unmatched.id}`, { action: 'unallocated' }));
    const committed = await ok(f.admin.post(`/bank-imports/${batch.id}/commit`, {}, { 'idempotency-key': 'bank-commit-00001' }));
    expect(committed.state).toBe('committed');
    const hamza = await statement(f.students.hamza.id);
    expect(hamza.totals.balance).toBe('0.00');
    const unallocated = await ok(f.admin.get('/payments?unallocated=true'));
    expect(unallocated.items.some((p: any) => p.amount === '2500.00' && p.studentId === null)).toBe(true);

    const replayFile = await uploadFile(t, f.admin, 'import', 'statement-again.csv', Buffer.from(csv), 'text/csv');
    const replay = await ok(f.admin.post('/bank-imports', { bankImportProfileId: profile.id, fileId: replayFile }));
    expect(replay.rows.map((r: any) => r.status)).toEqual(['duplicate', 'duplicate']);
    expect(replay.summary.previouslyImportedBatchIds).toContain(batch.id);
  });
});
