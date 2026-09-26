import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { FeePlan, FeeStatement, InvoiceSummary, Payment } from '@edventure/contracts';
import {
  allocatePaymentRequest,
  assignFeePlanRequest,
  createAdjustmentRequest,
  createFeePlanRequest,
  createFeeTypeRequest,
  generateInvoicesRequest,
  invoiceListQuery,
  manualChargeRequest,
  paymentListQuery,
  recordPaymentRequest,
  reminderPreviewRequest,
  updateFeePlanRequest,
  voidInvoiceRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  documentCounters,
  feePlanItems,
  feePlans,
  feeTypes,
  financialAdjustments,
  invoiceLines,
  invoices,
  paymentAllocations,
  payments,
  schools,
  studentEnrollments,
  studentFeeAssignments,
  students,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { D, dec, sum } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { withIdempotency } from '../../platform/idempotency';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { assertCanViewStudent, requireAdmin, today } from '../../platform/scope';
import { studentAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';

type InvoiceRow = typeof invoices.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export async function nextNumber(tx: Tx, schoolId: string, kind: 'invoice' | 'receipt') {
  const [row] = await tx
    .insert(documentCounters)
    .values({ schoolId, kind, nextValue: 1 })
    .onConflictDoUpdate({ target: [documentCounters.schoolId, documentCounters.kind], set: { nextValue: sql`${documentCounters.nextValue} + 1` } })
    .returning({ value: documentCounters.nextValue });
  return `${kind === 'invoice' ? 'INV' : 'RCT'}-${String(row!.value).padStart(6, '0')}`;
}

export function feeStatusOf(inv: Pick<InvoiceRow, 'totalAmount' | 'paidAmount' | 'adjustedAmount'>) {
  const balance = dec(inv.totalAmount).minus(inv.paidAmount).minus(inv.adjustedAmount);
  const settled = dec(inv.paidAmount).plus(inv.adjustedAmount);
  const status = balance.lte(0) ? 'paid' : settled.gt(0) ? 'partially_paid' : 'unpaid';
  return { balance, status: status as 'unpaid' | 'partially_paid' | 'paid' };
}

const BALANCE = sql`(${invoices.totalAmount} - ${invoices.paidAmount} - ${invoices.adjustedAmount})`;

/**
 * Charges and payments are modelled separately; fee status is always derived from balances.
 * Invoice totals are maintained by database triggers from lines, allocations and waivers.
 */
export class FeesService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Fee types and plans ---------------- */

  async listFeeTypes(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(feeTypes).orderBy(asc(feeTypes.name))).map((f) => ({ id: f.id, code: f.code, name: f.name, nameUr: f.nameUr, kind: f.kind, archived: f.archivedAt !== null })),
    );
  }

  async createFeeType(actor: Actor, raw: z.input<typeof createFeeTypeRequest>) {
    requireAdmin(actor);
    const input = createFeeTypeRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.insert(feeTypes).values({ schoolId: actor.schoolId, ...input, nameUr: input.nameUr ?? null }).returning();
      await audit(tx, actor, { action: 'fee_type.created', entityType: 'fee_type', entityId: row!.id });
    });
    return this.listFeeTypes(actor);
  }

  private async toPlan(tx: Tx, planId: string): Promise<FeePlan> {
    const [p] = await tx.select().from(feePlans).where(eq(feePlans.id, planId));
    const plan = required(p, 'Fee plan');
    const items = await tx
      .select({ i: feePlanItems, name: feeTypes.name })
      .from(feePlanItems)
      .innerJoin(feeTypes, eq(feeTypes.id, feePlanItems.feeTypeId))
      .where(eq(feePlanItems.feePlanId, planId))
      .orderBy(asc(feeTypes.name));
    const [{ n } = { n: 0 }] = await tx.execute<{ n: number }>(sql`
      select count(distinct student_id)::int as n from app.student_fee_assignments where fee_plan_id = ${planId} and (end_date is null or end_date > ${new Date().toISOString().slice(0, 10)})`);
    return {
      id: plan.id,
      academicYearId: plan.academicYearId,
      name: plan.name,
      frequency: plan.frequency,
      dueDay: plan.dueDay,
      state: plan.state,
      items: items.map(({ i, name }) => ({ id: i.id, feeTypeId: i.feeTypeId, feeTypeName: name, amount: i.amount, description: i.description })),
      total: sum(items.map((x) => x.i.amount)).toFixed(2),
      assignedCount: n,
      version: plan.version,
    };
  }

  async listPlans(actor: Actor, academicYearId?: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const rows = await tx.select({ id: feePlans.id }).from(feePlans).where(academicYearId ? eq(feePlans.academicYearId, academicYearId) : undefined).orderBy(asc(feePlans.name));
      return Promise.all(rows.map((r) => this.toPlan(tx, r.id)));
    });
  }

  async createPlan(actor: Actor, raw: z.input<typeof createFeePlanRequest>) {
    requireAdmin(actor);
    const input = createFeePlanRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [plan] = await tx
        .insert(feePlans)
        .values({ schoolId: actor.schoolId, academicYearId: input.academicYearId, name: input.name, frequency: input.frequency, dueDay: input.dueDay, state: 'active' })
        .returning();
      await tx.insert(feePlanItems).values(
        input.items.map((i) => ({ schoolId: actor.schoolId, feePlanId: plan!.id, feeTypeId: i.feeTypeId, amount: dec(i.amount).toFixed(2), description: i.description ?? null })),
      );
      await audit(tx, actor, { action: 'fee_plan.created', entityType: 'fee_plan', entityId: plan!.id });
      return this.toPlan(tx, plan!.id);
    });
  }

  /** Changing amounts affects future invoices only; issued invoices keep their lines. */
  async updatePlan(actor: Actor, planId: string, raw: z.input<typeof updateFeePlanRequest>) {
    requireAdmin(actor);
    const input = updateFeePlanRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(feePlans).where(eq(feePlans.id, planId)).for('update');
      const plan = required(p, 'Fee plan');
      if (plan.version !== input.version) throw errors.version();
      await tx
        .update(feePlans)
        .set({ ...(input.name ? { name: input.name } : {}), ...(input.dueDay ? { dueDay: input.dueDay } : {}), ...(input.state ? { state: input.state } : {}), version: plan.version + 1 })
        .where(eq(feePlans.id, planId));
      if (input.items) {
        await tx.delete(feePlanItems).where(eq(feePlanItems.feePlanId, planId));
        await tx.insert(feePlanItems).values(
          input.items.map((i) => ({ schoolId: actor.schoolId, feePlanId: planId, feeTypeId: i.feeTypeId, amount: dec(i.amount).toFixed(2), description: i.description ?? null })),
        );
      }
      await audit(tx, actor, { action: 'fee_plan.updated', entityType: 'fee_plan', entityId: planId });
      return this.toPlan(tx, planId);
    });
  }

  async assignPlan(actor: Actor, planId: string, raw: z.input<typeof assignFeePlanRequest>) {
    requireAdmin(actor);
    const input = assignFeePlanRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(feePlans).where(eq(feePlans.id, planId));
      const plan = required(p, 'Fee plan');
      const date = input.startDate;
      const candidates = await tx.execute<{ student_id: string; enrollment_id: string }>(sql`
        select e.student_id, e.id as enrollment_id from app.student_enrollments e
        where e.academic_year_id = ${plan.academicYearId} and e.status = 'active'
        ${input.studentIds?.length ? sql`and e.student_id in ${input.studentIds}` : sql``}
        ${input.classOfferingId ? sql`and e.class_offering_id = ${input.classOfferingId}` : sql``}
        ${input.sectionId ? sql`and exists (select 1 from app.student_placements p where p.enrollment_id = e.id and p.section_id = ${input.sectionId}
          and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date}))` : sql``}`);
      let assigned = 0;
      let already = 0;
      for (const c of candidates) {
        const [existing] = await tx
          .select({ id: studentFeeAssignments.id })
          .from(studentFeeAssignments)
          .where(and(eq(studentFeeAssignments.studentId, c.student_id), eq(studentFeeAssignments.feePlanId, planId), or(isNull(studentFeeAssignments.endDate), gt(studentFeeAssignments.endDate, date))));
        if (existing) {
          already++;
          continue;
        }
        await tx.insert(studentFeeAssignments).values({
          schoolId: actor.schoolId,
          studentId: c.student_id,
          enrollmentId: c.enrollment_id,
          feePlanId: planId,
          startDate: date,
          discountPercentage: input.discountPercentage ?? null,
          note: input.note ?? null,
        });
        assigned++;
      }
      await audit(tx, actor, { action: 'fee_plan.assigned', entityType: 'fee_plan', entityId: planId, summary: { assigned, already } });
      return { assigned, alreadyAssigned: already };
    });
  }

  /** Idempotent: each (plan, period, student) produces at most one invoice. */
  async generateInvoices(actor: Actor, planId: string, raw: z.input<typeof generateInvoicesRequest>) {
    requireAdmin(actor);
    const input = generateInvoicesRequest.parse(raw);
    if (input.dueDate < input.issueDate) throw errors.field('dueDate', 'The due date cannot be before the issue date');
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(feePlans).where(eq(feePlans.id, planId));
      const plan = required(p, 'Fee plan');
      if (plan.state !== 'active') throw errors.rule('Only active fee plans generate invoices.');
      const items = await tx.select().from(feePlanItems).where(eq(feePlanItems.feePlanId, planId));
      const assignments = await tx
        .select({ a: studentFeeAssignments })
        .from(studentFeeAssignments)
        .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentFeeAssignments.enrollmentId))
        .where(
          and(
            eq(studentFeeAssignments.feePlanId, planId),
            sql`${studentFeeAssignments.startDate} <= ${input.issueDate}`,
            or(isNull(studentFeeAssignments.endDate), gt(studentFeeAssignments.endDate, input.issueDate)),
            eq(studentEnrollments.status, 'active'),
          ),
        );
      let created = 0;
      let skipped = 0;
      for (const { a } of assignments) {
        const key = `${planId}:${input.periodLabel}:${a.studentId}`;
        const [exists] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.generationKey, key));
        if (exists) {
          skipped++;
          continue;
        }
        const factor = a.discountPercentage ? new D(100).minus(a.discountPercentage).div(100) : new D(1);
        const lines = items.map((i) => ({ i, amount: new D(i.amount).mul(factor).toDecimalPlaces(2) })).filter((l) => l.amount.gt(0));
        if (!lines.length) {
          skipped++;
          continue;
        }
        const [inv] = await tx
          .insert(invoices)
          .values({
            schoolId: actor.schoolId,
            studentId: a.studentId,
            enrollmentId: a.enrollmentId,
            academicYearId: plan.academicYearId,
            invoiceNumber: await nextNumber(tx, actor.schoolId, 'invoice'),
            periodLabel: input.periodLabel,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            generationKey: key,
          })
          .returning();
        await tx.insert(invoiceLines).values(
          lines.map((l) => ({
            schoolId: actor.schoolId,
            invoiceId: inv!.id,
            feeTypeId: l.i.feeTypeId,
            description: l.i.description ?? `${plan.name} — ${input.periodLabel}`,
            amount: l.amount.toFixed(2),
            source: 'plan' as const,
          })),
        );
        created++;
      }
      await audit(tx, actor, { action: 'invoices.generated', entityType: 'fee_plan', entityId: planId, summary: { periodLabel: input.periodLabel, created, skipped } });
      return { created, skipped };
    });
  }

  /* ---------------- Invoices ---------------- */

  private async toSummaries(tx: Tx, rows: InvoiceRow[], date: string): Promise<InvoiceSummary[]> {
    if (!rows.length) return [];
    const people = await tx
      .select({ id: students.id, name: accounts.displayName, adm: students.admissionNumber })
      .from(students)
      .innerJoin(accounts, eq(accounts.id, students.accountId))
      .where(inArray(students.id, [...new Set(rows.map((r) => r.studentId))]));
    return rows.map((r) => {
      const s = people.find((p) => p.id === r.studentId);
      const { balance, status } = feeStatusOf(r);
      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        studentId: r.studentId,
        studentName: s?.name ?? '',
        admissionNumber: s?.adm ?? '',
        periodLabel: r.periodLabel,
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        status: r.status,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        adjustedAmount: r.adjustedAmount,
        balance: balance.toFixed(2),
        feeStatus: status,
        overdue: r.status === 'open' && balance.gt(0) && r.dueDate < date,
        version: r.version,
      };
    });
  }

  async listInvoices(actor: Actor, raw: z.input<typeof invoiceListQuery>) {
    const q = invoiceListQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const conditions: SQL[] = [];
      if (!isAdmin(actor)) {
        if (!actor.studentId) throw errors.forbidden();
        conditions.push(eq(invoices.studentId, actor.studentId));
      } else if (q.studentId) conditions.push(eq(invoices.studentId, q.studentId));
      if (q.includeVoid !== 'true') conditions.push(eq(invoices.status, 'open'));
      if (q.periodLabel) conditions.push(eq(invoices.periodLabel, q.periodLabel));
      if (q.classOfferingId) conditions.push(sql`exists (select 1 from app.student_enrollments e where e.id = ${invoices.enrollmentId} and e.class_offering_id = ${q.classOfferingId})`);
      if (q.sectionId) {
        conditions.push(sql`exists (select 1 from app.student_placements p where p.student_id = ${invoices.studentId} and p.section_id = ${q.sectionId}
          and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date}))`);
      }
      if (q.feeStatus === 'paid') conditions.push(sql`${BALANCE} <= 0`);
      if (q.feeStatus === 'unpaid') conditions.push(sql`${BALANCE} > 0 and ${invoices.paidAmount} + ${invoices.adjustedAmount} = 0`);
      if (q.feeStatus === 'partially_paid') conditions.push(sql`${BALANCE} > 0 and ${invoices.paidAmount} + ${invoices.adjustedAmount} > 0`);
      if (q.feeStatus === 'outstanding') conditions.push(sql`${BALANCE} > 0`);
      if (q.feeStatus === 'overdue') conditions.push(sql`${BALANCE} > 0 and ${invoices.dueDate} < ${date}`);
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(lt(invoices.dueDate, cursor[0]), and(eq(invoices.dueDate, cursor[0]), lt(invoices.id, cursor[1])))!);
      const rows = await tx.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.dueDate), desc(invoices.id)).limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      return { items: await this.toSummaries(tx, page, date), nextCursor: rows.length > q.limit && last ? encodeCursor([last.dueDate, last.id]) : null };
    });
  }

  async getInvoice(actor: Actor, invoiceId: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      const inv = required(row, 'Invoice');
      if (!isAdmin(actor) && inv.studentId !== actor.studentId) throw errors.notFound('Invoice');
      const [summary] = await this.toSummaries(tx, [inv], today(actor));
      const lines = await tx.select({ l: invoiceLines, name: feeTypes.name }).from(invoiceLines).innerJoin(feeTypes, eq(feeTypes.id, invoiceLines.feeTypeId)).where(eq(invoiceLines.invoiceId, invoiceId));
      const allocs = await tx
        .select({ a: paymentAllocations, p: payments })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(eq(paymentAllocations.invoiceId, invoiceId));
      const adjs = await tx.select().from(financialAdjustments).where(eq(financialAdjustments.invoiceId, invoiceId));
      return {
        ...summary!,
        lines: lines.map(({ l, name }) => ({ id: l.id, feeTypeId: l.feeTypeId, feeTypeName: name, description: l.description, amount: l.amount, source: l.source })),
        allocations: allocs.map(({ a, p }) => ({ id: a.id, paymentId: p.id, receiptNumber: p.receiptNumber, amount: a.amount, receivedOn: p.receivedOn, reversed: a.reversedAt !== null })),
        adjustments: adjs.map((x) => ({ id: x.id, kind: x.kind, amount: x.amount, reason: x.reason, reversed: x.reversedAt !== null, createdAt: x.createdAt.toISOString() })),
      };
    });
  }

  /** Manual charges and administrator-issued fines (fee type of kind "fine" become fine lines). */
  async createCharge(actor: Actor, raw: z.input<typeof manualChargeRequest>) {
    requireAdmin(actor);
    const input = manualChargeRequest.parse(raw);
    if (input.dueDate < input.issueDate) throw errors.field('dueDate', 'The due date cannot be before the issue date');
    const id = await this.run(actor, async (tx) => {
      const [enrollment] = await tx.select().from(studentEnrollments).where(and(eq(studentEnrollments.studentId, input.studentId), eq(studentEnrollments.status, 'active')));
      const [student] = await tx.select().from(students).where(eq(students.id, input.studentId));
      required(student, 'Student');
      const types = await tx.select().from(feeTypes).where(inArray(feeTypes.id, input.lines.map((l) => l.feeTypeId)));
      const yearId = enrollment?.academicYearId ?? (await tx.execute<{ id: string }>(sql`select id from app.academic_years order by (status = 'active') desc, start_date desc limit 1`))[0]?.id;
      if (!yearId) throw errors.rule('Create an academic year first.');
      const [inv] = await tx
        .insert(invoices)
        .values({
          schoolId: actor.schoolId,
          studentId: input.studentId,
          enrollmentId: enrollment?.id ?? null,
          academicYearId: yearId,
          invoiceNumber: await nextNumber(tx, actor.schoolId, 'invoice'),
          periodLabel: input.periodLabel,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
        })
        .returning();
      await tx.insert(invoiceLines).values(
        input.lines.map((l) => ({
          schoolId: actor.schoolId,
          invoiceId: inv!.id,
          feeTypeId: l.feeTypeId,
          description: l.description,
          amount: dec(l.amount).toFixed(2),
          source: types.find((t) => t.id === l.feeTypeId)?.kind === 'fine' ? ('fine' as const) : ('manual' as const),
          createdByAccountId: actor.accountId,
        })),
      );
      await audit(tx, actor, { action: 'invoice.charged', entityType: 'invoice', entityId: inv!.id, summary: { studentId: input.studentId, lines: input.lines.length } });
      return inv!.id;
    });
    return this.getInvoice(actor, id);
  }

  async voidInvoice(actor: Actor, invoiceId: string, raw: z.input<typeof voidInvoiceRequest>) {
    requireAdmin(actor);
    const input = voidInvoiceRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update');
      const inv = required(row, 'Invoice');
      if (inv.version !== input.version) throw errors.version();
      if (dec(inv.paidAmount).gt(0) || dec(inv.adjustedAmount).gt(0)) throw errors.rule('Reverse the payments and waivers on this invoice before voiding it.');
      await tx.update(invoices).set({ status: 'void', voidReason: input.reason, version: inv.version + 1 }).where(eq(invoices.id, invoiceId));
      await audit(tx, actor, { action: 'invoice.voided', entityType: 'invoice', entityId: invoiceId, reason: input.reason });
    });
  }

  /* ---------------- Payments ---------------- */

  private async toPayments(tx: Tx, rows: PaymentRow[]): Promise<Payment[]> {
    if (!rows.length) return [];
    const allocs = await tx
      .select({ a: paymentAllocations, number: invoices.invoiceNumber })
      .from(paymentAllocations)
      .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
      .where(inArray(paymentAllocations.paymentId, rows.map((r) => r.id)));
    const studentIds = [...new Set(rows.map((r) => r.studentId).filter(Boolean) as string[])];
    const names = studentIds.length
      ? await tx.select({ id: students.id, name: accounts.displayName }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(inArray(students.id, studentIds))
      : [];
    return rows.map((p) => {
      const mine = allocs.filter((a) => a.a.paymentId === p.id);
      const allocated = sum(mine.filter((a) => !a.a.reversedAt).map((a) => a.a.amount));
      return {
        id: p.id,
        receiptNumber: p.receiptNumber,
        studentId: p.studentId,
        studentName: names.find((n) => n.id === p.studentId)?.name ?? null,
        method: p.method,
        amount: p.amount,
        allocated: allocated.toFixed(2),
        unallocated: p.status === 'posted' ? dec(p.amount).minus(allocated).toFixed(2) : '0.00',
        receivedOn: p.receivedOn,
        bankTransactionId: p.bankTransactionId,
        payerReference: p.payerReference,
        description: p.description,
        status: p.status,
        reversalReason: p.reversalReason,
        allocations: mine.map((a) => ({ id: a.a.id, invoiceId: a.a.invoiceId, invoiceNumber: a.number, amount: a.a.amount, reversed: a.a.reversedAt !== null })),
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  /** Allocates to specific invoices or, by default, to the student's oldest open balances. */
  async allocateInTx(tx: Tx, actor: Actor, paymentId: string, studentId: string, explicit?: Array<{ invoiceId: string; amount: string }>) {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
    const pay = required(p, 'Payment');
    if (pay.status !== 'posted') throw errors.rule('This payment has been reversed.');
    const [{ allocated } = { allocated: '0' }] = await tx.execute<{ allocated: string }>(sql`
      select coalesce(sum(amount), 0)::text as allocated from app.payment_allocations where payment_id = ${paymentId} and reversed_at is null`);
    let remaining = dec(pay.amount).minus(allocated);
    const plan: Array<{ invoiceId: string; amount: string }> = [];
    if (explicit?.length) {
      const total = sum(explicit.map((e) => e.amount));
      if (total.gt(remaining)) throw errors.field('allocations', `Only ${remaining.toFixed(2)} of this payment is unallocated`);
      const rows = await tx.select().from(invoices).where(inArray(invoices.id, explicit.map((e) => e.invoiceId))).for('update');
      for (const e of explicit) {
        const inv = rows.find((r) => r.id === e.invoiceId);
        if (!inv || inv.studentId !== studentId || inv.status !== 'open') throw errors.field('allocations', 'Allocate only to this student’s open invoices');
        if (dec(e.amount).gt(feeStatusOf(inv).balance)) throw errors.field('allocations', `Invoice ${inv.invoiceNumber} has a balance of ${feeStatusOf(inv).balance.toFixed(2)}`);
        plan.push({ invoiceId: e.invoiceId, amount: dec(e.amount).toFixed(2) });
      }
    } else {
      const open = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.studentId, studentId), eq(invoices.status, 'open'), sql`${BALANCE} > 0`))
        .orderBy(asc(invoices.dueDate), asc(invoices.issueDate), asc(invoices.invoiceNumber))
        .for('update');
      for (const inv of open) {
        if (remaining.lte(0)) break;
        const take = D.min(remaining, feeStatusOf(inv).balance);
        plan.push({ invoiceId: inv.id, amount: take.toFixed(2) });
        remaining = remaining.minus(take);
      }
    }
    for (const a of plan) {
      await tx.insert(paymentAllocations).values({ schoolId: actor.schoolId, paymentId, invoiceId: a.invoiceId, amount: a.amount, createdByAccountId: actor.accountId });
    }
    return plan;
  }

  async recordPayment(actor: Actor, raw: z.input<typeof recordPaymentRequest>, idempotencyKey?: string) {
    requireAdmin(actor);
    const input = recordPaymentRequest.parse(raw);
    if (input.allocations?.length && !input.studentId) throw errors.field('studentId', 'Choose the student to allocate to');
    const id = await this.run(actor, async (tx) =>
      (
        await withIdempotency(tx, actor, 'payments:record', idempotencyKey, input, async () => {
          const [p] = await tx
            .insert(payments)
            .values({
              schoolId: actor.schoolId,
              studentId: input.studentId ?? null,
              bankAccountId: input.bankAccountId ?? null,
              method: input.method,
              amount: dec(input.amount).toFixed(2),
              receivedOn: input.receivedOn,
              bankTransactionId: input.bankTransactionId ?? null,
              payerReference: input.payerReference ?? null,
              description: input.description ?? null,
              receiptNumber: await nextNumber(tx, actor.schoolId, 'receipt'),
              recordedByAccountId: actor.accountId,
            })
            .returning();
          if (input.studentId) await this.allocateInTx(tx, actor, p!.id, input.studentId, input.allocations);
          await audit(tx, actor, { action: 'payment.recorded', entityType: 'payment', entityId: p!.id, summary: { studentId: input.studentId, method: input.method } });
          return { status: 200, body: p!.id };
        })
      ).body,
    );
    return this.getPayment(actor, id);
  }

  async allocate(actor: Actor, paymentId: string, raw: z.input<typeof allocatePaymentRequest>) {
    requireAdmin(actor);
    const input = allocatePaymentRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
      const pay = required(p, 'Payment');
      const studentId = pay.studentId ?? input.studentId;
      if (!studentId) throw errors.field('studentId', 'Choose the student this receipt belongs to');
      if (pay.studentId && input.studentId && pay.studentId !== input.studentId) throw errors.field('studentId', 'This payment belongs to another student');
      if (!pay.studentId) await tx.update(payments).set({ studentId }).where(eq(payments.id, paymentId));
      await this.allocateInTx(tx, actor, paymentId, studentId, input.allocations);
      await audit(tx, actor, { action: 'payment.allocated', entityType: 'payment', entityId: paymentId, summary: { studentId, allocations: input.allocations.length } });
    });
    return this.getPayment(actor, paymentId);
  }

  /** Posted payments are never edited: a reversal releases all allocations; record a replacement if needed. */
  async reversePayment(actor: Actor, paymentId: string, reason: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
      const pay = required(p, 'Payment');
      if (pay.status !== 'posted') throw errors.rule('This payment is already reversed.');
      await tx
        .update(paymentAllocations)
        .set({ reversedAt: new Date(), reversedByAccountId: actor.accountId })
        .where(and(eq(paymentAllocations.paymentId, paymentId), isNull(paymentAllocations.reversedAt)));
      await tx.update(payments).set({ status: 'reversed', reversedAt: new Date(), reversalReason: reason, version: pay.version + 1 }).where(eq(payments.id, paymentId));
      await audit(tx, actor, { action: 'payment.reversed', entityType: 'payment', entityId: paymentId, reason });
    });
    return this.getPayment(actor, paymentId);
  }

  async getPayment(actor: Actor, paymentId: string) {
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId));
      const pay = required(p, 'Payment');
      if (!isAdmin(actor) && pay.studentId !== actor.studentId) throw errors.notFound('Payment');
      return (await this.toPayments(tx, [pay]))[0]!;
    });
  }

  async listPayments(actor: Actor, raw: z.input<typeof paymentListQuery>) {
    requireAdmin(actor);
    const q = paymentListQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      if (q.studentId) conditions.push(eq(payments.studentId, q.studentId));
      if (q.from) conditions.push(sql`${payments.receivedOn} >= ${q.from}`);
      if (q.to) conditions.push(sql`${payments.receivedOn} <= ${q.to}`);
      if (q.unallocated === 'true') {
        conditions.push(eq(payments.status, 'posted'));
        conditions.push(sql`${payments.amount} > coalesce((select sum(a.amount) from app.payment_allocations a where a.payment_id = ${payments.id} and a.reversed_at is null), 0)`);
      }
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(lt(payments.createdAt, new Date(cursor[0])), and(eq(payments.createdAt, new Date(cursor[0])), lt(payments.id, cursor[1])))!);
      const rows = await tx.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt), desc(payments.id)).limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      return { items: await this.toPayments(tx, page), nextCursor: rows.length > q.limit && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null };
    });
  }

  /* ---------------- Adjustments ---------------- */

  async createAdjustment(actor: Actor, raw: z.input<typeof createAdjustmentRequest>) {
    requireAdmin(actor);
    const input = createAdjustmentRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const invoiceKinds = ['waiver', 'discount', 'write_off'];
      if (invoiceKinds.includes(input.kind)) {
        if (!input.invoiceId) throw errors.field('invoiceId', 'Choose the invoice to waive');
        const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).for('update');
        const invoice = required(inv, 'Invoice');
        if (invoice.studentId !== input.studentId) throw errors.field('invoiceId', 'This invoice belongs to another student');
        if (dec(input.amount).gt(feeStatusOf(invoice).balance)) throw errors.field('amount', `The invoice balance is ${feeStatusOf(invoice).balance.toFixed(2)}`);
      }
      if (input.kind === 'refund') {
        const statement = await this.statementTotals(tx, input.studentId, today(actor));
        if (dec(input.amount).gt(statement.credit)) throw errors.field('amount', `The student’s available credit is ${statement.credit.toFixed(2)}`);
      }
      const [row] = await tx
        .insert(financialAdjustments)
        .values({
          schoolId: actor.schoolId,
          studentId: input.studentId,
          invoiceId: invoiceKinds.includes(input.kind) ? input.invoiceId! : null,
          kind: input.kind,
          amount: dec(input.amount).toFixed(2),
          reason: input.reason,
          approvedByAccountId: actor.accountId,
        })
        .returning();
      await audit(tx, actor, { action: `adjustment.${input.kind}`, entityType: 'student', entityId: input.studentId, reason: input.reason, summary: { adjustmentId: row!.id } });
      return row!;
    });
  }

  async reverseAdjustment(actor: Actor, adjustmentId: string, reason: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(financialAdjustments)
        .set({ reversedAt: new Date(), reversedByAccountId: actor.accountId, reversalReason: reason })
        .where(and(eq(financialAdjustments.id, adjustmentId), isNull(financialAdjustments.reversedAt)))
        .returning();
      if (!rows.length) throw errors.notFound('Adjustment');
      await audit(tx, actor, { action: 'adjustment.reversed', entityType: 'student', entityId: rows[0]!.studentId, reason });
    });
  }

  /* ---------------- Statements, summaries, reminders ---------------- */

  private async statementTotals(tx: Tx, studentId: string, date: string) {
    const [t] = await tx.execute<{ charged: string; paid: string; adjusted: string; balance: string; overdue: string }>(sql`
      select coalesce(sum(total_amount), 0)::text as charged, coalesce(sum(paid_amount), 0)::text as paid,
             coalesce(sum(adjusted_amount), 0)::text as adjusted,
             coalesce(sum(total_amount - paid_amount - adjusted_amount), 0)::text as balance,
             coalesce(sum(total_amount - paid_amount - adjusted_amount) filter (where due_date < ${date}), 0)::text as overdue
      from app.invoices where student_id = ${studentId} and status = 'open'`);
    const [c] = await tx.execute<{ unallocated: string; credits: string; refunds: string }>(sql`
      select
        coalesce((select sum(p.amount - coalesce((select sum(a.amount) from app.payment_allocations a where a.payment_id = p.id and a.reversed_at is null), 0))
          from app.payments p where p.student_id = ${studentId} and p.status = 'posted'), 0)::text as unallocated,
        coalesce((select sum(amount) from app.financial_adjustments where student_id = ${studentId} and kind = 'credit' and reversed_at is null), 0)::text as credits,
        coalesce((select sum(amount) from app.financial_adjustments where student_id = ${studentId} and kind = 'refund' and reversed_at is null), 0)::text as refunds`);
    return {
      charged: dec(t?.charged),
      paid: dec(t?.paid),
      adjusted: dec(t?.adjusted),
      balance: dec(t?.balance),
      overdue: dec(t?.overdue),
      credit: dec(c?.unallocated).plus(c?.credits ?? 0).minus(c?.refunds ?? 0),
    };
  }

  async statement(actor: Actor, studentId: string): Promise<FeeStatement> {
    return this.run(actor, async (tx) => {
      if (!isAdmin(actor) && actor.studentId !== studentId) throw errors.forbidden();
      await assertCanViewStudent(tx, actor, studentId);
      const date = today(actor);
      const [s] = await tx.select({ name: accounts.displayName, adm: students.admissionNumber }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(eq(students.id, studentId));
      const [school] = await tx.select({ currency: schools.currency }).from(schools).where(eq(schools.id, actor.schoolId));
      const inv = await tx.select().from(invoices).where(eq(invoices.studentId, studentId)).orderBy(desc(invoices.dueDate));
      const pays = await tx.select().from(payments).where(eq(payments.studentId, studentId)).orderBy(desc(payments.receivedOn));
      const adjs = await tx
        .select({ f: financialAdjustments, by: accounts.displayName })
        .from(financialAdjustments)
        .innerJoin(accounts, eq(accounts.id, financialAdjustments.approvedByAccountId))
        .where(eq(financialAdjustments.studentId, studentId))
        .orderBy(desc(financialAdjustments.createdAt));
      const totals = await this.statementTotals(tx, studentId, date);
      return {
        studentId,
        studentName: required(s, 'Student').name,
        admissionNumber: s!.adm,
        currency: school?.currency ?? 'PKR',
        totals: {
          charged: totals.charged.toFixed(2),
          paid: totals.paid.toFixed(2),
          adjusted: totals.adjusted.toFixed(2),
          balance: totals.balance.toFixed(2),
          credit: totals.credit.toFixed(2),
          overdue: totals.overdue.toFixed(2),
        },
        invoices: await this.toSummaries(tx, inv, date),
        payments: await this.toPayments(tx, pays),
        adjustments: adjs.map(({ f, by }) => ({
          id: f.id,
          studentId: f.studentId,
          invoiceId: f.invoiceId,
          kind: f.kind,
          amount: f.amount,
          reason: f.reason,
          approvedBy: by,
          reversed: f.reversedAt !== null,
          createdAt: f.createdAt.toISOString(),
        })),
      };
    });
  }

  async summary(actor: Actor, academicYearId?: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const yearFilter = academicYearId ? sql`and i.academic_year_id = ${academicYearId}` : sql``;
      const [t] = await tx.execute<{ billed: string; collected: string; adjusted: string; outstanding: string; overdue: string; with_balance: number; overdue_students: number }>(sql`
        select coalesce(sum(i.total_amount), 0)::text as billed, coalesce(sum(i.paid_amount), 0)::text as collected,
          coalesce(sum(i.adjusted_amount), 0)::text as adjusted,
          coalesce(sum(i.total_amount - i.paid_amount - i.adjusted_amount), 0)::text as outstanding,
          coalesce(sum(i.total_amount - i.paid_amount - i.adjusted_amount) filter (where i.due_date < ${date}), 0)::text as overdue,
          count(distinct i.student_id) filter (where i.total_amount - i.paid_amount - i.adjusted_amount > 0)::int as with_balance,
          count(distinct i.student_id) filter (where i.total_amount - i.paid_amount - i.adjusted_amount > 0 and i.due_date < ${date})::int as overdue_students
        from app.invoices i where i.status = 'open' ${yearFilter}`);
      const [u] = await tx.execute<{ unallocated: string }>(sql`
        select coalesce(sum(p.amount - coalesce((select sum(a.amount) from app.payment_allocations a where a.payment_id = p.id and a.reversed_at is null), 0)), 0)::text as unallocated
        from app.payments p where p.status = 'posted'`);
      const byClass = await tx.execute<{ class_offering_id: string; grade_name: string; billed: string; outstanding: string; overdue: string }>(sql`
        select e.class_offering_id, g.name as grade_name, sum(i.total_amount)::text as billed,
          sum(i.total_amount - i.paid_amount - i.adjusted_amount)::text as outstanding,
          coalesce(sum(i.total_amount - i.paid_amount - i.adjusted_amount) filter (where i.due_date < ${date}), 0)::text as overdue
        from app.invoices i join app.student_enrollments e on e.id = i.enrollment_id
        join app.class_offerings co on co.id = e.class_offering_id join app.grade_levels g on g.id = co.grade_level_id
        where i.status = 'open' ${yearFilter}
        group by e.class_offering_id, g.name, g.sort_order order by g.sort_order`);
      const [school] = await tx.select({ currency: schools.currency }).from(schools).where(eq(schools.id, actor.schoolId));
      const m = (v: string | undefined) => dec(v).toFixed(2);
      return {
        currency: school?.currency ?? 'PKR',
        billed: m(t?.billed),
        collected: m(t?.collected),
        adjusted: m(t?.adjusted),
        outstanding: m(t?.outstanding),
        overdue: m(t?.overdue),
        studentsWithBalance: t?.with_balance ?? 0,
        studentsOverdue: t?.overdue_students ?? 0,
        unallocatedReceipts: m(u?.unallocated),
        byClass: byClass.map((r) => ({ classOfferingId: r.class_offering_id, gradeName: r.grade_name, billed: m(r.billed), outstanding: m(r.outstanding), overdue: m(r.overdue) })),
      };
    });
  }

  /** Default reminder mode is administrator-previewed: preview the list, then send. */
  async reminderPreview(actor: Actor, raw: z.input<typeof reminderPreviewRequest>) {
    requireAdmin(actor);
    const input = reminderPreviewRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const rows = await tx.execute<{ student_id: string; display_name: string; admission_number: string; balance: string; overdue: string; oldest: string | null }>(sql`
        select s.id as student_id, a.display_name, s.admission_number,
          sum(i.total_amount - i.paid_amount - i.adjusted_amount)::text as balance,
          coalesce(sum(i.total_amount - i.paid_amount - i.adjusted_amount) filter (where i.due_date < ${date}), 0)::text as overdue,
          min(i.due_date) filter (where i.total_amount - i.paid_amount - i.adjusted_amount > 0)::text as oldest
        from app.invoices i join app.students s on s.id = i.student_id join app.accounts a on a.id = s.account_id
        where i.status = 'open' and i.total_amount - i.paid_amount - i.adjusted_amount > 0
          ${input.overdueOnly ? sql`and i.due_date < ${date}` : sql``}
          ${input.classOfferingId ? sql`and exists (select 1 from app.student_enrollments e where e.id = i.enrollment_id and e.class_offering_id = ${input.classOfferingId})` : sql``}
          ${input.sectionId ? sql`and exists (select 1 from app.student_placements p where p.student_id = s.id and p.section_id = ${input.sectionId}
              and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date}))` : sql``}
        group by s.id, a.display_name, s.admission_number
        ${input.minimumBalance ? sql`having sum(i.total_amount - i.paid_amount - i.adjusted_amount) >= ${input.minimumBalance}::numeric` : sql``}
        order by a.display_name`);
      return rows.map((r) => ({
        studentId: r.student_id,
        displayName: r.display_name,
        admissionNumber: r.admission_number,
        balance: dec(r.balance).toFixed(2),
        overdue: dec(r.overdue).toFixed(2),
        oldestDueDate: r.oldest,
      }));
    });
  }

  /** Sends fee reminders (no amounts in push text). Deduplicated per student per day. */
  async sendReminders(actor: Actor, studentIds: string[]) {
    if (actor.client !== 'system') requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const date = today(actor);
      let sent = 0;
      for (const studentId of studentIds) {
        const id = await this.comms.notify(tx, actor, {
          kind: 'fee.reminder',
          data: {},
          recipients: await studentAccountIds(tx, [studentId]),
          entityType: 'student',
          entityId: studentId,
          link: '/fees',
          dedupeKey: `fee-reminder:${studentId}:${date}`,
        });
        if (id) sent++;
      }
      await audit(tx, actor, { action: 'fees.reminders_sent', entityType: 'school', entityId: actor.schoolId, summary: { sent } });
      return { sent };
    });
  }
}
