import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PromotionBatch } from '@edventure/contracts';
import { createPromotionBatchRequest, updatePromotionDecisionRequest, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  academicYears,
  accounts,
  classOfferings,
  gradeLevels,
  promotionBatches,
  promotionDecisions,
  resultPublications,
  sections,
  studentEnrollments,
  studentResults,
  students,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { addDays } from '../../platform/dates';
import { errors, required } from '../../platform/errors';
import { withIdempotency } from '../../platform/idempotency';
import { requireAdmin } from '../../platform/scope';
import type { EnrollmentService } from '../academics/enrollment';

type BatchRow = typeof promotionBatches.$inferSelect;

/**
 * Promotion: published final results → recommendations → review incomplete/failed cases →
 * destinations → overrides with reasons → approval → idempotent creation of next-year enrollments.
 * Old enrollments stay intact; repeated execution never duplicates enrollments.
 */
export class PromotionService {
  constructor(
    private readonly db: Db,
    private readonly enrollment: EnrollmentService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /** Fingerprint of the reviewed results; approval/execution fail if results change afterwards. */
  private async resultsFingerprint(tx: Tx, publicationId: string) {
    const [p] = await tx.select().from(resultPublications).where(eq(resultPublications.id, publicationId));
    const pub = required(p, 'Results');
    return { pub, fingerprint: `${pub.id}:${pub.revision}:${pub.state}:${pub.inputSnapshot?.fingerprint ?? ''}` };
  }

  private async destinations(tx: Tx, batch: Pick<BatchRow, 'sourceClassOfferingId' | 'targetAcademicYearId'>) {
    const [source] = await tx
      .select({ co: classOfferings, g: gradeLevels })
      .from(classOfferings)
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .where(eq(classOfferings.id, batch.sourceClassOfferingId));
    const src = required(source, 'Class');
    const find = async (gradeLevelId: string | null) => {
      if (!gradeLevelId) return null;
      const [co] = await tx
        .select({ co: classOfferings, g: gradeLevels })
        .from(classOfferings)
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(and(eq(classOfferings.academicYearId, batch.targetAcademicYearId), eq(classOfferings.gradeLevelId, gradeLevelId)));
      if (!co) return null;
      const secs = await tx.select().from(sections).where(and(eq(sections.classOfferingId, co.co.id), isNull(sections.archivedAt))).orderBy(asc(sections.code));
      return { classOfferingId: co.co.id, gradeName: co.g.name, sections: secs.map((s) => ({ id: s.id, name: s.name, code: s.code })) };
    };
    return {
      source: src,
      promote: src.g.isTerminal ? null : await find(src.g.nextGradeLevelId),
      repeat: await find(src.g.id),
    };
  }

  async create(actor: Actor, raw: z.input<typeof createPromotionBatchRequest>) {
    requireAdmin(actor);
    const input = createPromotionBatchRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      const { pub, fingerprint } = await this.resultsFingerprint(tx, input.resultPublicationId);
      if (pub.state !== 'published') throw errors.rule('Promotion uses published results only.');
      if (!pub.isFinal) throw errors.rule('Promotion uses final exam results. Mark the exam as final.');
      if (pub.academicYearId === input.targetAcademicYearId) throw errors.field('targetAcademicYearId', 'Choose the next academic year');
      const [target] = await tx.select().from(academicYears).where(eq(academicYears.id, input.targetAcademicYearId));
      if (!target || target.status === 'closed') throw errors.field('targetAcademicYearId', 'The target year must be open');
      const existing = await tx
        .select({ id: promotionBatches.id })
        .from(promotionBatches)
        .where(and(eq(promotionBatches.sourceClassOfferingId, pub.classOfferingId), eq(promotionBatches.targetAcademicYearId, input.targetAcademicYearId), sql`${promotionBatches.state} <> 'cancelled'`));
      if (existing.length) throw errors.conflict('A promotion batch for this class and year already exists.', { batchId: existing[0]!.id });

      const dest = await this.destinations(tx, { sourceClassOfferingId: pub.classOfferingId, targetAcademicYearId: input.targetAcademicYearId });
      if (!dest.source.g.isTerminal && !dest.source.g.nextGradeLevelId) {
        throw errors.rule(`Configure the next class for ${dest.source.g.name} before promotion.`);
      }
      const [batch] = await tx
        .insert(promotionBatches)
        .values({
          schoolId: actor.schoolId,
          sourceAcademicYearId: pub.academicYearId,
          targetAcademicYearId: input.targetAcademicYearId,
          sourceClassOfferingId: pub.classOfferingId,
          resultPublicationId: pub.id,
          resultsFingerprint: fingerprint,
          createdByAccountId: actor.accountId,
        })
        .returning();

      const enrollments = await tx
        .select({ e: studentEnrollments, sr: studentResults, placementSection: sections })
        .from(studentEnrollments)
        .leftJoin(studentResults, and(eq(studentResults.enrollmentId, studentEnrollments.id), eq(studentResults.publicationId, pub.id)))
        .leftJoin(sections, eq(sections.id, studentResults.sectionId))
        .where(and(eq(studentEnrollments.classOfferingId, pub.classOfferingId), eq(studentEnrollments.status, 'active')));
      for (const { e, sr, placementSection } of enrollments) {
        const recommendation = !sr || sr.outcome === 'incomplete' ? 'review' : sr.outcome === 'pass' ? (dest.source.g.isTerminal ? 'graduate' : 'promote') : 'repeat';
        const target = recommendation === 'promote' ? dest.promote : recommendation === 'repeat' ? dest.repeat : null;
        const sameCode = target?.sections.find((s) => s.code === placementSection?.code) ?? (target?.sections.length === 1 ? target.sections[0] : undefined);
        await tx.insert(promotionDecisions).values({
          schoolId: actor.schoolId,
          batchId: batch!.id,
          sourceEnrollmentId: e.id,
          studentId: e.studentId,
          studentResultId: sr?.id ?? null,
          recommendation,
          decision: recommendation === 'review' ? null : recommendation,
          destinationClassOfferingId: target?.classOfferingId ?? null,
          destinationSectionId: sameCode?.id ?? null,
        });
      }
      await audit(tx, actor, { action: 'promotion.batch_created', entityType: 'promotion_batch', entityId: batch!.id, summary: { students: enrollments.length } });
      return batch!.id;
    });
    return this.get(actor, id);
  }

  async get(actor: Actor, id: string): Promise<PromotionBatch> {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [b] = await tx.select().from(promotionBatches).where(eq(promotionBatches.id, id));
      const batch = required(b, 'Promotion batch');
      const dest = await this.destinations(tx, batch);
      const rows = await tx
        .select({ d: promotionDecisions, name: accounts.displayName, adm: students.admissionNumber, sr: studentResults, srcSection: sections.name })
        .from(promotionDecisions)
        .innerJoin(students, eq(students.id, promotionDecisions.studentId))
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .leftJoin(studentResults, eq(studentResults.id, promotionDecisions.studentResultId))
        .leftJoin(sections, eq(sections.id, studentResults.sectionId))
        .where(eq(promotionDecisions.batchId, id))
        .orderBy(asc(accounts.displayName));
      const destSections = new Map([...(dest.promote?.sections ?? []), ...(dest.repeat?.sections ?? [])].map((s) => [s.id, s.name]));
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const key = r.d.decision ?? 'undecided';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return {
        id: batch.id,
        sourceAcademicYearId: batch.sourceAcademicYearId,
        targetAcademicYearId: batch.targetAcademicYearId,
        sourceClassOfferingId: batch.sourceClassOfferingId,
        sourceGradeName: dest.source.g.name,
        resultPublicationId: batch.resultPublicationId,
        state: batch.state,
        approvedAt: batch.approvedAt?.toISOString() ?? null,
        executedAt: batch.executedAt?.toISOString() ?? null,
        counts,
        destinations: {
          promote: dest.promote ? { classOfferingId: dest.promote.classOfferingId, gradeName: dest.promote.gradeName, sections: dest.promote.sections.map(({ id: sid, name }) => ({ id: sid, name })) } : null,
          repeat: dest.repeat ? { classOfferingId: dest.repeat.classOfferingId, gradeName: dest.repeat.gradeName, sections: dest.repeat.sections.map(({ id: sid, name }) => ({ id: sid, name })) } : null,
        },
        decisions: rows.map(({ d, name, adm, sr, srcSection }) => ({
          id: d.id,
          studentId: d.studentId,
          displayName: name,
          admissionNumber: adm,
          sourceSectionName: srcSection,
          resultOutcome: sr?.outcome ?? null,
          percentage: sr?.percentage ?? null,
          recommendation: d.recommendation,
          decision: d.decision,
          overrideReason: d.overrideReason,
          destinationClassOfferingId: d.destinationClassOfferingId,
          destinationSectionId: d.destinationSectionId,
          destinationSectionName: d.destinationSectionId ? (destSections.get(d.destinationSectionId) ?? null) : null,
          executedAt: d.executedAt?.toISOString() ?? null,
          version: d.version,
        })),
        version: batch.version,
      };
    });
  }

  async updateDecision(actor: Actor, decisionId: string, raw: z.input<typeof updatePromotionDecisionRequest>) {
    requireAdmin(actor);
    const input = updatePromotionDecisionRequest.parse(raw);
    const batchId = await this.run(actor, async (tx) => {
      const [row] = await tx.select({ d: promotionDecisions, b: promotionBatches }).from(promotionDecisions)
        .innerJoin(promotionBatches, eq(promotionBatches.id, promotionDecisions.batchId))
        .where(eq(promotionDecisions.id, decisionId));
      const found = required(row, 'Decision');
      if (!['draft', 'reviewed'].includes(found.b.state)) throw errors.rule('Decisions are locked after approval.');
      if (found.d.version !== input.version) throw errors.version();
      if (input.decision !== found.d.recommendation && !input.overrideReason) {
        throw errors.field('overrideReason', 'Explain why you are overriding the recommendation');
      }
      const dest = await this.destinations(tx, found.b);
      const target = input.decision === 'promote' ? dest.promote : input.decision === 'repeat' ? dest.repeat : null;
      if ((input.decision === 'promote' || input.decision === 'repeat') && !target) {
        throw errors.rule(`Create the ${input.decision === 'promote' ? 'next' : 'same'} class in the target academic year first.`);
      }
      const sectionId = input.destinationSectionId ?? (target && target.sections.some((s) => s.id === found.d.destinationSectionId) ? found.d.destinationSectionId : null);
      if (sectionId && target && !target.sections.some((s) => s.id === sectionId)) throw errors.field('destinationSectionId', 'Choose a section of the destination class');
      await tx
        .update(promotionDecisions)
        .set({
          decision: input.decision,
          overrideReason: input.decision === found.d.recommendation ? null : (input.overrideReason ?? null),
          destinationClassOfferingId: target?.classOfferingId ?? null,
          destinationSectionId: target ? sectionId : null,
          version: found.d.version + 1,
        })
        .where(eq(promotionDecisions.id, decisionId));
      await audit(tx, actor, {
        action: 'promotion.decision_changed',
        entityType: 'promotion_batch',
        entityId: found.b.id,
        reason: input.overrideReason ?? null,
        summary: { studentId: found.d.studentId, decision: input.decision, recommendation: found.d.recommendation },
      });
      return found.b.id;
    });
    return this.get(actor, batchId);
  }

  async approve(actor: Actor, batchId: string, version: number) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [b] = await tx.select().from(promotionBatches).where(eq(promotionBatches.id, batchId)).for('update');
      const batch = required(b, 'Promotion batch');
      if (batch.version !== version) throw errors.version();
      if (!['draft', 'reviewed'].includes(batch.state)) throw errors.rule('This batch is already approved.');
      const { fingerprint } = await this.resultsFingerprint(tx, batch.resultPublicationId);
      if (fingerprint !== batch.resultsFingerprint) throw errors.conflict('The results changed after this batch was prepared. Create a new batch.');
      const decisions = await tx.select().from(promotionDecisions).where(eq(promotionDecisions.batchId, batchId));
      const undecided = decisions.filter((d) => !d.decision);
      if (undecided.length) throw errors.rule(`${undecided.length} student(s) still need a decision.`);
      const noSection = decisions.filter((d) => (d.decision === 'promote' || d.decision === 'repeat') && !d.destinationSectionId);
      if (noSection.length) throw errors.rule(`${noSection.length} student(s) need a destination section.`);
      await tx.update(promotionBatches).set({ state: 'approved', approvedAt: new Date(), approvedByAccountId: actor.accountId, version: batch.version + 1 }).where(eq(promotionBatches.id, batchId));
      await audit(tx, actor, { action: 'promotion.approved', entityType: 'promotion_batch', entityId: batchId, summary: { students: decisions.length } });
    });
    return this.get(actor, batchId);
  }

  /**
   * Creates next-year enrollments for approved decisions. Safe to retry: each decision is executed
   * once (unique destination enrollment per decision), and an Idempotency-Key replays the response.
   */
  async execute(actor: Actor, batchId: string, idempotencyKey?: string) {
    requireAdmin(actor);
    const result = await this.run(actor, async (tx) =>
      (
        await withIdempotency(tx, actor, `promotion:${batchId}`, idempotencyKey, { batchId }, async () => {
          const [b] = await tx.select().from(promotionBatches).where(eq(promotionBatches.id, batchId)).for('update');
          const batch = required(b, 'Promotion batch');
          if (batch.state !== 'approved' && batch.state !== 'executed') throw errors.rule('Approve the batch before executing it.');
          const { fingerprint } = await this.resultsFingerprint(tx, batch.resultPublicationId);
          if (fingerprint !== batch.resultsFingerprint) throw errors.conflict('The results changed after approval. Create a new batch.');
          const [target] = await tx.select().from(academicYears).where(eq(academicYears.id, batch.targetAcademicYearId));
          const [source] = await tx.select().from(academicYears).where(eq(academicYears.id, batch.sourceAcademicYearId));
          const decisions = await tx.select().from(promotionDecisions).where(and(eq(promotionDecisions.batchId, batchId), isNull(promotionDecisions.executedAt)));
          let created = 0;
          let graduated = 0;
          let skipped = 0;
          const sourceEnd = addDays(source!.endDate, 1);
          for (const d of decisions) {
            const [source_] = await tx.select().from(studentEnrollments).where(eq(studentEnrollments.id, d.sourceEnrollmentId)).for('update');
            if (d.decision === 'promote' || d.decision === 'repeat') {
              const enrollment = await this.enrollment.enroll(tx, actor, d.studentId, {
                classOfferingId: d.destinationClassOfferingId!,
                sectionId: d.destinationSectionId!,
                startDate: target!.startDate,
                reason: d.decision === 'promote' ? 'promotion' : 'repeat',
                sourcePromotionDecisionId: d.id,
                streamId: await this.currentStream(tx, d.sourceEnrollmentId),
              });
              await tx.update(promotionDecisions).set({ executedAt: new Date(), destinationEnrollmentId: enrollment.id }).where(eq(promotionDecisions.id, d.id));
              created++;
            } else {
              await tx.update(promotionDecisions).set({ executedAt: new Date() }).where(eq(promotionDecisions.id, d.id));
              if (d.decision === 'graduate') graduated++;
              else skipped++;
            }
            if (source_ && source_.status === 'active' && d.decision !== 'hold') {
              const status = d.decision === 'withdraw' ? 'withdrawn' : 'completed';
              const end = source_.endDate ?? (sourceEnd > source_.startDate ? sourceEnd : addDays(source_.startDate, 1));
              await this.enrollment.closeEnrollmentRows(tx, source_.id, end);
              await tx.update(studentEnrollments).set({ status, endDate: end, statusReason: `Promotion: ${d.decision}` }).where(eq(studentEnrollments.id, source_.id));
            }
          }
          await tx.update(promotionBatches).set({ state: 'executed', executedAt: new Date(), version: batch.version + 1 }).where(eq(promotionBatches.id, batchId));
          await audit(tx, actor, { action: 'promotion.executed', entityType: 'promotion_batch', entityId: batchId, summary: { created, graduated, skipped } });
          return { status: 200, body: { created, graduated, skipped } };
        })
      ).body,
    );
    return { batch: await this.get(actor, batchId), ...result };
  }

  /** Stream carried into the next year so subject defaults follow the student. */
  private async currentStream(tx: Tx, enrollmentId: string) {
    const [row] = await tx.execute<{ stream_id: string }>(sql`
      select stream_id from app.student_stream_assignments where enrollment_id = ${enrollmentId} order by start_date desc limit 1`);
    return row?.stream_id ?? null;
  }

  async cancel(actor: Actor, batchId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(promotionBatches)
        .set({ state: 'cancelled' })
        .where(and(eq(promotionBatches.id, batchId), inArray(promotionBatches.state, ['draft', 'reviewed', 'approved'])))
        .returning({ id: promotionBatches.id });
      if (!rows.length) throw errors.rule('Executed batches cannot be cancelled.');
      await audit(tx, actor, { action: 'promotion.cancelled', entityType: 'promotion_batch', entityId: batchId });
    });
  }

  async list(actor: Actor, targetAcademicYearId?: string) {
    requireAdmin(actor);
    const ids = await this.run(actor, async (tx) =>
      (await tx.select({ id: promotionBatches.id }).from(promotionBatches).where(targetAcademicYearId ? eq(promotionBatches.targetAcademicYearId, targetAcademicYearId) : undefined)).map((r) => r.id),
    );
    return Promise.all(ids.map((id) => this.get(actor, id)));
  }
}
