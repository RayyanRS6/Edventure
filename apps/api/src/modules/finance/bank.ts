import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import type { ImportBatch } from '@edventure/contracts';
import {
  bankCsvMapping,
  createBankAccountRequest,
  createBankImportProfileRequest,
  createBankImportRequest,
  importRowsQuery,
  resolveBankRowRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import { bankAccounts, bankImportProfiles, files, importBatches, importRows, invoices, payments, students } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { MAX_IMPORT_ROWS, parseAmount, parseCsv, parseDateWithFormat } from '../../platform/csv';
import { dec } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { withIdempotency } from '../../platform/idempotency';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { requireAdmin } from '../../platform/scope';
import type { StorageProvider } from '../../storage/provider';
import { feeStatusOf, nextNumber, type FeesService } from './fees';

type BatchRow = typeof importBatches.$inferSelect;
type Normalized = { date: string; amount: string; reference: string | null; transactionId: string | null; description: string | null };

export const toImportBatch = (b: BatchRow): ImportBatch => ({
  id: b.id,
  kind: b.kind,
  fileName: b.fileName,
  state: b.state,
  rowCount: b.rowCount,
  errorCount: b.errorCount,
  summary: b.summary,
  createdAt: b.createdAt.toISOString(),
  committedAt: b.committedAt?.toISOString() ?? null,
  version: b.version,
});

/**
 * Bank CSV reconciliation. Only exact, unique references are matched automatically (invoice number
 * or admission number) — never a student's name. Re-importing a file cannot duplicate payments:
 * bank transaction ids are unique per account and fingerprints of identical-looking rows go to review.
 */
export class BankReconciliationService {
  constructor(
    private readonly db: Db,
    private readonly storage: StorageProvider,
    private readonly fees: FeesService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  async listAccounts(actor: Actor) {
    requireAdmin(actor);
    return this.run(actor, async (tx) =>
      (await tx.select().from(bankAccounts).orderBy(asc(bankAccounts.name))).map((a) => ({
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        accountNumberMasked: a.accountNumberMasked,
        currency: a.currency,
        archived: a.archivedAt !== null,
      })),
    );
  }

  async createAccount(actor: Actor, raw: z.input<typeof createBankAccountRequest>) {
    requireAdmin(actor);
    const input = createBankAccountRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.insert(bankAccounts).values({ schoolId: actor.schoolId, name: input.name, bankName: input.bankName, accountNumberMasked: input.accountNumberMasked ?? null }).returning();
      await audit(tx, actor, { action: 'bank_account.created', entityType: 'bank_account', entityId: row!.id });
    });
    return this.listAccounts(actor);
  }

  async listProfiles(actor: Actor) {
    requireAdmin(actor);
    return this.run(actor, async (tx) =>
      (await tx.select().from(bankImportProfiles).orderBy(asc(bankImportProfiles.name))).map((p) => ({
        id: p.id,
        bankAccountId: p.bankAccountId,
        name: p.name,
        mappingVersion: p.mappingVersion,
        mapping: bankCsvMapping.parse(p.mapping),
        archived: p.archivedAt !== null,
      })),
    );
  }

  async createProfile(actor: Actor, raw: z.input<typeof createBankImportProfileRequest>) {
    requireAdmin(actor);
    const input = createBankImportProfileRequest.parse(raw);
    if (!input.mapping.columns.amount && !input.mapping.columns.credit) throw errors.field('mapping', 'Map either an amount or a credit column');
    if (input.mapping.referencePattern) {
      try {
        new RegExp(input.mapping.referencePattern);
      } catch {
        throw errors.field('mapping', 'The reference pattern is not a valid regular expression');
      }
    }
    await this.run(actor, async (tx) => {
      const [row] = await tx.insert(bankImportProfiles).values({ schoolId: actor.schoolId, bankAccountId: input.bankAccountId, name: input.name, mapping: input.mapping }).returning();
      await audit(tx, actor, { action: 'bank_profile.created', entityType: 'bank_import_profile', entityId: row!.id });
    });
    return this.listProfiles(actor);
  }

  /** Upload → parse with the saved mapping → validate all rows → detect duplicates → match references. */
  async create(actor: Actor, raw: z.input<typeof createBankImportRequest>) {
    requireAdmin(actor);
    const input = createBankImportRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(bankImportProfiles).where(eq(bankImportProfiles.id, input.bankImportProfileId));
      const profile = required(p, 'Bank mapping');
      const mapping = bankCsvMapping.parse(profile.mapping);
      const [f] = await tx.select().from(files).where(eq(files.id, input.fileId));
      const file = required(f, 'File');
      if (file.purpose !== 'import' || file.lifecycle !== 'available') throw errors.field('fileId', 'Upload the CSV file first');
      const body = await this.storage.read(file.objectKey);
      const fileHash = createHash('sha256').update(body).digest('hex');
      let records: Array<Record<string, string>>;
      try {
        records = parseCsv(body, { delimiter: mapping.delimiter, skipRows: mapping.skipRows, hasHeader: mapping.hasHeader });
      } catch (e) {
        throw errors.field('fileId', `The CSV could not be read: ${e instanceof Error ? e.message : 'invalid format'}`);
      }
      if (records.length > MAX_IMPORT_ROWS) throw errors.field('fileId', `A file can contain at most ${MAX_IMPORT_ROWS} rows`);
      const previous = await tx
        .select({ id: importBatches.id })
        .from(importBatches)
        .where(and(eq(importBatches.fileHash, fileHash), eq(importBatches.kind, 'bank_statement'), eq(importBatches.state, 'committed')));

      const [batch] = await tx
        .insert(importBatches)
        .values({
          schoolId: actor.schoolId,
          kind: 'bank_statement',
          fileId: file.id,
          fileName: file.originalName,
          fileHash,
          bankImportProfileId: profile.id,
          mappingVersion: profile.mappingVersion,
          state: 'validating',
          createdByAccountId: actor.accountId,
        })
        .returning();
      const pattern = mapping.referencePattern ? new RegExp(mapping.referencePattern, 'i') : null;
      const seenFingerprints = new Map<string, number>();
      let errorCount = 0;
      const counts: Record<string, number> = {};
      let rowNumber = mapping.skipRows + (mapping.hasHeader ? 1 : 0);
      for (const rec of records) {
        rowNumber++;
        const rowErrors: Array<{ field?: string; message: string }> = [];
        const col = (name?: string) => (name ? (rec[name] ?? '').trim() : '');
        const date = parseDateWithFormat(col(mapping.columns.date), mapping.dateFormat);
        if (!date) rowErrors.push({ field: 'date', message: `Unrecognized date "${col(mapping.columns.date)}"` });
        let amount: string | null = null;
        if (mapping.columns.credit) {
          const credit = col(mapping.columns.credit);
          amount = credit ? parseAmount(credit, mapping.thousandsSeparator) : null;
          if (!credit) {
            // Debit rows (outgoing money) are not fee receipts.
            await tx.insert(importRows).values({ schoolId: actor.schoolId, batchId: batch!.id, rowNumber, raw: rec, status: 'skipped', evidence: { reason: 'Not a credit' } });
            counts['skipped'] = (counts['skipped'] ?? 0) + 1;
            continue;
          }
        } else amount = parseAmount(col(mapping.columns.amount), mapping.thousandsSeparator);
        if (!amount) rowErrors.push({ field: 'amount', message: 'Unrecognized amount' });
        else if (dec(amount).lte(0)) {
          await tx.insert(importRows).values({ schoolId: actor.schoolId, batchId: batch!.id, rowNumber, raw: rec, status: 'skipped', evidence: { reason: 'Not a credit' } });
          counts['skipped'] = (counts['skipped'] ?? 0) + 1;
          continue;
        }
        const description = col(mapping.columns.description) || null;
        const transactionId = col(mapping.columns.transactionId) || null;
        let reference = col(mapping.columns.reference) || null;
        if (pattern) {
          const m = (reference ?? description ?? '').match(pattern);
          reference = m?.[1] ?? m?.[0] ?? reference;
        }
        if (rowErrors.length) {
          errorCount++;
          await tx.insert(importRows).values({ schoolId: actor.schoolId, batchId: batch!.id, rowNumber, raw: rec, status: 'invalid', errors: rowErrors });
          counts['invalid'] = (counts['invalid'] ?? 0) + 1;
          continue;
        }
        const normalized: Normalized = { date: date!, amount: dec(amount!).toFixed(2), reference, transactionId, description };
        const fingerprint = createHash('sha256').update([normalized.date, normalized.amount, reference ?? '', description ?? ''].join('|')).digest('hex');
        const evidence: Record<string, unknown> = {};
        let status: 'duplicate' | 'review' | 'matched' | 'unmatched' = 'unmatched';
        if (transactionId) {
          const [dup] = await tx
            .select({ id: payments.id, receipt: payments.receiptNumber })
            .from(payments)
            .where(and(eq(payments.bankAccountId, profile.bankAccountId), eq(payments.bankTransactionId, transactionId)));
          if (dup) {
            status = 'duplicate';
            evidence['existingPayment'] = dup;
          }
        }
        if (status !== 'duplicate') {
          const [same] = transactionId ? [] : await tx.select({ id: payments.id, receipt: payments.receiptNumber }).from(payments).where(eq(payments.fingerprint, fingerprint));
          const inFile = seenFingerprints.get(fingerprint);
          if (same || inFile) {
            // Identical-looking payments may be legitimate: a person decides.
            status = 'review';
            evidence['possibleDuplicate'] = same ?? { rowNumber: inFile };
          }
          seenFingerprints.set(fingerprint, rowNumber);
          const match = await this.match(tx, reference);
          if (match) {
            evidence['match'] = match;
            if (status !== 'review') status = 'matched';
          } else if (status !== 'review') status = 'unmatched';
        }
        counts[status] = (counts[status] ?? 0) + 1;
        await tx.insert(importRows).values({ schoolId: actor.schoolId, batchId: batch!.id, rowNumber, raw: rec, normalized, status, evidence, fingerprint });
      }
      const summary = { ...counts, previouslyImportedBatchIds: previous.map((x) => x.id) };
      await tx
        .update(importBatches)
        .set({ state: errorCount ? 'invalid' : 'validated', rowCount: records.length, errorCount, summary })
        .where(eq(importBatches.id, batch!.id));
      await audit(tx, actor, { action: 'bank_import.validated', entityType: 'import_batch', entityId: batch!.id, summary });
      return batch!.id;
    });
    return this.get(actor, id, {});
  }

  /** Exact, unique references only: an open invoice number, or a student admission number. */
  private async match(tx: Tx, reference: string | null) {
    if (!reference) return null;
    const ref = reference.trim();
    const inv = await tx.select({ id: invoices.id, studentId: invoices.studentId, number: invoices.invoiceNumber }).from(invoices).where(and(sql`upper(${invoices.invoiceNumber}) = upper(${ref})`, eq(invoices.status, 'open')));
    if (inv.length === 1) return { by: 'invoice', invoiceId: inv[0]!.id, studentId: inv[0]!.studentId, reference: inv[0]!.number };
    const st = await tx.select({ id: students.id, adm: students.admissionNumber }).from(students).where(sql`upper(${students.admissionNumber}) = upper(${ref})`);
    if (st.length === 1) return { by: 'admission_number', studentId: st[0]!.id, reference: st[0]!.adm };
    return null;
  }

  async list(actor: Actor) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => (await tx.select().from(importBatches).where(eq(importBatches.kind, 'bank_statement')).orderBy(desc(importBatches.createdAt)).limit(100)).map(toImportBatch));
  }

  async get(actor: Actor, batchId: string, raw: z.input<typeof importRowsQuery>) {
    requireAdmin(actor);
    const q = importRowsQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId));
      const batch = required(b, 'Import');
      const cursor = decodeCursor(q.cursor, 1) as [number] | null;
      const rows = await tx
        .select()
        .from(importRows)
        .where(and(eq(importRows.batchId, batchId), q.status ? eq(importRows.status, q.status) : undefined, cursor ? gt(importRows.rowNumber, cursor[0]) : undefined))
        .orderBy(asc(importRows.rowNumber))
        .limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      return {
        ...toImportBatch(batch),
        rows: page.map((r) => ({
          id: r.id,
          rowNumber: r.rowNumber,
          raw: r.raw,
          normalized: r.normalized ?? null,
          status: r.status,
          errors: r.errors,
          evidence: r.evidence ?? null,
          resolution: r.resolution ?? null,
          outcome: r.outcome ?? null,
        })),
        nextCursor: rows.length > q.limit && last ? encodeCursor([last.rowNumber]) : null,
      };
    });
  }

  async resolveRow(actor: Actor, batchId: string, rowId: string, raw: z.input<typeof resolveBankRowRequest>) {
    requireAdmin(actor);
    const input = resolveBankRowRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId));
      if (required(b, 'Import').state !== 'validated') throw errors.rule('Only validated imports can be reviewed.');
      const [r] = await tx.select().from(importRows).where(and(eq(importRows.id, rowId), eq(importRows.batchId, batchId)));
      const row = required(r, 'Row');
      if (['invalid', 'duplicate', 'committed'].includes(row.status)) throw errors.rule('This row cannot be changed.');
      if (input.action === 'allocate') {
        const [s] = await tx.select({ id: students.id }).from(students).where(eq(students.id, input.studentId));
        required(s, 'Student');
        if (input.invoiceId) {
          const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId));
          if (!inv || inv.studentId !== input.studentId) throw errors.field('invoiceId', 'Choose one of this student’s invoices');
        }
      }
      await tx
        .update(importRows)
        .set({ resolution: input, status: input.action === 'skip' ? 'skipped' : input.action === 'allocate' ? 'matched' : 'unmatched' })
        .where(eq(importRows.id, rowId));
      await audit(tx, actor, { action: 'bank_import.row_resolved', entityType: 'import_batch', entityId: batchId, summary: { rowId, action: input.action } });
    });
    return this.get(actor, batchId, {});
  }

  /**
   * Commits in one transaction: receipts for every accepted row, allocations for matched rows,
   * unallocated receipts (and overpayment credit) otherwise. Rows under review must be resolved first.
   */
  async commit(actor: Actor, batchId: string, idempotencyKey?: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) =>
      withIdempotency(tx, actor, `bank-import:${batchId}`, idempotencyKey, { batchId }, async () => {
        const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).for('update');
        const batch = required(b, 'Import');
        if (batch.state === 'committed') return { status: 200, body: { committed: true } };
        if (batch.state !== 'validated') throw errors.rule('Fix the file errors and upload it again.');
        const [profile] = await tx.select().from(bankImportProfiles).where(eq(bankImportProfiles.id, batch.bankImportProfileId!));
        const rows = await tx.select().from(importRows).where(eq(importRows.batchId, batchId)).orderBy(asc(importRows.rowNumber));
        const pending = rows.filter((r) => r.status === 'review' && !r.resolution);
        if (pending.length) throw errors.rule(`${pending.length} row(s) need review before committing.`);
        let receipts = 0;
        let allocatedRows = 0;
        for (const r of rows.filter((x) => ['matched', 'unmatched', 'review'].includes(x.status))) {
          const n = r.normalized as unknown as Normalized;
          const resolution = r.resolution as { action?: string; studentId?: string; invoiceId?: string | null } | null;
          if (resolution?.action === 'skip') continue;
          const match = (r.evidence as { match?: { studentId: string; invoiceId?: string } } | null)?.match;
          const studentId = resolution?.action === 'allocate' ? resolution.studentId! : resolution?.action === 'unallocated' ? null : (match?.studentId ?? null);
          const invoiceId = resolution?.action === 'allocate' ? (resolution.invoiceId ?? null) : resolution?.action === 'unallocated' ? null : (match?.invoiceId ?? null);
          const [p] = await tx
            .insert(payments)
            .values({
              schoolId: actor.schoolId,
              studentId,
              bankAccountId: profile!.bankAccountId,
              method: 'bank',
              amount: n.amount,
              receivedOn: n.date,
              bankTransactionId: n.transactionId,
              payerReference: n.reference,
              description: n.description,
              receiptNumber: await nextNumber(tx, actor.schoolId, 'receipt'),
              importRowId: r.id,
              fingerprint: r.fingerprint,
              recordedByAccountId: actor.accountId,
            })
            .returning();
          receipts++;
          let allocations: Array<{ invoiceId: string; amount: string }> = [];
          if (studentId) {
            if (invoiceId) {
              const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update');
              const balance = inv ? feeStatusOf(inv).balance : dec(0);
              const amount = balance.lt(n.amount) ? balance : dec(n.amount);
              if (amount.gt(0)) allocations = await this.fees.allocateInTx(tx, actor, p!.id, studentId, [{ invoiceId, amount: amount.toFixed(2) }]);
              // Anything left over stays on the receipt as credit, or goes to other open invoices.
              const rest = await this.fees.allocateInTx(tx, actor, p!.id, studentId);
              allocations = [...allocations, ...rest];
            } else allocations = await this.fees.allocateInTx(tx, actor, p!.id, studentId);
          }
          if (allocations.length) allocatedRows++;
          await tx
            .update(importRows)
            .set({ status: 'committed', outcome: { paymentId: p!.id, receiptNumber: p!.receiptNumber, studentId, allocations } })
            .where(eq(importRows.id, r.id));
        }
        const summary = { ...batch.summary, receipts, allocatedRows };
        await tx.update(importBatches).set({ state: 'committed', committedAt: new Date(), committedByAccountId: actor.accountId, summary, version: batch.version + 1 }).where(eq(importBatches.id, batchId));
        await audit(tx, actor, { action: 'bank_import.committed', entityType: 'import_batch', entityId: batchId, summary: { receipts, allocatedRows } });
        return { status: 200, body: { committed: true } };
      }),
    );
    return this.get(actor, batchId, {});
  }
}
