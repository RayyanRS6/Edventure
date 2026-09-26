import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, max, ne, sql } from 'drizzle-orm';
import type { GradingPolicy, ReportCard, ResultPublication, StudentResultView } from '@edventure/contracts';
import { calculateResultsRequest, gradingPolicyRequest, publishResultsRequest, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  academicYears,
  accounts,
  assessmentWeights,
  classOfferings,
  courseOfferings,
  examCycles,
  examPapers,
  examRegistrations,
  gradeBands,
  gradeLevels,
  gradingPolicyVersions,
  marksTable,
  resultPublications,
  schools,
  sections,
  studentEnrollments,
  studentResults,
  students,
  subjectResults,
  subjects,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { assertCanViewStudent, classTeacherSectionIds, requireAdmin, today } from '../../platform/scope';
import { attendanceRate } from '../attendance/calc';
import { studentAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';
import { calculateStudent, validateBands, type Policy, type SubjectInput } from './grading';

type PolicyRow = typeof gradingPolicyVersions.$inferSelect;
type PublicationRow = typeof resultPublications.$inferSelect;

/** The cycles combined into a publication; a single-cycle result is stored as `[{ cycle, 1 }]`. */
function combineOf(pub: PublicationRow) {
  const cycles = pub.inputSnapshot?.cycles ?? [];
  const single = cycles.length === 1 && cycles[0]!.examCycleId === pub.examCycleId && cycles[0]!.weight === '1';
  return single ? [] : cycles;
}

export class ResultsService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Grading policies ---------------- */

  private async toPolicy(tx: Tx, p: PolicyRow): Promise<GradingPolicy> {
    const bands = await tx.select().from(gradeBands).where(eq(gradeBands.policyVersionId, p.id)).orderBy(desc(gradeBands.minPercentage));
    const weights = await tx.select().from(assessmentWeights).where(eq(assessmentWeights.policyVersionId, p.id));
    const bandViews = bands.map((b) => ({ label: b.label, minPercentage: b.minPercentage, maxPercentage: b.maxPercentage, gradePoints: b.gradePoints, isPassing: b.isPassing }));
    return {
      id: p.id,
      name: p.name,
      versionNumber: p.versionNumber,
      state: p.state,
      passRequirement: p.passRequirement,
      absentRule: p.absentRule,
      displayDecimals: p.displayDecimals,
      gpaEnabled: p.gpaEnabled,
      bands: bandViews,
      weights: weights.map((w) => ({ examKind: w.examKind, weight: w.weight })),
      problems: validateBands(bandViews),
    };
  }

  async listPolicies(actor: Actor) {
    return this.run(actor, async (tx) => {
      const rows = await tx.select().from(gradingPolicyVersions).orderBy(desc(gradingPolicyVersions.versionNumber));
      return Promise.all(rows.map((p) => this.toPolicy(tx, p)));
    });
  }

  private async writeBands(tx: Tx, actor: Actor, policyId: string, input: z.infer<typeof gradingPolicyRequest>) {
    await tx.delete(gradeBands).where(eq(gradeBands.policyVersionId, policyId));
    await tx.delete(assessmentWeights).where(eq(assessmentWeights.policyVersionId, policyId));
    await tx.insert(gradeBands).values(
      input.bands.map((b, i) => ({
        schoolId: actor.schoolId,
        policyVersionId: policyId,
        label: b.label,
        minPercentage: b.minPercentage,
        maxPercentage: b.maxPercentage,
        gradePoints: b.gradePoints ?? null,
        isPassing: b.isPassing,
        sortOrder: i,
      })),
    );
    if (input.weights.length) {
      await tx.insert(assessmentWeights).values(input.weights.map((w) => ({ schoolId: actor.schoolId, policyVersionId: policyId, examKind: w.examKind, weight: w.weight })));
    }
  }

  async createPolicy(actor: Actor, raw: z.input<typeof gradingPolicyRequest>) {
    requireAdmin(actor);
    const input = gradingPolicyRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [{ next } = { next: 1 }] = await tx.select({ next: sql<number>`coalesce(max(${gradingPolicyVersions.versionNumber}), 0)::int + 1` }).from(gradingPolicyVersions);
      const [p] = await tx
        .insert(gradingPolicyVersions)
        .values({
          schoolId: actor.schoolId,
          name: input.name,
          versionNumber: next,
          passRequirement: {
            minOverallPercentage: input.passRequirement.minOverallPercentage,
            requireAllCompulsoryPass: input.passRequirement.requireAllCompulsoryPass,
            maxFailedSubjects: input.passRequirement.maxFailedSubjects,
          },
          absentRule: input.absentRule,
          displayDecimals: input.displayDecimals,
          gpaEnabled: input.gpaEnabled,
          createdByAccountId: actor.accountId,
        })
        .returning();
      await this.writeBands(tx, actor, p!.id, input);
      await audit(tx, actor, { action: 'grading_policy.created', entityType: 'grading_policy', entityId: p!.id });
      return this.toPolicy(tx, p!);
    });
  }

  /** Only drafts change. Existing publications always keep the policy version they used. */
  async updatePolicy(actor: Actor, id: string, raw: z.input<typeof gradingPolicyRequest>) {
    requireAdmin(actor);
    const input = gradingPolicyRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(gradingPolicyVersions).where(eq(gradingPolicyVersions.id, id)).for('update');
      const policy = required(p, 'Grading policy');
      if (policy.state !== 'draft') throw errors.rule('Active and retired policies cannot change. Create a new version instead.');
      const [updated] = await tx
        .update(gradingPolicyVersions)
        .set({
          name: input.name,
          passRequirement: {
            minOverallPercentage: input.passRequirement.minOverallPercentage,
            requireAllCompulsoryPass: input.passRequirement.requireAllCompulsoryPass,
            maxFailedSubjects: input.passRequirement.maxFailedSubjects,
          },
          absentRule: input.absentRule,
          displayDecimals: input.displayDecimals,
          gpaEnabled: input.gpaEnabled,
        })
        .where(eq(gradingPolicyVersions.id, id))
        .returning();
      await this.writeBands(tx, actor, id, input);
      await audit(tx, actor, { action: 'grading_policy.updated', entityType: 'grading_policy', entityId: id });
      return this.toPolicy(tx, updated!);
    });
  }

  async activatePolicy(actor: Actor, id: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(gradingPolicyVersions).where(eq(gradingPolicyVersions.id, id)).for('update');
      const policy = required(p, 'Grading policy');
      if (policy.state !== 'draft') throw errors.rule('Only draft policies can be activated.');
      const view = await this.toPolicy(tx, policy);
      if (view.problems.length) throw errors.rule('Fix the grade bands before activating.', { problems: view.problems });
      await tx.update(gradingPolicyVersions).set({ state: 'retired' }).where(eq(gradingPolicyVersions.state, 'active'));
      const [updated] = await tx.update(gradingPolicyVersions).set({ state: 'active', activatedAt: new Date() }).where(eq(gradingPolicyVersions.id, id)).returning();
      await audit(tx, actor, { action: 'grading_policy.activated', entityType: 'grading_policy', entityId: id });
      return this.toPolicy(tx, updated!);
    });
  }

  private async policyFor(tx: Tx, id: string): Promise<Policy> {
    const [p] = await tx.select().from(gradingPolicyVersions).where(eq(gradingPolicyVersions.id, id));
    const policy = required(p, 'Grading policy');
    const bands = await tx.select().from(gradeBands).where(eq(gradeBands.policyVersionId, id));
    return {
      minOverallPercentage: policy.passRequirement.minOverallPercentage,
      requireAllCompulsoryPass: policy.passRequirement.requireAllCompulsoryPass,
      maxFailedSubjects: policy.passRequirement.maxFailedSubjects,
      absentRule: policy.absentRule,
      gpaEnabled: policy.gpaEnabled,
      bands: bands.map((b) => ({ label: b.label, minPercentage: b.minPercentage, maxPercentage: b.maxPercentage, gradePoints: b.gradePoints, isPassing: b.isPassing })),
    };
  }

  /* ---------------- Calculation ---------------- */

  /**
   * Gathers every component (cycle × subject × student) and runs the pure calculator. Returns the
   * per-student results plus a fingerprint of all inputs, stored with the publication.
   */
  private async compute(tx: Tx, examCycleId: string, classOfferingId: string, combine: Array<{ examCycleId: string; weight: string }>, policy: Policy, policyId: string) {
    const cycles = combine.length ? combine : [{ examCycleId, weight: '1' }];
    const rows = await tx
      .select({
        cycleId: examPapers.examCycleId,
        paper: examPapers,
        course: courseOfferings,
        reg: examRegistrations,
        mark: marksTable,
      })
      .from(examPapers)
      .innerJoin(courseOfferings, eq(courseOfferings.id, examPapers.courseOfferingId))
      .innerJoin(examRegistrations, eq(examRegistrations.examPaperId, examPapers.id))
      .leftJoin(marksTable, eq(marksTable.examRegistrationId, examRegistrations.id))
      .where(and(inArray(examPapers.examCycleId, cycles.map((c) => c.examCycleId)), eq(courseOfferings.classOfferingId, classOfferingId)));
    const primary = rows.filter((r) => r.cycleId === examCycleId);
    const studentIds = [...new Set(primary.map((r) => r.reg.studentId))];
    const perStudent = new Map<string, { enrollmentId: string; sectionId: string | null; subjects: SubjectInput[] }>();
    for (const studentId of studentIds) {
      const mine = rows.filter((r) => r.reg.studentId === studentId);
      const primaryRows = mine.filter((r) => r.cycleId === examCycleId);
      const subjectsIn: SubjectInput[] = primaryRows.map((pr) => ({
        courseOfferingId: pr.course.id,
        compulsory: pr.course.requirement === 'compulsory',
        credit: pr.course.credit,
        displayMaxMarks: pr.paper.maxMarks,
        components: cycles
          .map((c) => mine.find((m) => m.cycleId === c.examCycleId && m.course.id === pr.course.id))
          .map((m, i) =>
            m
              ? {
                  weight: cycles[i]!.weight,
                  outcome: (m.mark?.outcome ?? 'missing') as SubjectInput['components'][number]['outcome'],
                  score: m.mark?.score ?? null,
                  maxMarks: m.paper.maxMarks,
                  passMarks: m.paper.passMarks,
                }
              : null,
          )
          .filter((x): x is NonNullable<typeof x> => x !== null),
      }));
      perStudent.set(studentId, { enrollmentId: primaryRows[0]!.reg.enrollmentId, sectionId: primaryRows[0]!.reg.sectionId, subjects: subjectsIn });
    }
    const results = new Map([...perStudent].map(([id, s]) => [id, { ...s, result: calculateStudent(s.subjects, policy) }]));
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ policyId, cycles, marks: rows.map((r) => [r.reg.id, r.mark?.outcome ?? null, r.mark?.score ?? null, r.mark?.version ?? 0]).sort() }))
      .digest('hex');
    return { results, fingerprint, cycles };
  }

  /** Creates or refreshes the draft publication (preview) for an exam and class. */
  async calculate(actor: Actor, raw: z.input<typeof calculateResultsRequest>, correctionReason?: string, supersedesId?: string) {
    requireAdmin(actor);
    const input = calculateResultsRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      const [cycle] = await tx.select().from(examCycles).where(eq(examCycles.id, input.examCycleId));
      const c = required(cycle, 'Exam');
      const [active] = await tx.select().from(gradingPolicyVersions).where(eq(gradingPolicyVersions.state, 'active'));
      if (!active) throw errors.rule('Configure and activate a grading policy before calculating results.');
      const policy = await this.policyFor(tx, active.id);
      const computed = await this.compute(tx, input.examCycleId, input.classOfferingId, input.combine ?? [], policy, active.id);
      if (!computed.results.size) throw errors.rule('No students are registered for this exam in the selected class.');

      let [draft] = await tx
        .select()
        .from(resultPublications)
        .where(and(eq(resultPublications.examCycleId, input.examCycleId), eq(resultPublications.classOfferingId, input.classOfferingId), eq(resultPublications.state, 'draft')))
        .for('update');
      const snapshot = { cycles: computed.cycles, calculatedAt: new Date().toISOString(), fingerprint: computed.fingerprint };
      if (draft) {
        const old = await tx.select({ id: studentResults.id }).from(studentResults).where(eq(studentResults.publicationId, draft.id));
        if (old.length) {
          await tx.delete(subjectResults).where(inArray(subjectResults.studentResultId, old.map((o) => o.id)));
          await tx.delete(studentResults).where(eq(studentResults.publicationId, draft.id));
        }
        [draft] = await tx
          .update(resultPublications)
          .set({
            policyVersionId: active.id,
            inputSnapshot: snapshot,
            ...(correctionReason ? { correctionReason, supersedesId: supersedesId ?? null } : {}),
            version: draft.version + 1,
          })
          .where(eq(resultPublications.id, draft.id))
          .returning();
      } else {
        const [{ last } = { last: 0 }] = await tx
          .select({ last: max(resultPublications.revision) })
          .from(resultPublications)
          .where(and(eq(resultPublications.examCycleId, input.examCycleId), eq(resultPublications.classOfferingId, input.classOfferingId)));
        const [{ published } = { published: null }] = await tx
          .select({ published: resultPublications.id })
          .from(resultPublications)
          .where(and(eq(resultPublications.examCycleId, input.examCycleId), eq(resultPublications.classOfferingId, input.classOfferingId), eq(resultPublications.state, 'published')));
        if (published && !correctionReason) throw errors.rule('Results are already published. Start a correction with a reason to revise them.');
        [draft] = await tx
          .insert(resultPublications)
          .values({
            schoolId: actor.schoolId,
            academicYearId: c.academicYearId,
            examCycleId: input.examCycleId,
            classOfferingId: input.classOfferingId,
            policyVersionId: active.id,
            revision: (last ?? 0) + 1,
            isFinal: c.isFinal,
            inputSnapshot: snapshot,
            correctionReason: correctionReason ?? null,
            supersedesId: supersedesId ?? published ?? null,
          })
          .returning();
      }
      for (const [studentId, s] of computed.results) {
        const r = s.result;
        const [sr] = await tx
          .insert(studentResults)
          .values({
            schoolId: actor.schoolId,
            publicationId: draft!.id,
            enrollmentId: s.enrollmentId,
            studentId,
            sectionId: s.sectionId,
            obtainedMarks: r.obtainedMarks,
            totalMarks: r.totalMarks,
            percentage: r.percentage,
            gradeLabel: r.gradeLabel,
            gpa: r.gpa,
            outcome: r.outcome,
            failedSubjects: r.failedSubjects,
          })
          .returning();
        await tx.insert(subjectResults).values(
          r.subjects.map((x) => ({
            schoolId: actor.schoolId,
            studentResultId: sr!.id,
            courseOfferingId: x.courseOfferingId,
            obtainedMarks: x.obtainedMarks,
            maxMarks: x.maxMarks,
            percentage: x.percentage,
            gradeLabel: x.gradeLabel,
            gradePoints: x.gradePoints,
            outcome: x.outcome,
          })),
        );
      }
      await audit(tx, actor, { action: 'results.calculated', entityType: 'result_publication', entityId: draft!.id, summary: { students: computed.results.size } });
      return draft!.id;
    });
    return this.get(actor, id);
  }

  async publish(actor: Actor, id: string, raw: z.input<typeof publishResultsRequest>) {
    requireAdmin(actor);
    const input = publishResultsRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(resultPublications).where(eq(resultPublications.id, id)).for('update');
      const pub = required(p, 'Results');
      if (pub.version !== input.version) throw errors.version();
      if (pub.state !== 'draft') throw errors.rule('Only draft results can be published.');
      // Recalculate the fingerprint: marks may have changed since the preview.
      const policy = await this.policyFor(tx, pub.policyVersionId);
      const current = await this.compute(tx, pub.examCycleId, pub.classOfferingId, combineOf(pub), policy, pub.policyVersionId);
      if (current.fingerprint !== pub.inputSnapshot?.fingerprint) throw errors.conflict('Marks changed after this preview. Recalculate before publishing.');
      const incomplete = await tx.select({ id: studentResults.id }).from(studentResults).where(and(eq(studentResults.publicationId, id), eq(studentResults.outcome, 'incomplete')));
      if (incomplete.length) throw errors.rule(`${incomplete.length} student(s) have missing or withheld marks. Complete them before publishing.`);
      await tx
        .update(resultPublications)
        .set({ state: 'superseded' })
        .where(and(eq(resultPublications.examCycleId, pub.examCycleId), eq(resultPublications.classOfferingId, pub.classOfferingId), eq(resultPublications.state, 'published')));
      await tx
        .update(resultPublications)
        .set({ state: 'published', publishedAt: new Date(), publishedByAccountId: actor.accountId, version: pub.version + 1 })
        .where(eq(resultPublications.id, id));
      await tx.update(examCycles).set({ state: 'published' }).where(and(eq(examCycles.id, pub.examCycleId), ne(examCycles.state, 'closed')));
      const [cycle] = await tx.select().from(examCycles).where(eq(examCycles.id, pub.examCycleId));
      const studentIds = (await tx.select({ id: studentResults.studentId }).from(studentResults).where(eq(studentResults.publicationId, id))).map((r) => r.id);
      await this.comms.notify(tx, actor, {
        kind: 'results.published',
        data: { examName: cycle!.name, examNameUr: cycle!.nameUr, revision: pub.revision },
        recipients: await studentAccountIds(tx, studentIds),
        entityType: 'result_publication',
        entityId: id,
        link: '/results',
        dedupeKey: `results:${id}`,
      });
      await audit(tx, actor, { action: 'results.published', entityType: 'result_publication', entityId: id, summary: { revision: pub.revision, students: studentIds.length } });
    });
    return this.get(actor, id);
  }

  /** Corrections create a new revision; the published one stays unchanged until the revision is published. */
  async revise(actor: Actor, publishedId: string, reason: string) {
    requireAdmin(actor);
    const pub = await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(resultPublications).where(eq(resultPublications.id, publishedId));
      const found = required(p, 'Results');
      if (found.state !== 'published') throw errors.rule('Only published results can be revised.');
      // Reopen marking for administrators on this cycle.
      await tx.update(examCycles).set({ state: 'review' }).where(eq(examCycles.id, found.examCycleId));
      return found;
    });
    const combine = combineOf(pub);
    return this.calculate(actor, { examCycleId: pub.examCycleId, classOfferingId: pub.classOfferingId, combine: combine.length ? combine : undefined }, reason, publishedId);
  }

  async setRemarks(actor: Actor, publicationId: string, studentResultId: string, remarks: string | null) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select({ sr: studentResults, p: resultPublications }).from(studentResults).innerJoin(resultPublications, eq(resultPublications.id, studentResults.publicationId))
        .where(and(eq(studentResults.id, studentResultId), eq(studentResults.publicationId, publicationId)));
      const found = required(row, 'Result');
      if (found.p.state !== 'draft') throw errors.rule('Remarks can only be edited before publication.');
      if (!isAdmin(actor)) {
        const own = actor.teacherId ? await classTeacherSectionIds(tx, actor.teacherId, today(actor)) : [];
        if (!found.sr.sectionId || !own.includes(found.sr.sectionId)) throw errors.forbidden('Only the class teacher can add remarks');
      }
      await tx.update(studentResults).set({ remarks }).where(eq(studentResults.id, studentResultId));
      await audit(tx, actor, { action: 'results.remarks_set', entityType: 'result_publication', entityId: publicationId });
    });
  }

  /* ---------------- Reading ---------------- */

  private async views(tx: Tx, publicationId: string, studentIds?: string[]): Promise<StudentResultView[]> {
    const rows = await tx
      .select({ sr: studentResults, name: accounts.displayName, adm: students.admissionNumber, sectionName: sections.name })
      .from(studentResults)
      .innerJoin(students, eq(students.id, studentResults.studentId))
      .innerJoin(accounts, eq(accounts.id, students.accountId))
      .leftJoin(sections, eq(sections.id, studentResults.sectionId))
      .where(and(eq(studentResults.publicationId, publicationId), studentIds ? inArray(studentResults.studentId, studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']) : undefined))
      .orderBy(asc(sections.code), asc(accounts.displayName));
    const subjectRows = rows.length
      ? await tx
          .select({ x: subjectResults, name: subjects.name, nameUr: subjects.nameUr, sort: courseOfferings.sortOrder })
          .from(subjectResults)
          .innerJoin(courseOfferings, eq(courseOfferings.id, subjectResults.courseOfferingId))
          .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
          .where(inArray(subjectResults.studentResultId, rows.map((r) => r.sr.id)))
          .orderBy(asc(courseOfferings.sortOrder), asc(subjects.name))
      : [];
    return rows.map(({ sr, name, adm, sectionName }) => ({
      id: sr.id,
      studentId: sr.studentId,
      displayName: name,
      admissionNumber: adm,
      sectionName,
      obtainedMarks: sr.obtainedMarks,
      totalMarks: sr.totalMarks,
      percentage: sr.percentage,
      gradeLabel: sr.gradeLabel,
      gpa: sr.gpa,
      outcome: sr.outcome,
      failedSubjects: sr.failedSubjects,
      remarks: sr.remarks,
      subjects: subjectRows
        .filter((s) => s.x.studentResultId === sr.id)
        .map((s) => ({
          courseOfferingId: s.x.courseOfferingId,
          subjectName: s.name,
          subjectNameUr: s.nameUr,
          obtainedMarks: s.x.obtainedMarks,
          maxMarks: s.x.maxMarks,
          percentage: s.x.percentage,
          gradeLabel: s.x.gradeLabel,
          gradePoints: s.x.gradePoints,
          outcome: s.x.outcome,
        })),
    }));
  }

  async get(actor: Actor, id: string): Promise<ResultPublication> {
    return this.run(actor, async (tx) => {
      const [row] = await tx
        .select({ p: resultPublications, cycleName: examCycles.name, gradeName: gradeLevels.name })
        .from(resultPublications)
        .innerJoin(examCycles, eq(examCycles.id, resultPublications.examCycleId))
        .innerJoin(classOfferings, eq(classOfferings.id, resultPublications.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(eq(resultPublications.id, id));
      const found = required(row, 'Results');
      let restrictTo: string[] | undefined;
      if (!isAdmin(actor)) {
        // Class teachers review their own sections' results.
        const own = actor.teacherId ? await classTeacherSectionIds(tx, actor.teacherId, today(actor)) : [];
        if (!own.length) throw errors.forbidden();
        restrictTo = (await tx.select({ id: studentResults.studentId }).from(studentResults).where(and(eq(studentResults.publicationId, id), inArray(studentResults.sectionId, own)))).map((r) => r.id);
        if (!restrictTo.length) throw errors.forbidden();
      }
      const results = await this.views(tx, id, restrictTo);
      return {
        id,
        examCycleId: found.p.examCycleId,
        examCycleName: found.cycleName,
        classOfferingId: found.p.classOfferingId,
        gradeName: found.gradeName,
        policyVersionId: found.p.policyVersionId,
        revision: found.p.revision,
        state: found.p.state,
        isFinal: found.p.isFinal,
        correctionReason: found.p.correctionReason,
        publishedAt: found.p.publishedAt?.toISOString() ?? null,
        counts: {
          pass: results.filter((r) => r.outcome === 'pass').length,
          fail: results.filter((r) => r.outcome === 'fail').length,
          incomplete: results.filter((r) => r.outcome === 'incomplete').length,
        },
        blockers: results.filter((r) => r.outcome === 'incomplete').map((r) => `${r.displayName}: missing or withheld marks`),
        results,
        version: found.p.version,
      };
    });
  }

  async list(actor: Actor, filter: { examCycleId?: string; classOfferingId?: string }) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ id: resultPublications.id })
        .from(resultPublications)
        .where(
          and(
            filter.examCycleId ? eq(resultPublications.examCycleId, filter.examCycleId) : undefined,
            filter.classOfferingId ? eq(resultPublications.classOfferingId, filter.classOfferingId) : undefined,
          ),
        )
        .orderBy(desc(resultPublications.createdAt))
        .limit(100);
      return rows.map((r) => r.id);
    }).then((ids) => Promise.all(ids.map((id) => this.get(actor, id))));
  }

  /** Published results for one student (own, or for staff who may view the student). */
  async forStudent(actor: Actor, studentId?: string) {
    const target = studentId ?? actor.studentId;
    if (!target) throw errors.forbidden();
    return this.run(actor, async (tx) => {
      await assertCanViewStudent(tx, actor, target);
      const pubs = await tx
        .select({ p: resultPublications, cycle: examCycles, yearCode: academicYears.code })
        .from(resultPublications)
        .innerJoin(examCycles, eq(examCycles.id, resultPublications.examCycleId))
        .innerJoin(academicYears, eq(academicYears.id, resultPublications.academicYearId))
        .innerJoin(studentResults, and(eq(studentResults.publicationId, resultPublications.id), eq(studentResults.studentId, target)))
        .where(eq(resultPublications.state, 'published'))
        .orderBy(desc(resultPublications.publishedAt));
      const out = [];
      for (const { p, cycle, yearCode } of pubs) {
        const [view] = await this.views(tx, p.id, [target]);
        if (view) {
          out.push({
            publicationId: p.id,
            examCycleName: cycle.name,
            examCycleNameUr: cycle.nameUr,
            academicYearCode: yearCode,
            publishedAt: p.publishedAt!.toISOString(),
            revision: p.revision,
            result: view,
          });
        }
      }
      return out;
    });
  }

  async reportCard(actor: Actor, publicationId: string, studentId: string): Promise<ReportCard> {
    return this.run(actor, async (tx) => {
      await assertCanViewStudent(tx, actor, studentId);
      const [row] = await tx
        .select({ p: resultPublications, cycle: examCycles, year: academicYears, grade: gradeLevels.name, policy: gradingPolicyVersions })
        .from(resultPublications)
        .innerJoin(examCycles, eq(examCycles.id, resultPublications.examCycleId))
        .innerJoin(academicYears, eq(academicYears.id, resultPublications.academicYearId))
        .innerJoin(classOfferings, eq(classOfferings.id, resultPublications.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .innerJoin(gradingPolicyVersions, eq(gradingPolicyVersions.id, resultPublications.policyVersionId))
        .where(eq(resultPublications.id, publicationId));
      const found = required(row, 'Results');
      if (found.p.state !== 'published' && !isAdmin(actor)) throw errors.notFound('Results');
      const [view] = await this.views(tx, publicationId, [studentId]);
      const result = required(view, 'Result');
      const [school] = await tx.select().from(schools).where(eq(schools.id, actor.schoolId));
      const [st] = await tx.select({ s: students, a: accounts }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(eq(students.id, studentId));
      const [enrollment] = await tx.select().from(studentEnrollments).where(and(eq(studentEnrollments.studentId, studentId), eq(studentEnrollments.academicYearId, found.year.id)));
      const counts = await tx.execute<{ status: string; n: number }>(sql`
        select status::text, count(*)::int as n from app.student_attendance
        where student_id = ${studentId} and enrollment_id = ${enrollment?.id ?? '00000000-0000-0000-0000-000000000000'} group by status`);
      const c = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const r of counts) if (r.status in c) c[r.status as keyof typeof c] = r.n;
      return {
        school: { name: school!.name, nameUr: school!.nameUr, code: school!.code },
        student: { id: studentId, displayName: st!.a.displayName, displayNameUr: st!.a.displayNameUr, admissionNumber: st!.s.admissionNumber },
        academicYearCode: found.year.code,
        gradeName: found.grade,
        sectionName: result.sectionName,
        examCycleName: found.cycle.name,
        publishedAt: (found.p.publishedAt ?? found.p.createdAt).toISOString(),
        revision: found.p.revision,
        displayDecimals: found.policy.displayDecimals,
        result,
        attendance: { ...c, rate: attendanceRate(c) },
      };
    });
  }
}
