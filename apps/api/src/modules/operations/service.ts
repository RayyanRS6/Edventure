import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  accounts,
  deletionRequests,
  deviceTokens,
  files,
  guardians,
  idempotencyRecords,
  reportJobs,
  retentionHolds,
  studentDocuments,
  studentGuardians,
  students,
  teacherDocuments,
  teachers,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import type { AuthProvider } from '../../auth/provider';
import { systemActor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import type { StorageProvider } from '../../storage/provider';

/**
 * Retention and housekeeping. All operations are idempotent (safe to re-run after a crash) and
 * audited. Academic and financial records are never purged here: after the 30-day recovery window
 * personal details are pseudonymized while stable references (admission/employee numbers, marks,
 * attendance, invoices) remain intact.
 */
export class OperationsService {
  constructor(
    private readonly db: Db,
    private readonly auth: AuthProvider,
    private readonly storage: StorageProvider,
  ) {}

  async activeSchoolIds(): Promise<string[]> {
    const rows = await this.db.execute<{ id: string }>(sql`select id from app.active_school_ids() as id`);
    return rows.map((r) => r.id);
  }

  async processDeletions(schoolId: string, now = new Date()) {
    const actor = systemActor(schoolId);
    const ctx = { schoolId, accountId: null, roles: ['school_admin'] as const };
    const due = await withTenant(this.db, ctx, (tx) =>
      tx.select().from(deletionRequests).where(and(eq(deletionRequests.state, 'pending'), lt(deletionRequests.recoverUntil, now))),
    );
    let processed = 0;
    let held = 0;
    for (const req of due) {
      const outcome = await withTenant(this.db, ctx, async (tx) => {
        const [locked] = await tx.select().from(deletionRequests).where(and(eq(deletionRequests.id, req.id), eq(deletionRequests.state, 'pending'))).for('update');
        if (!locked) return null;
        const holds = await tx
          .select({ id: retentionHolds.id })
          .from(retentionHolds)
          .where(and(isNull(retentionHolds.releasedAt), inArray(retentionHolds.subjectId, [req.accountId, req.subjectId])));
        if (holds.length) return 'held' as const;
        const [account] = await tx.select().from(accounts).where(eq(accounts.id, req.accountId));
        const label = req.subjectType === 'student' ? 'Former student' : req.subjectType === 'teacher' ? 'Former teacher' : 'Former administrator';
        const removedFiles: string[] = [];
        if (req.subjectType === 'student') {
          const [st] = await tx.select().from(students).where(eq(students.accountId, req.accountId));
          if (st) {
            const docIds = (await tx.select({ id: studentDocuments.fileId }).from(studentDocuments).where(eq(studentDocuments.studentId, st.id))).map((d) => d.id);
            const fileIds = [...docIds, ...(st.photoFileId ? [st.photoFileId] : [])];
            if (fileIds.length) {
              const personal = await tx.select().from(files).where(inArray(files.id, fileIds));
              removedFiles.push(...personal.map((f) => f.objectKey));
              await tx.update(files).set({ lifecycle: 'deleted', deletedAt: new Date() }).where(inArray(files.id, fileIds));
            }
            await tx.update(students).set({ phone: null, email: null, address: null, dateOfBirth: null, notes: null, photoFileId: null }).where(eq(students.id, st.id));
            const links = await tx.select().from(studentGuardians).where(eq(studentGuardians.studentId, st.id));
            await tx.delete(studentGuardians).where(eq(studentGuardians.studentId, st.id));
            for (const l of links) {
              const [other] = await tx.select({ id: studentGuardians.id }).from(studentGuardians).where(eq(studentGuardians.guardianId, l.guardianId));
              if (!other) await tx.delete(guardians).where(eq(guardians.id, l.guardianId));
            }
          }
        }
        if (req.subjectType === 'teacher') {
          const [te] = await tx.select().from(teachers).where(eq(teachers.accountId, req.accountId));
          if (te) {
            const docs = await tx.select({ f: files }).from(teacherDocuments).innerJoin(files, eq(files.id, teacherDocuments.fileId)).where(eq(teacherDocuments.teacherId, te.id));
            removedFiles.push(...docs.map((d) => d.f.objectKey));
            if (docs.length) await tx.update(files).set({ lifecycle: 'deleted', deletedAt: new Date() }).where(inArray(files.id, docs.map((d) => d.f.id)));
            await tx.update(teachers).set({ phone: null, email: null, address: null, qualifications: null, photoFileId: null }).where(eq(teachers.id, te.id));
          }
        }
        await tx.delete(deviceTokens).where(eq(deviceTokens.accountId, req.accountId));
        await tx
          .update(accounts)
          .set({ displayName: label, displayNameUr: null, username: `deleted-${req.accountId.slice(0, 8)}`, authUserId: null, anonymizedAt: new Date() })
          .where(eq(accounts.id, req.accountId));
        await tx
          .update(deletionRequests)
          .set({ state: 'processed', processedAt: new Date(), processingSummary: { ...(req.processingSummary ?? {}), pseudonymized: true, filesRemoved: removedFiles.filter(Boolean).length } })
          .where(eq(deletionRequests.id, req.id));
        await audit(tx, actor, { action: 'account.retention_processed', entityType: 'account', entityId: req.accountId });
        return { authUserId: account?.authUserId ?? null, removedFiles };
      });
      if (outcome === 'held') {
        held++;
        continue;
      }
      if (!outcome) continue;
      processed++;
      for (const key of outcome.removedFiles.filter(Boolean)) await this.storage.remove(key).catch(() => undefined);
      if (outcome.authUserId) await this.auth.deleteIdentity(outcome.authUserId).catch(() => undefined);
    }
    return { processed, held };
  }

  /** Expired exports, abandoned uploads and old idempotency records. */
  async maintenance(schoolId: string, now = new Date()) {
    const ctx = { schoolId, accountId: null, roles: ['school_admin'] as const };
    const expired = await withTenant(this.db, ctx, async (tx) => {
      const rows = await tx
        .select()
        .from(files)
        .where(
          and(
            sql`${files.lifecycle} in ('available', 'upload_pending', 'quarantine', 'rejected')`,
            sql`(${files.expiresAt} < ${now.toISOString()}::timestamptz and ${files.purpose} in ('export', 'report'))
              or (${files.lifecycle} = 'upload_pending' and ${files.createdAt} < ${new Date(now.getTime() - 24 * 3600 * 1000).toISOString()}::timestamptz)
              or ${files.lifecycle} = 'rejected'`,
          ),
        )
        .limit(1000);
      if (rows.length) await tx.update(files).set({ lifecycle: 'deleted', deletedAt: now }).where(inArray(files.id, rows.map((r) => r.id)));
      await tx.update(reportJobs).set({ state: 'expired' }).where(and(eq(reportJobs.state, 'succeeded'), lt(reportJobs.expiresAt, now)));
      await tx.delete(idempotencyRecords).where(lt(idempotencyRecords.expiresAt, now));
      return rows;
    });
    for (const f of expired) await this.storage.remove(f.objectKey).catch(() => undefined);
    return { filesRemoved: expired.length };
  }
}
