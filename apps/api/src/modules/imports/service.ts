import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z as zod } from 'zod';
import {
  createPeopleImportRequest,
  genders,
  isoDate,
  studentImportColumns,
  teacherImportColumns,
  username as usernameSchema,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  academicYears,
  accounts,
  classOfferings,
  employmentRecords,
  files,
  gradeLevels,
  guardians,
  importBatches,
  importRows,
  sections,
  streams,
  studentGuardians,
  students,
  teachers,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import type { JobQueue } from '../../jobs/queue';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { MAX_IMPORT_ROWS, parseCsv, toCsv } from '../../platform/csv';
import { errors, required } from '../../platform/errors';
import { requireAdmin } from '../../platform/scope';
import type { StorageProvider } from '../../storage/provider';
import type { EnrollmentService } from '../academics/enrollment';
import type { AccountService } from '../people/accounts';
import { toImportBatch } from '../finance/bank';

type RowError = { field?: string; message: string };
const optional = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * Student/teacher CSV imports: download template → upload → validate every row → inspect errors
 * and duplicates → confirm → commit profiles in one transaction → provision sign-in in background.
 * An invalid batch never commits anything.
 */
export class ImportService {
  constructor(
    private readonly db: Db,
    private readonly storage: StorageProvider,
    private readonly accounts: AccountService,
    private readonly enrollment: EnrollmentService,
    private readonly jobs: JobQueue,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  template(kind: 'students' | 'teachers') {
    const columns = kind === 'students' ? studentImportColumns : teacherImportColumns;
    return toCsv(
      columns.map((c) => c.key),
      [columns.map((c) => c.example)],
    );
  }

  async create(actor: Actor, raw: z.input<typeof createPeopleImportRequest>) {
    requireAdmin(actor);
    const input = createPeopleImportRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      const [f] = await tx.select().from(files).where(eq(files.id, input.fileId));
      const file = required(f, 'File');
      if (file.purpose !== 'import' || file.lifecycle !== 'available') throw errors.field('fileId', 'Upload the CSV file first');
      const body = await this.storage.read(file.objectKey);
      let records: Array<Record<string, string>>;
      try {
        records = parseCsv(body);
      } catch (e) {
        throw errors.field('fileId', `The CSV could not be read: ${e instanceof Error ? e.message : 'invalid format'}`);
      }
      if (records.length > MAX_IMPORT_ROWS) throw errors.field('fileId', `A file can contain at most ${MAX_IMPORT_ROWS} rows`);
      const columns = input.kind === 'students' ? studentImportColumns : teacherImportColumns;
      const header = Object.keys(records[0] ?? {});
      const missing = columns.filter((c) => c.required && !header.includes(c.key)).map((c) => c.key);
      if (records.length && missing.length) throw errors.field('fileId', `Missing columns: ${missing.join(', ')}. Use the template headers.`);

      const [batch] = await tx
        .insert(importBatches)
        .values({
          schoolId: actor.schoolId,
          kind: input.kind,
          fileId: file.id,
          fileName: file.originalName,
          fileHash: createHash('sha256').update(body).digest('hex'),
          state: 'validating',
          createdByAccountId: actor.accountId,
        })
        .returning();
      const validated = input.kind === 'students' ? await this.validateStudents(tx, records) : await this.validateTeachers(tx, records);
      let errorCount = 0;
      for (const [i, row] of validated.entries()) {
        if (row.status !== 'valid') errorCount++;
        await tx.insert(importRows).values({
          schoolId: actor.schoolId,
          batchId: batch!.id,
          rowNumber: i + 2,
          raw: records[i]!,
          normalized: row.normalized,
          status: row.status,
          errors: row.errors,
        });
      }
      const summary = { valid: validated.length - errorCount, invalid: errorCount };
      await tx
        .update(importBatches)
        .set({ state: errorCount || !records.length ? 'invalid' : 'validated', rowCount: records.length, errorCount, summary })
        .where(eq(importBatches.id, batch!.id));
      await audit(tx, actor, { action: `import.${input.kind}_validated`, entityType: 'import_batch', entityId: batch!.id, summary });
      return batch!.id;
    });
    return this.get(actor, id);
  }

  private async validateStudents(tx: Tx, records: Array<Record<string, string>>) {
    const years = await tx.select().from(academicYears);
    const offerings = await tx.select({ co: classOfferings, g: gradeLevels }).from(classOfferings).innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId));
    const secs = await tx.select().from(sections);
    const strs = await tx.select().from(streams);
    const usernames = records.map((r) => (r['username'] ?? '').trim().toLowerCase()).filter(Boolean);
    const admissions = records.map((r) => (r['admission_number'] ?? '').trim()).filter(Boolean);
    const takenUsernames = new Set(usernames.length ? (await tx.select({ u: accounts.username }).from(accounts).where(inArray(accounts.username, usernames))).map((x) => x.u) : []);
    const takenAdmissions = new Set(admissions.length ? (await tx.select({ a: students.admissionNumber }).from(students).where(inArray(students.admissionNumber, admissions))).map((x) => x.a) : []);
    const seenU = new Map<string, number>();
    const seenA = new Map<string, number>();
    return records.map((r, i) => {
      const errs: RowError[] = [];
      const get = (k: string) => (r[k] ?? '').trim();
      for (const c of studentImportColumns) if (c.required && !get(c.key)) errs.push({ field: c.key, message: 'Required' });
      const u = usernameSchema.safeParse(get('username'));
      if (get('username') && !u.success) errs.push({ field: 'username', message: u.error.issues[0]!.message });
      const uname = u.success ? u.data : get('username').toLowerCase();
      if (uname && takenUsernames.has(uname)) errs.push({ field: 'username', message: 'Already used by an existing account' });
      if (uname && seenU.has(uname)) errs.push({ field: 'username', message: `Duplicate of row ${seenU.get(uname)! + 2}` });
      seenU.set(uname, i);
      const adm = get('admission_number');
      if (adm && takenAdmissions.has(adm)) errs.push({ field: 'admission_number', message: 'Already used by an existing student' });
      if (adm && seenA.has(adm)) errs.push({ field: 'admission_number', message: `Duplicate of row ${seenA.get(adm)! + 2}` });
      seenA.set(adm, i);
      for (const k of ['admission_date', 'date_of_birth']) if (get(k) && !isoDate.safeParse(get(k)).success) errs.push({ field: k, message: 'Use YYYY-MM-DD' });
      if (get('gender') && !(genders as readonly string[]).includes(get('gender').toLowerCase())) errs.push({ field: 'gender', message: `Use ${genders.join(', ')}` });
      if (get('email') && !zod.email().safeParse(get('email')).success) errs.push({ field: 'email', message: 'Invalid email' });
      const year = years.find((y) => y.code.toUpperCase() === get('academic_year_code').toUpperCase());
      if (get('academic_year_code') && !year) errs.push({ field: 'academic_year_code', message: 'Unknown academic year' });
      if (year?.status === 'closed') errs.push({ field: 'academic_year_code', message: 'This academic year is closed' });
      const offering = year ? offerings.find((o) => o.co.academicYearId === year.id && o.g.code.toUpperCase() === get('class_code').toUpperCase()) : undefined;
      if (year && get('class_code') && !offering) errs.push({ field: 'class_code', message: 'This class is not offered in the academic year' });
      const section = offering ? secs.find((s) => s.classOfferingId === offering.co.id && s.code.toUpperCase() === get('section_code').toUpperCase() && !s.archivedAt) : undefined;
      if (offering && get('section_code') && !section) errs.push({ field: 'section_code', message: 'Unknown section for this class' });
      const stream = get('stream_code') ? strs.find((s) => s.code.toUpperCase() === get('stream_code').toUpperCase()) : undefined;
      if (get('stream_code') && !stream) errs.push({ field: 'stream_code', message: 'Unknown stream' });
      if (get('guardian_name') && !get('guardian_relationship')) errs.push({ field: 'guardian_relationship', message: 'Required when a guardian is given' });
      const status = errs.length ? (errs.some((e) => /Duplicate|Already used/.test(e.message)) ? ('duplicate' as const) : ('invalid' as const)) : ('valid' as const);
      return {
        status,
        errors: errs,
        normalized: errs.length
          ? null
          : {
              admissionNumber: adm,
              displayName: get('display_name'),
              displayNameUr: optional(r['display_name_ur']),
              username: uname,
              admissionDate: get('admission_date'),
              classOfferingId: offering!.co.id,
              sectionId: section!.id,
              streamId: stream?.id ?? null,
              gender: optional(r['gender'])?.toLowerCase() ?? null,
              dateOfBirth: optional(r['date_of_birth']),
              phone: optional(r['phone']),
              email: optional(r['email']),
              address: optional(r['address']),
              guardian: get('guardian_name') ? { name: get('guardian_name'), relationship: get('guardian_relationship'), phone: optional(r['guardian_phone']) } : null,
            },
      };
    });
  }

  private async validateTeachers(tx: Tx, records: Array<Record<string, string>>) {
    const usernames = records.map((r) => (r['username'] ?? '').trim().toLowerCase()).filter(Boolean);
    const numbers = records.map((r) => (r['employee_number'] ?? '').trim()).filter(Boolean);
    const takenU = new Set(usernames.length ? (await tx.select({ u: accounts.username }).from(accounts).where(inArray(accounts.username, usernames))).map((x) => x.u) : []);
    const takenE = new Set(numbers.length ? (await tx.select({ e: teachers.employeeNumber }).from(teachers).where(inArray(teachers.employeeNumber, numbers))).map((x) => x.e) : []);
    const seenU = new Map<string, number>();
    const seenE = new Map<string, number>();
    return records.map((r, i) => {
      const errs: RowError[] = [];
      const get = (k: string) => (r[k] ?? '').trim();
      for (const c of teacherImportColumns) if (c.required && !get(c.key)) errs.push({ field: c.key, message: 'Required' });
      const u = usernameSchema.safeParse(get('username'));
      if (get('username') && !u.success) errs.push({ field: 'username', message: u.error.issues[0]!.message });
      const uname = u.success ? u.data : get('username').toLowerCase();
      if (uname && takenU.has(uname)) errs.push({ field: 'username', message: 'Already used by an existing account' });
      if (uname && seenU.has(uname)) errs.push({ field: 'username', message: `Duplicate of row ${seenU.get(uname)! + 2}` });
      seenU.set(uname, i);
      const emp = get('employee_number');
      if (emp && takenE.has(emp)) errs.push({ field: 'employee_number', message: 'Already used by an existing teacher' });
      if (emp && seenE.has(emp)) errs.push({ field: 'employee_number', message: `Duplicate of row ${seenE.get(emp)! + 2}` });
      seenE.set(emp, i);
      if (get('employment_start_date') && !isoDate.safeParse(get('employment_start_date')).success) errs.push({ field: 'employment_start_date', message: 'Use YYYY-MM-DD' });
      if (get('gender') && !(genders as readonly string[]).includes(get('gender').toLowerCase())) errs.push({ field: 'gender', message: `Use ${genders.join(', ')}` });
      if (get('email') && !zod.email().safeParse(get('email')).success) errs.push({ field: 'email', message: 'Invalid email' });
      const status = errs.length ? (errs.some((e) => /Duplicate|Already used/.test(e.message)) ? ('duplicate' as const) : ('invalid' as const)) : ('valid' as const);
      return {
        status,
        errors: errs,
        normalized: errs.length
          ? null
          : {
              employeeNumber: emp,
              displayName: get('display_name'),
              displayNameUr: optional(r['display_name_ur']),
              username: uname,
              employmentStartDate: get('employment_start_date'),
              jobTitle: optional(r['job_title']),
              gender: optional(r['gender'])?.toLowerCase() ?? null,
              phone: optional(r['phone']),
              email: optional(r['email']),
              qualifications: optional(r['qualifications']),
            },
      };
    });
  }

  async list(actor: Actor) {
    requireAdmin(actor);
    return this.run(actor, async (tx) =>
      (await tx.select().from(importBatches).where(inArray(importBatches.kind, ['students', 'teachers'])).orderBy(desc(importBatches.createdAt)).limit(100)).map(toImportBatch),
    );
  }

  async get(actor: Actor, batchId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId));
      const batch = required(b, 'Import');
      const rows = await tx.select().from(importRows).where(eq(importRows.batchId, batchId)).orderBy(asc(importRows.rowNumber)).limit(5000);
      return {
        ...toImportBatch(batch),
        rows: rows.map((r) => ({
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
        nextCursor: null,
      };
    });
  }

  /** Queues the commit; large batches run in the worker so requests stay responsive. */
  async requestCommit(actor: Actor, batchId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).for('update');
      const batch = required(b, 'Import');
      if (batch.state !== 'validated') throw errors.rule('Only a fully valid import can be committed. Fix the file and upload it again.');
      await tx.update(importBatches).set({ state: 'committing', version: batch.version + 1 }).where(eq(importBatches.id, batchId));
      await this.jobs.enqueue(tx, 'importCommit', { schoolId: actor.schoolId, batchId, accountId: actor.accountId }, { singletonKey: batchId });
    });
    return this.get(actor, batchId);
  }

  /** Creates every profile in one transaction; sign-in provisioning is queued per account. */
  async commit(actor: Actor, batchId: string) {
    const created = await this.run(actor, async (tx) => {
      const [b] = await tx.select().from(importBatches).where(eq(importBatches.id, batchId)).for('update');
      const batch = required(b, 'Import');
      if (batch.state === 'committed') return 0;
      if (!['validated', 'committing'].includes(batch.state)) throw errors.rule('This import cannot be committed.');
      const rows = await tx.select().from(importRows).where(and(eq(importRows.batchId, batchId), eq(importRows.status, 'valid'))).orderBy(asc(importRows.rowNumber));
      let count = 0;
      for (const row of rows) {
        const n = row.normalized as Record<string, any>;
        if (batch.kind === 'students') {
          const account = await this.accounts.createPending(tx, actor, { username: n['username'], displayName: n['displayName'], displayNameUr: n['displayNameUr'], roles: ['student'] });
          const [st] = await tx
            .insert(students)
            .values({
              schoolId: actor.schoolId,
              accountId: account.id,
              admissionNumber: n['admissionNumber'],
              admissionDate: n['admissionDate'],
              gender: n['gender'],
              dateOfBirth: n['dateOfBirth'],
              phone: n['phone'],
              email: n['email'],
              address: n['address'],
            })
            .returning();
          if (n['guardian']) {
            const [g] = await tx.insert(guardians).values({ schoolId: actor.schoolId, name: n['guardian'].name, phone: n['guardian'].phone }).returning();
            await tx.insert(studentGuardians).values({ schoolId: actor.schoolId, studentId: st!.id, guardianId: g!.id, relationship: n['guardian'].relationship, isPrimary: true });
          }
          await this.enrollment.enroll(tx, actor, st!.id, {
            classOfferingId: n['classOfferingId'],
            sectionId: n['sectionId'],
            streamId: n['streamId'],
            startDate: n['admissionDate'] > (await this.yearStart(tx, n['classOfferingId'])) ? n['admissionDate'] : await this.yearStart(tx, n['classOfferingId']),
          });
          await this.jobs.enqueue(tx, 'accountProvision', { schoolId: actor.schoolId, accountId: account.id });
          await tx.update(importRows).set({ status: 'committed', outcome: { studentId: st!.id, accountId: account.id } }).where(eq(importRows.id, row.id));
        } else {
          const account = await this.accounts.createPending(tx, actor, { username: n['username'], displayName: n['displayName'], displayNameUr: n['displayNameUr'], roles: ['teacher'] });
          const [te] = await tx
            .insert(teachers)
            .values({
              schoolId: actor.schoolId,
              accountId: account.id,
              employeeNumber: n['employeeNumber'],
              gender: n['gender'],
              phone: n['phone'],
              email: n['email'],
              qualifications: n['qualifications'],
            })
            .returning();
          await tx.insert(employmentRecords).values({ schoolId: actor.schoolId, teacherId: te!.id, startDate: n['employmentStartDate'], jobTitle: n['jobTitle'] ?? 'Teacher' });
          await this.jobs.enqueue(tx, 'accountProvision', { schoolId: actor.schoolId, accountId: account.id });
          await tx.update(importRows).set({ status: 'committed', outcome: { teacherId: te!.id, accountId: account.id } }).where(eq(importRows.id, row.id));
        }
        count++;
      }
      await tx
        .update(importBatches)
        .set({ state: 'committed', committedAt: new Date(), committedByAccountId: actor.accountId, summary: { ...batch.summary, created: count } })
        .where(eq(importBatches.id, batchId));
      await audit(tx, actor, { action: `import.${batch.kind}_committed`, entityType: 'import_batch', entityId: batchId, summary: { created: count } });
      return count;
    });
    return { created };
  }

  async markFailed(actor: Actor, batchId: string, message: string) {
    await this.run(actor, (tx) =>
      tx.update(importBatches).set({ state: 'failed', summary: sql`${importBatches.summary} || ${JSON.stringify({ error: message })}::jsonb` }).where(eq(importBatches.id, batchId)),
    );
  }

  private async yearStart(tx: Tx, classOfferingId: string) {
    const [row] = await tx.select({ start: academicYears.startDate }).from(classOfferings).innerJoin(academicYears, eq(academicYears.id, classOfferings.academicYearId)).where(eq(classOfferings.id, classOfferingId));
    return row!.start;
  }
}
