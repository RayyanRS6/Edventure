import { z } from 'zod';
import { id, isoDate, isoDateTime, money, nonEmpty, optionalUrdu, page, pageQuery, percentage, positiveMoney, versioned } from './common';
import { adjustmentKinds, feeFrequencies, feeKinds, feePlanStates, importRowStatuses, importStates, paymentMethods, paymentStatuses } from './domain';

export const feeType = z.object({ id, code: z.string(), name: z.string(), nameUr: z.string().nullable(), kind: z.enum(feeKinds), archived: z.boolean() });
export const createFeeTypeRequest = z.object({
  code: z.string().trim().min(1).max(16).transform((v) => v.toUpperCase()),
  name: nonEmpty(80),
  nameUr: optionalUrdu,
  kind: z.enum(feeKinds),
});

export const feePlan = z.object({
  id,
  academicYearId: id,
  name: z.string(),
  frequency: z.enum(feeFrequencies),
  dueDay: z.number().int(),
  state: z.enum(feePlanStates),
  items: z.array(z.object({ id, feeTypeId: id, feeTypeName: z.string(), amount: money, description: z.string().nullable() })),
  total: money,
  assignedCount: z.number().int(),
  version: z.number().int(),
});
export type FeePlan = z.infer<typeof feePlan>;
export const createFeePlanRequest = z.object({
  academicYearId: id,
  name: nonEmpty(100),
  frequency: z.enum(feeFrequencies),
  dueDay: z.number().int().min(1).max(28).default(10),
  items: z.array(z.object({ feeTypeId: id, amount: positiveMoney, description: z.string().trim().max(200).nullish() })).min(1).max(20),
});
export const updateFeePlanRequest = versioned.extend({
  name: nonEmpty(100).optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  state: z.enum(feePlanStates).optional(),
  items: z.array(z.object({ feeTypeId: id, amount: positiveMoney, description: z.string().trim().max(200).nullish() })).min(1).max(20).optional(),
});
export const assignFeePlanRequest = z
  .object({
    studentIds: z.array(id).max(5000).optional(),
    classOfferingId: id.optional(),
    sectionId: id.optional(),
    startDate: isoDate,
    discountPercentage: percentage.nullish(),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((v) => !!v.studentIds?.length || !!v.classOfferingId || !!v.sectionId, { message: 'Choose students, a class or a section' });
export const assignmentResult = z.object({ assigned: z.number().int(), alreadyAssigned: z.number().int() });

export const generateInvoicesRequest = z.object({
  /** e.g. `2026-10` (monthly), `T1` (termly) or `ANNUAL`. */
  periodLabel: z.string().trim().min(1).max(20),
  issueDate: isoDate,
  dueDate: isoDate,
});
export const generationResult = z.object({ created: z.number().int(), skipped: z.number().int() });

export const invoiceLine = z.object({ id, feeTypeId: id, feeTypeName: z.string(), description: z.string(), amount: money, source: z.enum(['plan', 'manual', 'fine']) });
export const invoiceSummary = z.object({
  id,
  invoiceNumber: z.string(),
  studentId: id,
  studentName: z.string(),
  admissionNumber: z.string(),
  periodLabel: z.string(),
  issueDate: isoDate,
  dueDate: isoDate,
  status: z.enum(['open', 'void']),
  totalAmount: money,
  paidAmount: money,
  adjustedAmount: money,
  balance: money,
  feeStatus: z.enum(['unpaid', 'partially_paid', 'paid']),
  overdue: z.boolean(),
  version: z.number().int(),
});
export type InvoiceSummary = z.infer<typeof invoiceSummary>;
export const invoiceDetail = invoiceSummary.extend({
  lines: z.array(invoiceLine),
  allocations: z.array(z.object({ id, paymentId: id, receiptNumber: z.string(), amount: money, receivedOn: isoDate, reversed: z.boolean() })),
  adjustments: z.array(z.object({ id, kind: z.enum(adjustmentKinds), amount: money, reason: z.string(), reversed: z.boolean(), createdAt: isoDateTime })),
});
export const invoiceListQuery = pageQuery.extend({
  studentId: id.optional(),
  classOfferingId: id.optional(),
  sectionId: id.optional(),
  periodLabel: z.string().max(20).optional(),
  feeStatus: z.enum(['unpaid', 'partially_paid', 'paid', 'overdue', 'outstanding']).optional(),
  includeVoid: z.enum(['true', 'false']).optional(),
});
export const invoicePage = page(invoiceSummary);

export const manualChargeRequest = z.object({
  studentId: id,
  periodLabel: z.string().trim().min(1).max(20).default('MISC'),
  issueDate: isoDate,
  dueDate: isoDate,
  lines: z.array(z.object({ feeTypeId: id, description: nonEmpty(200), amount: positiveMoney })).min(1).max(20),
});
export const voidInvoiceRequest = versioned.extend({ reason: z.string().trim().min(3).max(300) });

export const recordPaymentRequest = z.object({
  studentId: id.nullish(),
  method: z.enum(paymentMethods),
  amount: positiveMoney,
  receivedOn: isoDate,
  bankAccountId: id.nullish(),
  bankTransactionId: z.string().trim().max(100).nullish(),
  payerReference: z.string().trim().max(100).nullish(),
  description: z.string().trim().max(300).nullish(),
  /** Explicit allocations; omitted = allocate to the student's oldest open invoices. */
  allocations: z.array(z.object({ invoiceId: id, amount: positiveMoney })).max(50).optional(),
});
export const payment = z.object({
  id,
  receiptNumber: z.string(),
  studentId: id.nullable(),
  studentName: z.string().nullable(),
  method: z.enum(paymentMethods),
  amount: money,
  allocated: money,
  unallocated: money,
  receivedOn: isoDate,
  bankTransactionId: z.string().nullable(),
  payerReference: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(paymentStatuses),
  reversalReason: z.string().nullable(),
  allocations: z.array(z.object({ id, invoiceId: id, invoiceNumber: z.string(), amount: money, reversed: z.boolean() })),
  createdAt: isoDateTime,
});
export type Payment = z.infer<typeof payment>;
export const allocatePaymentRequest = z.object({
  studentId: id.nullish(),
  allocations: z.array(z.object({ invoiceId: id, amount: positiveMoney })).min(1).max(50),
});
export const reversePaymentRequest = z.object({ reason: z.string().trim().min(3).max(300) });
export const paymentListQuery = pageQuery.extend({ studentId: id.optional(), unallocated: z.enum(['true', 'false']).optional(), from: isoDate.optional(), to: isoDate.optional() });
export const paymentPage = page(payment);

export const createAdjustmentRequest = z.object({
  studentId: id,
  invoiceId: id.nullish(),
  kind: z.enum(adjustmentKinds),
  amount: positiveMoney,
  reason: z.string().trim().min(3).max(300),
});
export const adjustment = z.object({
  id,
  studentId: id,
  invoiceId: id.nullable(),
  kind: z.enum(adjustmentKinds),
  amount: money,
  reason: z.string(),
  approvedBy: z.string(),
  reversed: z.boolean(),
  createdAt: isoDateTime,
});

export const feeStatement = z.object({
  studentId: id,
  studentName: z.string(),
  admissionNumber: z.string(),
  currency: z.string(),
  totals: z.object({ charged: money, paid: money, adjusted: money, balance: money, credit: money, overdue: money }),
  invoices: z.array(invoiceSummary),
  payments: z.array(payment),
  adjustments: z.array(adjustment),
});
export type FeeStatement = z.infer<typeof feeStatement>;

export const feeSummary = z.object({
  currency: z.string(),
  billed: money,
  collected: money,
  adjusted: money,
  outstanding: money,
  overdue: money,
  studentsWithBalance: z.number().int(),
  studentsOverdue: z.number().int(),
  unallocatedReceipts: money,
  byClass: z.array(z.object({ classOfferingId: id, gradeName: z.string(), billed: money, outstanding: money, overdue: money })),
});

export const reminderPreviewRequest = z.object({
  overdueOnly: z.boolean().default(true),
  classOfferingId: id.optional(),
  sectionId: id.optional(),
  minimumBalance: money.optional(),
});
export const reminderCandidate = z.object({ studentId: id, displayName: z.string(), admissionNumber: z.string(), balance: money, overdue: money, oldestDueDate: isoDate.nullable() });
export const sendRemindersRequest = z.object({ studentIds: z.array(id).min(1).max(5000) });

/* ---------------- Bank reconciliation ---------------- */

export const bankAccount = z.object({ id, name: z.string(), bankName: z.string(), accountNumberMasked: z.string().nullable(), currency: z.string(), archived: z.boolean() });
export const createBankAccountRequest = z.object({
  name: nonEmpty(80),
  bankName: nonEmpty(80),
  accountNumberMasked: z.string().trim().max(20).regex(/^[*•xX\d\s-]*$/, 'Store only the last digits, e.g. ****1234').nullish(),
});

export const bankCsvMapping = z.object({
  delimiter: z.enum([',', ';', '\t']).default(','),
  skipRows: z.number().int().min(0).max(50).default(0),
  hasHeader: z.boolean().default(true),
  columns: z.object({
    date: nonEmpty(60),
    amount: z.string().max(60).optional(),
    credit: z.string().max(60).optional(),
    debit: z.string().max(60).optional(),
    reference: z.string().max(60).optional(),
    transactionId: z.string().max(60).optional(),
    description: z.string().max(60).optional(),
  }),
  dateFormat: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD-MMM-YYYY']),
  thousandsSeparator: z.enum([',', '', ' ']).default(','),
  referencePattern: z.string().max(200).optional(),
});
export const bankImportProfile = z.object({ id, bankAccountId: id, name: z.string(), mappingVersion: z.number().int(), mapping: bankCsvMapping, archived: z.boolean() });
export const createBankImportProfileRequest = z.object({ bankAccountId: id, name: nonEmpty(80), mapping: bankCsvMapping });

export const importRow = z.object({
  id,
  rowNumber: z.number().int(),
  raw: z.record(z.string(), z.string()),
  normalized: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(importRowStatuses),
  errors: z.array(z.object({ field: z.string().optional(), message: z.string() })),
  evidence: z.record(z.string(), z.unknown()).nullable(),
  resolution: z.record(z.string(), z.unknown()).nullable(),
  outcome: z.record(z.string(), z.unknown()).nullable(),
});
export type ImportRow = z.infer<typeof importRow>;
export const importBatch = z.object({
  id,
  kind: z.enum(['students', 'teachers', 'bank_statement']),
  fileName: z.string(),
  state: z.enum(importStates),
  rowCount: z.number().int(),
  errorCount: z.number().int(),
  summary: z.record(z.string(), z.unknown()),
  createdAt: isoDateTime,
  committedAt: isoDateTime.nullable(),
  version: z.number().int(),
});
export type ImportBatch = z.infer<typeof importBatch>;
export const importBatchDetail = importBatch.extend({ rows: z.array(importRow), nextCursor: z.string().nullable() });
export const createBankImportRequest = z.object({ bankImportProfileId: id, fileId: id });
export const resolveBankRowRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('allocate'), studentId: id, invoiceId: id.nullish() }),
  z.object({ action: z.literal('unallocated') }),
  z.object({ action: z.literal('skip') }),
]);
export const importRowsQuery = pageQuery.extend({ status: z.enum(importRowStatuses).optional() });
