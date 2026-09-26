import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, text, time, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  absentRules,
  examCycleStates,
  examKinds,
  markOutcomes,
  policyStates,
  promotionBatchStates,
  promotionDecisionKinds,
  promotionRecommendations,
  publicationStates,
  resultOutcomes,
  sittingStatuses,
  subjectOutcomes,
} from '@edventure/contracts';
import { app, day, marks, pct, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, schools } from './core';
import { students } from './people';
import {
  academicYears,
  classOfferings,
  courseOfferings,
  rooms,
  sections,
  studentCourseEnrollments,
  studentEnrollments,
  terms,
} from './academics';

export const examKind = app.enum('exam_kind', examKinds);
export const examCycleState = app.enum('exam_cycle_state', examCycleStates);
export const sittingStatus = app.enum('sitting_status', sittingStatuses);
export const markOutcome = app.enum('mark_outcome', markOutcomes);
export const policyState = app.enum('policy_state', policyStates);
export const absentRule = app.enum('absent_rule', absentRules);
export const publicationState = app.enum('publication_state', publicationStates);
export const resultOutcome = app.enum('result_outcome', resultOutcomes);
export const subjectOutcome = app.enum('subject_outcome', subjectOutcomes);
export const promotionBatchState = app.enum('promotion_batch_state', promotionBatchStates);
export const promotionRecommendation = app.enum('promotion_recommendation', promotionRecommendations);
export const promotionDecisionKind = app.enum('promotion_decision_kind', promotionDecisionKinds);

export const examCycles = app.table(
  'exam_cycles',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    termId: uuid('term_id'),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    kind: examKind('kind').notNull(),
    /** Final cycles feed promotion recommendations. */
    isFinal: boolean('is_final').notNull().default(false),
    state: examCycleState('state').notNull().default('draft'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('exam_cycles', t, schools),
    tfk('exam_cycles_year_fk', t.schoolId, t.academicYearId, academicYears),
    tfk('exam_cycles_term_fk', t.schoolId, t.termId, terms),
    index('exam_cycles_year_idx').on(t.schoolId, t.academicYearId),
  ],
);

export const examPapers = app.table(
  'exam_papers',
  {
    ...tenantColumns(),
    examCycleId: uuid('exam_cycle_id').notNull(),
    courseOfferingId: uuid('course_offering_id').notNull(),
    maxMarks: marks('max_marks').notNull(),
    passMarks: marks('pass_marks').notNull(),
    locked: boolean('locked').notNull().default(false),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('exam_papers', t, schools),
    tfk('exam_papers_cycle_fk', t.schoolId, t.examCycleId, examCycles),
    tfk('exam_papers_course_fk', t.schoolId, t.courseOfferingId, courseOfferings),
    uniqueIndex('exam_papers_uk').on(t.schoolId, t.examCycleId, t.courseOfferingId),
    check('exam_papers_marks', sql`${t.maxMarks} > 0 and ${t.passMarks} >= 0 and ${t.passMarks} <= ${t.maxMarks}`),
  ],
);

/** Schedule history is preserved: a reschedule marks the old row and inserts a new one. */
export const examSittings = app.table(
  'exam_sittings',
  {
    ...tenantColumns(),
    examPaperId: uuid('exam_paper_id').notNull(),
    sectionId: uuid('section_id'),
    date: day('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    roomId: uuid('room_id'),
    status: sittingStatus('status').notNull().default('scheduled'),
    replacedBySittingId: uuid('replaced_by_sitting_id'),
    note: text('note'),
  },
  (t) => [
    ...tenantConstraints('exam_sittings', t, schools),
    tfk('exam_sittings_paper_fk', t.schoolId, t.examPaperId, examPapers),
    tfk('exam_sittings_section_fk', t.schoolId, t.sectionId, sections),
    tfk('exam_sittings_room_fk', t.schoolId, t.roomId, rooms),
    tfk('exam_sittings_replaced_by_fk', t.schoolId, t.replacedBySittingId, { schoolId: t.schoolId, id: t.id }),
    index('exam_sittings_date_idx').on(t.schoolId, t.date),
    check('exam_sittings_times', sql`${t.endTime} > ${t.startTime}`),
  ],
);

export const examRegistrations = app.table(
  'exam_registrations',
  {
    ...tenantColumns(),
    examPaperId: uuid('exam_paper_id').notNull(),
    studentId: uuid('student_id').notNull(),
    enrollmentId: uuid('enrollment_id').notNull(),
    studentCourseEnrollmentId: uuid('student_course_enrollment_id').notNull(),
    sectionId: uuid('section_id'),
  },
  (t) => [
    ...tenantConstraints('exam_registrations', t, schools),
    tfk('exam_registrations_paper_fk', t.schoolId, t.examPaperId, examPapers),
    tfk('exam_registrations_student_fk', t.schoolId, t.studentId, students),
    tfk('exam_registrations_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('exam_registrations_sce_fk', t.schoolId, t.studentCourseEnrollmentId, studentCourseEnrollments),
    tfk('exam_registrations_section_fk', t.schoolId, t.sectionId, sections),
    uniqueIndex('exam_registrations_uk').on(t.schoolId, t.examPaperId, t.studentId),
  ],
);

/**
 * One mark per registration. A numeric score is only valid with outcome `score`.
 * The score ≤ paper maximum rule is enforced by a trigger (see custom migration).
 */
export const marksTable = app.table(
  'marks',
  {
    ...tenantColumns(),
    examRegistrationId: uuid('exam_registration_id').notNull(),
    outcome: markOutcome('outcome').notNull(),
    score: marks('score'),
    note: text('note'),
    recordedByAccountId: uuid('recorded_by_account_id').notNull(),
    recordedAt: ts('recorded_at').notNull().defaultNow(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('marks', t, schools),
    tfk('marks_registration_fk', t.schoolId, t.examRegistrationId, examRegistrations),
    tfk('marks_recorder_fk', t.schoolId, t.recordedByAccountId, accounts),
    uniqueIndex('marks_registration_uk').on(t.schoolId, t.examRegistrationId),
    check(
      'marks_score_outcome',
      sql`(${t.outcome} = 'score' and ${t.score} is not null and ${t.score} >= 0) or (${t.outcome} <> 'score' and ${t.score} is null)`,
    ),
  ],
);

export const markRevisions = app.table(
  'mark_revisions',
  {
    ...tenantColumns(),
    markId: uuid('mark_id').notNull(),
    previousOutcome: markOutcome('previous_outcome'),
    previousScore: marks('previous_score'),
    newOutcome: markOutcome('new_outcome').notNull(),
    newScore: marks('new_score'),
    reason: text('reason'),
    changedByAccountId: uuid('changed_by_account_id').notNull(),
    changedAt: ts('changed_at').notNull().defaultNow(),
  },
  (t) => [
    ...tenantConstraints('mark_revisions', t, schools),
    tfk('mark_revisions_mark_fk', t.schoolId, t.markId, marksTable),
    tfk('mark_revisions_changer_fk', t.schoolId, t.changedByAccountId, accounts),
  ],
);

export type PassRequirement = {
  /** Minimum overall percentage (exact decimal string). */
  minOverallPercentage: string;
  /** Every compulsory subject must be passed. */
  requireAllCompulsoryPass: boolean;
  /** Maximum number of failed subjects allowed while still passing overall (null = no limit). */
  maxFailedSubjects: number | null;
};

/** Grading policies are versioned. Existing publications keep the version they were calculated with. */
export const gradingPolicyVersions = app.table(
  'grading_policy_versions',
  {
    ...tenantColumns(),
    name: text('name').notNull(),
    versionNumber: integer('version_number').notNull(),
    state: policyState('state').notNull().default('draft'),
    passRequirement: jsonb('pass_requirement').$type<PassRequirement>().notNull(),
    absentRule: absentRule('absent_rule').notNull().default('fail'),
    displayDecimals: integer('display_decimals').notNull().default(2),
    gpaEnabled: boolean('gpa_enabled').notNull().default(false),
    activatedAt: ts('activated_at'),
    createdByAccountId: uuid('created_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('grading_policy_versions', t, schools),
    uniqueIndex('grading_policy_versions_uk').on(t.schoolId, t.versionNumber),
    uniqueIndex('grading_policy_versions_one_active_uk')
      .on(t.schoolId)
      .where(sql`${t.state} = 'active'`),
  ],
);

/** `[min_percentage, max_percentage)`; the top band includes 100. Overlaps are excluded in SQL. */
export const gradeBands = app.table(
  'grade_bands',
  {
    ...tenantColumns(),
    policyVersionId: uuid('policy_version_id').notNull(),
    label: text('label').notNull(),
    minPercentage: pct('min_percentage').notNull(),
    maxPercentage: pct('max_percentage').notNull(),
    gradePoints: numeric('grade_points', { precision: 4, scale: 2 }),
    isPassing: boolean('is_passing').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    ...tenantConstraints('grade_bands', t, schools),
    tfk('grade_bands_policy_fk', t.schoolId, t.policyVersionId, gradingPolicyVersions, 'cascade'),
    uniqueIndex('grade_bands_label_uk').on(t.schoolId, t.policyVersionId, t.label),
    check(
      'grade_bands_range',
      sql`${t.minPercentage} >= 0 and ${t.maxPercentage} <= 100 and ${t.maxPercentage} > ${t.minPercentage}`,
    ),
  ],
);

/** Default weight of each exam kind when combining cycles into a final result. */
export const assessmentWeights = app.table(
  'assessment_weights',
  {
    ...tenantColumns(),
    policyVersionId: uuid('policy_version_id').notNull(),
    examKind: examKind('exam_kind').notNull(),
    weight: pct('weight').notNull(),
  },
  (t) => [
    ...tenantConstraints('assessment_weights', t, schools),
    tfk('assessment_weights_policy_fk', t.schoolId, t.policyVersionId, gradingPolicyVersions, 'cascade'),
    uniqueIndex('assessment_weights_uk').on(t.schoolId, t.policyVersionId, t.examKind),
  ],
);

export type ResultInputSnapshot = {
  cycles: Array<{ examCycleId: string; weight: string }>;
  calculatedAt: string;
  fingerprint: string;
};

/** Immutable once published. Corrections create a new revision that supersedes the previous one. */
export const resultPublications = app.table(
  'result_publications',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    examCycleId: uuid('exam_cycle_id').notNull(),
    classOfferingId: uuid('class_offering_id').notNull(),
    policyVersionId: uuid('policy_version_id').notNull(),
    revision: integer('revision').notNull().default(1),
    state: publicationState('state').notNull().default('draft'),
    isFinal: boolean('is_final').notNull().default(false),
    inputSnapshot: jsonb('input_snapshot').$type<ResultInputSnapshot>(),
    correctionReason: text('correction_reason'),
    supersedesId: uuid('supersedes_id'),
    publishedAt: ts('published_at'),
    publishedByAccountId: uuid('published_by_account_id'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('result_publications', t, schools),
    tfk('result_publications_year_fk', t.schoolId, t.academicYearId, academicYears),
    tfk('result_publications_cycle_fk', t.schoolId, t.examCycleId, examCycles),
    tfk('result_publications_class_fk', t.schoolId, t.classOfferingId, classOfferings),
    tfk('result_publications_policy_fk', t.schoolId, t.policyVersionId, gradingPolicyVersions),
    tfk('result_publications_supersedes_fk', t.schoolId, t.supersedesId, { schoolId: t.schoolId, id: t.id }),
    tfk('result_publications_publisher_fk', t.schoolId, t.publishedByAccountId, accounts),
    uniqueIndex('result_publications_revision_uk').on(t.schoolId, t.examCycleId, t.classOfferingId, t.revision),
    uniqueIndex('result_publications_one_published_uk')
      .on(t.schoolId, t.examCycleId, t.classOfferingId)
      .where(sql`${t.state} = 'published'`),
  ],
);

export const studentResults = app.table(
  'student_results',
  {
    ...tenantColumns(),
    publicationId: uuid('publication_id').notNull(),
    enrollmentId: uuid('enrollment_id').notNull(),
    studentId: uuid('student_id').notNull(),
    sectionId: uuid('section_id'),
    obtainedMarks: marks('obtained_marks'),
    totalMarks: marks('total_marks'),
    percentage: numeric('percentage', { precision: 9, scale: 4 }),
    gradeLabel: text('grade_label'),
    gpa: numeric('gpa', { precision: 5, scale: 3 }),
    outcome: resultOutcome('outcome').notNull(),
    failedSubjects: integer('failed_subjects').notNull().default(0),
    remarks: text('remarks'),
  },
  (t) => [
    ...tenantConstraints('student_results', t, schools),
    tfk('student_results_publication_fk', t.schoolId, t.publicationId, resultPublications),
    tfk('student_results_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_results_student_fk', t.schoolId, t.studentId, students),
    tfk('student_results_section_fk', t.schoolId, t.sectionId, sections),
    uniqueIndex('student_results_uk').on(t.schoolId, t.publicationId, t.enrollmentId),
    index('student_results_student_idx').on(t.schoolId, t.studentId),
  ],
);

export const subjectResults = app.table(
  'subject_results',
  {
    ...tenantColumns(),
    studentResultId: uuid('student_result_id').notNull(),
    courseOfferingId: uuid('course_offering_id').notNull(),
    obtainedMarks: marks('obtained_marks'),
    maxMarks: marks('max_marks').notNull(),
    percentage: numeric('percentage', { precision: 9, scale: 4 }),
    gradeLabel: text('grade_label'),
    gradePoints: numeric('grade_points', { precision: 4, scale: 2 }),
    outcome: subjectOutcome('outcome').notNull(),
  },
  (t) => [
    ...tenantConstraints('subject_results', t, schools),
    tfk('subject_results_student_result_fk', t.schoolId, t.studentResultId, studentResults, 'cascade'),
    tfk('subject_results_course_fk', t.schoolId, t.courseOfferingId, courseOfferings),
    uniqueIndex('subject_results_uk').on(t.schoolId, t.studentResultId, t.courseOfferingId),
  ],
);

export const promotionBatches = app.table(
  'promotion_batches',
  {
    ...tenantColumns(),
    sourceAcademicYearId: uuid('source_academic_year_id').notNull(),
    targetAcademicYearId: uuid('target_academic_year_id').notNull(),
    sourceClassOfferingId: uuid('source_class_offering_id').notNull(),
    resultPublicationId: uuid('result_publication_id').notNull(),
    /** Fingerprint of the published results reviewed; execution fails if they changed since. */
    resultsFingerprint: text('results_fingerprint').notNull(),
    state: promotionBatchState('state').notNull().default('draft'),
    approvedByAccountId: uuid('approved_by_account_id'),
    approvedAt: ts('approved_at'),
    executedAt: ts('executed_at'),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('promotion_batches', t, schools),
    tfk('promotion_batches_source_year_fk', t.schoolId, t.sourceAcademicYearId, academicYears),
    tfk('promotion_batches_target_year_fk', t.schoolId, t.targetAcademicYearId, academicYears),
    tfk('promotion_batches_class_fk', t.schoolId, t.sourceClassOfferingId, classOfferings),
    tfk('promotion_batches_publication_fk', t.schoolId, t.resultPublicationId, resultPublications),
    tfk('promotion_batches_approver_fk', t.schoolId, t.approvedByAccountId, accounts),
    check('promotion_batches_years', sql`${t.sourceAcademicYearId} <> ${t.targetAcademicYearId}`),
  ],
);

export const promotionDecisions = app.table(
  'promotion_decisions',
  {
    ...tenantColumns(),
    batchId: uuid('batch_id').notNull(),
    sourceEnrollmentId: uuid('source_enrollment_id').notNull(),
    studentId: uuid('student_id').notNull(),
    studentResultId: uuid('student_result_id'),
    recommendation: promotionRecommendation('recommendation').notNull(),
    decision: promotionDecisionKind('decision'),
    overrideReason: text('override_reason'),
    destinationClassOfferingId: uuid('destination_class_offering_id'),
    destinationSectionId: uuid('destination_section_id'),
    destinationEnrollmentId: uuid('destination_enrollment_id'),
    executedAt: ts('executed_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('promotion_decisions', t, schools),
    tfk('promotion_decisions_batch_fk', t.schoolId, t.batchId, promotionBatches),
    tfk('promotion_decisions_source_enrollment_fk', t.schoolId, t.sourceEnrollmentId, studentEnrollments),
    tfk('promotion_decisions_student_fk', t.schoolId, t.studentId, students),
    tfk('promotion_decisions_result_fk', t.schoolId, t.studentResultId, studentResults),
    tfk('promotion_decisions_dest_class_fk', t.schoolId, t.destinationClassOfferingId, classOfferings),
    tfk('promotion_decisions_dest_section_fk', t.schoolId, t.destinationSectionId, sections),
    tfk('promotion_decisions_dest_enrollment_fk', t.schoolId, t.destinationEnrollmentId, studentEnrollments),
    uniqueIndex('promotion_decisions_uk').on(t.schoolId, t.batchId, t.sourceEnrollmentId),
    uniqueIndex('promotion_decisions_destination_uk').on(t.destinationEnrollmentId),
    check(
      'promotion_decisions_override_reason',
      sql`${t.decision} is null or ${t.decision}::text = ${t.recommendation}::text or ${t.overrideReason} is not null`,
    ),
  ],
);
