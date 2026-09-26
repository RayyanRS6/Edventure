import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  adjustmentKinds,
  feeFrequencies,
  feeKinds,
  feePlanStates,
  importKinds,
  importRowStatuses,
  importStates,
  invoiceLineSources,
  invoiceStatuses,
  paymentMethods,
  paymentStatuses,
} from '@edventure/contracts';
import { app, day, money, pct, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, files, schools } from './core';
import { students } from './people';
import { academicYears, studentEnrollments } from './academics';

export const feeKind = app.enum('fee_kind', feeKinds);
export const feeFrequency = app.enum('fee_frequency', feeFrequencies);
export const feePlanState = app.enum('fee_plan_state', feePlanStates);
export const invoiceStatus = app.enum('invoice_status', invoiceStatuses);
export const invoiceLineSource = app.enum('invoice_line_source', invoiceLineSources);
export const paymentMethod = app.enum('payment_method', paymentMethods);
export const paymentStatus = app.enum('payment_status', paymentStatuses);
export const adjustmentKind = app.enum('adjustment_kind', adjustmentKinds);
export const importKind = app.enum('import_kind', importKinds);
export const importState = app.enum('import_state', importStates);
export const importRowStatus = app.enum('import_row_status', importRowStatuses);

/** Per-school gap-free document numbers (invoices, receipts). Incremented atomically with upsert. */
export const documentCounters = app.table(
  'document_counters',
  {
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    kind: text('kind').notNull(),
    nextValue: integer('next_value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.kind] })],
);

export const feeTypes = app.table(
  'fee_types',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    kind: feeKind('kind').notNull(),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('fee_types', t, schools), uniqueIndex('fee_types_code_uk').on(t.schoolId, t.code)],
);

export const feePlans = app.table(
  'fee_plans',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    name: text('name').notNull(),
    frequency: feeFrequency('frequency').notNull(),
    /** Day of the month invoices fall due (monthly plans), 1–28. */
    dueDay: integer('due_day').notNull().default(10),
    state: feePlanState('state').notNull().default('draft'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('fee_plans', t, schools),
    tfk('fee_plans_year_fk', t.schoolId, t.academicYearId, academicYears),
    check('fee_plans_due_day', sql`${t.dueDay} between 1 and 28`),
  ],
);

export const feePlanItems = app.table(
  'fee_plan_items',
  {
    ...tenantColumns(),
    feePlanId: uuid('fee_plan_id').notNull(),
    feeTypeId: uuid('fee_type_id').notNull(),
    amount: money('amount').notNull(),
    description: text('description'),
  },
  (t) => [
    ...tenantConstraints('fee_plan_items', t, schools),
    tfk('fee_plan_items_plan_fk', t.schoolId, t.feePlanId, feePlans, 'cascade'),
    tfk('fee_plan_items_type_fk', t.schoolId, t.feeTypeId, feeTypes),
    uniqueIndex('fee_plan_items_uk').on(t.schoolId, t.feePlanId, t.feeTypeId),
    check('fee_plan_items_amount', sql`${t.amount} > 0`),
  ],
);

export const studentFeeAssignments = app.table(
  'student_fee_assignments',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    enrollmentId: uuid('enrollment_id').notNull(),
    feePlanId: uuid('fee_plan_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    /** Standing discount percentage applied when invoices are generated (e.g. sibling discount). */
    discountPercentage: pct('discount_percentage'),
    note: text('note'),
  },
  (t) => [
    ...tenantConstraints('student_fee_assignments', t, schools),
    tfk('student_fee_assignments_student_fk', t.schoolId, t.studentId, students),
    tfk('student_fee_assignments_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_fee_assignments_plan_fk', t.schoolId, t.feePlanId, feePlans),
    index('student_fee_assignments_student_idx').on(t.schoolId, t.studentId),
    check('student_fee_assignments_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/**
 * Charges. Payment status (unpaid / partially paid / paid) is derived from the balance, never stored.
 * `total_amount`, `paid_amount` and `adjusted_amount` are maintained transactionally with their sources.
 */
export const invoices = app.table(
  'invoices',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    enrollmentId: uuid('enrollment_id'),
    academicYearId: uuid('academic_year_id').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    periodLabel: text('period_label').notNull(),
    issueDate: day('issue_date').notNull(),
    dueDate: day('due_date').notNull(),
    status: invoiceStatus('status').notNull().default('open'),
    totalAmount: money('total_amount').notNull().default('0'),
    paidAmount: money('paid_amount').notNull().default('0'),
    adjustedAmount: money('adjusted_amount').notNull().default('0'),
    /** Deterministic key for generated invoices so regeneration is idempotent. */
    generationKey: text('generation_key'),
    voidReason: text('void_reason'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('invoices', t, schools),
    tfk('invoices_student_fk', t.schoolId, t.studentId, students),
    tfk('invoices_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('invoices_year_fk', t.schoolId, t.academicYearId, academicYears),
    uniqueIndex('invoices_number_uk').on(t.schoolId, t.invoiceNumber),
    uniqueIndex('invoices_generation_uk').on(t.schoolId, t.generationKey),
    index('invoices_student_idx').on(t.schoolId, t.studentId, t.dueDate),
    index('invoices_due_idx').on(t.schoolId, t.status, t.dueDate),
    check(
      'invoices_amounts',
      sql`${t.totalAmount} >= 0 and ${t.paidAmount} >= 0 and ${t.adjustedAmount} >= 0 and ${t.paidAmount} + ${t.adjustedAmount} <= ${t.totalAmount}`,
    ),
    check('invoices_dates', sql`${t.dueDate} >= ${t.issueDate}`),
  ],
);

export const invoiceLines = app.table(
  'invoice_lines',
  {
    ...tenantColumns(),
    invoiceId: uuid('invoice_id').notNull(),
    feeTypeId: uuid('fee_type_id').notNull(),
    description: text('description').notNull(),
    amount: money('amount').notNull(),
    source: invoiceLineSource('source').notNull(),
    createdByAccountId: uuid('created_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('invoice_lines', t, schools),
    tfk('invoice_lines_invoice_fk', t.schoolId, t.invoiceId, invoices),
    tfk('invoice_lines_type_fk', t.schoolId, t.feeTypeId, feeTypes),
    check('invoice_lines_amount', sql`${t.amount} > 0`),
  ],
);

export const bankAccounts = app.table(
  'bank_accounts',
  {
    ...tenantColumns(),
    name: text('name').notNull(),
    bankName: text('bank_name').notNull(),
    /** Only the last digits are stored; this is a label, not a credential. */
    accountNumberMasked: text('account_number_masked'),
    currency: text('currency').notNull().default('PKR'),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('bank_accounts', t, schools)],
);

export type BankCsvMapping = {
  delimiter: ',' | ';' | '\t';
  skipRows: number;
  hasHeader: boolean;
  columns: {
    date: string;
    amount?: string;
    credit?: string;
    debit?: string;
    reference?: string;
    transactionId?: string;
    description?: string;
  };
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'DD-MMM-YYYY';
  thousandsSeparator: ',' | '' | ' ';
  /** Regex with one capture group that extracts a supported reference (e.g. invoice number) from the description. */
  referencePattern?: string;
};

export const bankImportProfiles = app.table(
  'bank_import_profiles',
  {
    ...tenantColumns(),
    bankAccountId: uuid('bank_account_id').notNull(),
    name: text('name').notNull(),
    mappingVersion: integer('mapping_version').notNull().default(1),
    mapping: jsonb('mapping').$type<BankCsvMapping>().notNull(),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('bank_import_profiles', t, schools),
    tfk('bank_import_profiles_account_fk', t.schoolId, t.bankAccountId, bankAccounts),
  ],
);

export const importBatches = app.table(
  'import_batches',
  {
    ...tenantColumns(),
    kind: importKind('kind').notNull(),
    fileId: uuid('file_id'),
    fileName: text('file_name').notNull(),
    fileHash: text('file_hash').notNull(),
    bankImportProfileId: uuid('bank_import_profile_id'),
    mappingVersion: integer('mapping_version'),
    state: importState('state').notNull().default('uploaded'),
    rowCount: integer('row_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
    options: jsonb('options').$type<Record<string, unknown>>().notNull().default({}),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    committedByAccountId: uuid('committed_by_account_id'),
    committedAt: ts('committed_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('import_batches', t, schools),
    tfk('import_batches_file_fk', t.schoolId, t.fileId, files),
    tfk('import_batches_profile_fk', t.schoolId, t.bankImportProfileId, bankImportProfiles),
    tfk('import_batches_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    index('import_batches_kind_idx').on(t.schoolId, t.kind, t.createdAt),
    index('import_batches_hash_idx').on(t.schoolId, t.fileHash),
  ],
);

export const importRows = app.table(
  'import_rows',
  {
    ...tenantColumns(),
    batchId: uuid('batch_id').notNull(),
    rowNumber: integer('row_number').notNull(),
    raw: jsonb('raw').$type<Record<string, string>>().notNull(),
    normalized: jsonb('normalized').$type<Record<string, unknown>>(),
    status: importRowStatus('status').notNull(),
    errors: jsonb('errors').$type<Array<{ field?: string; message: string }>>().notNull().default([]),
    /** Duplicate/matching evidence shown to the reviewer. */
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    /** Reviewer decision for bank rows: allocate to an invoice/student, keep unallocated, or skip. */
    resolution: jsonb('resolution').$type<Record<string, unknown>>(),
    outcome: jsonb('outcome').$type<Record<string, unknown>>(),
    fingerprint: text('fingerprint'),
  },
  (t) => [
    ...tenantConstraints('import_rows', t, schools),
    tfk('import_rows_batch_fk', t.schoolId, t.batchId, importBatches, 'cascade'),
    uniqueIndex('import_rows_number_uk').on(t.schoolId, t.batchId, t.rowNumber),
    index('import_rows_fingerprint_idx').on(t.schoolId, t.fingerprint),
  ],
);

/** Receipts. Corrections use linked reversals; posted payments are never edited in place. */
export const payments = app.table(
  'payments',
  {
    ...tenantColumns(),
    studentId: uuid('student_id'),
    bankAccountId: uuid('bank_account_id'),
    method: paymentMethod('method').notNull(),
    amount: money('amount').notNull(),
    receivedOn: day('received_on').notNull(),
    /** Stable bank transaction identifier, when the bank supplies one. */
    bankTransactionId: text('bank_transaction_id'),
    /** Reference the payer supplied (e.g. invoice/challan number). */
    payerReference: text('payer_reference'),
    description: text('description'),
    receiptNumber: text('receipt_number').notNull(),
    status: paymentStatus('status').notNull().default('posted'),
    reversalOfPaymentId: uuid('reversal_of_payment_id'),
    reversedAt: ts('reversed_at'),
    reversalReason: text('reversal_reason'),
    importRowId: uuid('import_row_id'),
    fingerprint: text('fingerprint'),
    recordedByAccountId: uuid('recorded_by_account_id').notNull(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('payments', t, schools),
    tfk('payments_student_fk', t.schoolId, t.studentId, students),
    tfk('payments_bank_account_fk', t.schoolId, t.bankAccountId, bankAccounts),
    tfk('payments_reversal_of_fk', t.schoolId, t.reversalOfPaymentId, { schoolId: t.schoolId, id: t.id }),
    tfk('payments_import_row_fk', t.schoolId, t.importRowId, importRows),
    tfk('payments_recorder_fk', t.schoolId, t.recordedByAccountId, accounts),
    uniqueIndex('payments_receipt_uk').on(t.schoolId, t.receiptNumber),
    uniqueIndex('payments_bank_txn_uk')
      .on(t.schoolId, t.bankAccountId, t.bankTransactionId)
      .where(sql`${t.bankTransactionId} is not null`),
    index('payments_student_idx').on(t.schoolId, t.studentId),
    index('payments_fingerprint_idx').on(t.schoolId, t.fingerprint),
    check('payments_amount', sql`${t.amount} > 0`),
  ],
);

export const paymentAllocations = app.table(
  'payment_allocations',
  {
    ...tenantColumns(),
    paymentId: uuid('payment_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    amount: money('amount').notNull(),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    reversedAt: ts('reversed_at'),
    reversedByAccountId: uuid('reversed_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('payment_allocations', t, schools),
    tfk('payment_allocations_payment_fk', t.schoolId, t.paymentId, payments),
    tfk('payment_allocations_invoice_fk', t.schoolId, t.invoiceId, invoices),
    tfk('payment_allocations_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    index('payment_allocations_invoice_idx').on(t.schoolId, t.invoiceId),
    index('payment_allocations_payment_idx').on(t.schoolId, t.paymentId),
    check('payment_allocations_amount', sql`${t.amount} > 0`),
  ],
);

/** Waivers, discounts, credits, refunds and write-offs. Every entry carries a reason and approver. */
export const financialAdjustments = app.table(
  'financial_adjustments',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    invoiceId: uuid('invoice_id'),
    paymentId: uuid('payment_id'),
    kind: adjustmentKind('kind').notNull(),
    amount: money('amount').notNull(),
    reason: text('reason').notNull(),
    approvedByAccountId: uuid('approved_by_account_id').notNull(),
    reversedAt: ts('reversed_at'),
    reversedByAccountId: uuid('reversed_by_account_id'),
    reversalReason: text('reversal_reason'),
  },
  (t) => [
    ...tenantConstraints('financial_adjustments', t, schools),
    tfk('financial_adjustments_student_fk', t.schoolId, t.studentId, students),
    tfk('financial_adjustments_invoice_fk', t.schoolId, t.invoiceId, invoices),
    tfk('financial_adjustments_payment_fk', t.schoolId, t.paymentId, payments),
    tfk('financial_adjustments_approver_fk', t.schoolId, t.approvedByAccountId, accounts),
    index('financial_adjustments_student_idx').on(t.schoolId, t.studentId),
    check('financial_adjustments_amount', sql`${t.amount} > 0`),
  ],
);
