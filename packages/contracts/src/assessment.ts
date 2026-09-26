import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, optionalUrdu, percentage, score, timeOfDay, versioned } from './common';
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
} from './domain';

/* ---------------- Exam cycles, papers, sittings ---------------- */

export const examCycle = z.object({
  id,
  academicYearId: id,
  termId: id.nullable(),
  name: z.string(),
  nameUr: z.string().nullable(),
  kind: z.enum(examKinds),
  isFinal: z.boolean(),
  state: z.enum(examCycleStates),
  paperCount: z.number().int(),
  version: z.number().int(),
});
export type ExamCycle = z.infer<typeof examCycle>;
export const createExamCycleRequest = z.object({
  academicYearId: id,
  termId: id.nullish(),
  name: nonEmpty(100),
  nameUr: optionalUrdu,
  kind: z.enum(examKinds),
  isFinal: z.boolean().default(false),
});
export const examCycleTransition = versioned.extend({ state: z.enum(['scheduled', 'marking', 'review', 'closed']) });

export const sitting = z.object({
  id,
  sectionId: id.nullable(),
  sectionName: z.string().nullable(),
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  roomId: id.nullable(),
  roomName: z.string().nullable(),
  status: z.enum(sittingStatuses),
  note: z.string().nullable(),
});

export const examPaper = z.object({
  id,
  examCycleId: id,
  courseOfferingId: id,
  classOfferingId: id,
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  gradeName: z.string(),
  maxMarks: score,
  passMarks: score,
  locked: z.boolean(),
  registrationCount: z.number().int(),
  markedCount: z.number().int(),
  sittings: z.array(sitting),
  version: z.number().int(),
});
export type ExamPaper = z.infer<typeof examPaper>;

export const createPapersRequest = z.object({
  classOfferingId: id,
  papers: z
    .array(z.object({ courseOfferingId: id, maxMarks: score, passMarks: score }))
    .min(1)
    .max(40),
});
export const updatePaperRequest = versioned.extend({ maxMarks: score.optional(), passMarks: score.optional(), locked: z.boolean().optional() });

export const scheduleSittingRequest = z
  .object({
    examPaperId: id,
    sectionId: id.nullish(),
    date: isoDate,
    startTime: timeOfDay,
    endTime: timeOfDay,
    roomId: id.nullish(),
    note: z.string().trim().max(200).nullish(),
  })
  .refine((s) => s.endTime > s.startTime, { path: ['endTime'], message: 'End time must be after start time' });
export const rescheduleSittingRequest = z
  .object({ date: isoDate, startTime: timeOfDay, endTime: timeOfDay, roomId: id.nullish(), note: z.string().trim().max(200).nullish() })
  .refine((s) => s.endTime > s.startTime, { path: ['endTime'], message: 'End time must be after start time' });

export const dateSheetRow = z.object({
  sittingId: id,
  examPaperId: id,
  date: isoDate,
  startTime: timeOfDay,
  endTime: timeOfDay,
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  gradeName: z.string(),
  sectionName: z.string().nullable(),
  roomName: z.string().nullable(),
  maxMarks: score,
  status: z.enum(sittingStatuses),
});
export const dateSheetQuery = z.object({ examCycleId: id.optional(), classOfferingId: id.optional(), sectionId: id.optional(), studentId: id.optional() });

/* ---------------- Marks ---------------- */

export const markRow = z.object({
  registrationId: id,
  studentId: id,
  displayName: z.string(),
  admissionNumber: z.string(),
  sectionName: z.string().nullable(),
  outcome: z.enum(markOutcomes).nullable(),
  score: score.nullable(),
  note: z.string().nullable(),
  version: z.number().int().nullable(),
});
export const markSheet = z.object({
  paper: examPaper,
  canEdit: z.boolean(),
  rows: z.array(markRow),
});
export const saveMarksRequest = z.object({
  entries: z
    .array(
      z
        .object({
          registrationId: id,
          outcome: z.enum(markOutcomes),
          score: score.nullish(),
          note: z.string().trim().max(200).nullish(),
          /** Current mark version (null for a new mark). */
          version: z.number().int().nullable(),
        })
        .refine((e) => (e.outcome === 'score') === (e.score !== null && e.score !== undefined), {
          message: 'Enter a score only when the outcome is "score"',
          path: ['score'],
        }),
    )
    .min(1)
    .max(500),
  reason: z.string().trim().min(3).max(300).nullish(),
});

/* ---------------- Grading policies ---------------- */

export const gradeBandInput = z.object({
  label: z.string().trim().min(1).max(10),
  minPercentage: percentage,
  maxPercentage: percentage,
  gradePoints: z.string().regex(/^\d(\.\d{1,2})?$/).nullish(),
  isPassing: z.boolean().default(true),
});
export const gradingPolicy = z.object({
  id,
  name: z.string(),
  versionNumber: z.number().int(),
  state: z.enum(policyStates),
  passRequirement: z.object({
    minOverallPercentage: percentage,
    requireAllCompulsoryPass: z.boolean(),
    maxFailedSubjects: z.number().int().nullable(),
  }),
  absentRule: z.enum(absentRules),
  displayDecimals: z.number().int(),
  gpaEnabled: z.boolean(),
  bands: z.array(gradeBandInput.extend({ gradePoints: z.string().nullable() })),
  weights: z.array(z.object({ examKind: z.enum(examKinds), weight: percentage })),
  problems: z.array(z.string()),
});
export type GradingPolicy = z.infer<typeof gradingPolicy>;
export const gradingPolicyRequest = z.object({
  name: nonEmpty(100),
  passRequirement: z.object({
    minOverallPercentage: percentage,
    requireAllCompulsoryPass: z.boolean().default(true),
    maxFailedSubjects: z.number().int().min(0).max(20).nullable().default(null),
  }),
  absentRule: z.enum(absentRules).default('fail'),
  displayDecimals: z.number().int().min(0).max(4).default(2),
  gpaEnabled: z.boolean().default(false),
  bands: z.array(gradeBandInput).min(1).max(20),
  weights: z.array(z.object({ examKind: z.enum(examKinds), weight: percentage })).max(4).default([]),
});

/* ---------------- Results ---------------- */

export const subjectResultView = z.object({
  courseOfferingId: id,
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  obtainedMarks: z.string().nullable(),
  maxMarks: z.string(),
  percentage: z.string().nullable(),
  gradeLabel: z.string().nullable(),
  gradePoints: z.string().nullable(),
  outcome: z.enum(subjectOutcomes),
});
export const studentResultView = z.object({
  id,
  studentId: id,
  displayName: z.string(),
  admissionNumber: z.string(),
  sectionName: z.string().nullable(),
  obtainedMarks: z.string().nullable(),
  totalMarks: z.string().nullable(),
  percentage: z.string().nullable(),
  gradeLabel: z.string().nullable(),
  gpa: z.string().nullable(),
  outcome: z.enum(resultOutcomes),
  failedSubjects: z.number().int(),
  remarks: z.string().nullable(),
  subjects: z.array(subjectResultView),
});
export type StudentResultView = z.infer<typeof studentResultView>;

export const resultPublication = z.object({
  id,
  examCycleId: id,
  examCycleName: z.string(),
  classOfferingId: id,
  gradeName: z.string(),
  policyVersionId: id,
  revision: z.number().int(),
  state: z.enum(publicationStates),
  isFinal: z.boolean(),
  correctionReason: z.string().nullable(),
  publishedAt: isoDateTime.nullable(),
  counts: z.object({ pass: z.number().int(), fail: z.number().int(), incomplete: z.number().int() }),
  blockers: z.array(z.string()),
  results: z.array(studentResultView),
  version: z.number().int(),
});
export type ResultPublication = z.infer<typeof resultPublication>;

export const calculateResultsRequest = z.object({
  examCycleId: id,
  classOfferingId: id,
  /** Combine several cycles (e.g. midterm 30 + final 70) into this result. Defaults to the cycle alone. */
  combine: z.array(z.object({ examCycleId: id, weight: percentage })).max(4).optional(),
});
export const publishResultsRequest = versioned;
export const reviseResultsRequest = z.object({ reason: z.string().trim().min(3).max(500) });
export const remarksRequest = z.object({ studentResultId: id, remarks: z.string().trim().max(500).nullable() });

export const myResult = z.object({
  publicationId: id,
  examCycleName: z.string(),
  examCycleNameUr: z.string().nullable(),
  academicYearCode: z.string(),
  publishedAt: isoDateTime,
  revision: z.number().int(),
  result: studentResultView,
});

export const reportCard = z.object({
  school: z.object({ name: z.string(), nameUr: z.string().nullable(), code: z.string() }),
  student: z.object({ id, displayName: z.string(), displayNameUr: z.string().nullable(), admissionNumber: z.string() }),
  academicYearCode: z.string(),
  gradeName: z.string(),
  sectionName: z.string().nullable(),
  examCycleName: z.string(),
  publishedAt: isoDateTime,
  revision: z.number().int(),
  displayDecimals: z.number().int(),
  result: studentResultView,
  attendance: z.object({ present: z.number().int(), absent: z.number().int(), late: z.number().int(), excused: z.number().int(), rate: z.string().nullable() }),
});
export type ReportCard = z.infer<typeof reportCard>;

/* ---------------- Promotion ---------------- */

export const promotionDecision = z.object({
  id,
  studentId: id,
  displayName: z.string(),
  admissionNumber: z.string(),
  sourceSectionName: z.string().nullable(),
  resultOutcome: z.enum(resultOutcomes).nullable(),
  percentage: z.string().nullable(),
  recommendation: z.enum(promotionRecommendations),
  decision: z.enum(promotionDecisionKinds).nullable(),
  overrideReason: z.string().nullable(),
  destinationClassOfferingId: id.nullable(),
  destinationSectionId: id.nullable(),
  destinationSectionName: z.string().nullable(),
  executedAt: isoDateTime.nullable(),
  version: z.number().int(),
});
export const promotionBatch = z.object({
  id,
  sourceAcademicYearId: id,
  targetAcademicYearId: id,
  sourceClassOfferingId: id,
  sourceGradeName: z.string(),
  resultPublicationId: id,
  state: z.enum(promotionBatchStates),
  approvedAt: isoDateTime.nullable(),
  executedAt: isoDateTime.nullable(),
  counts: z.record(z.string(), z.number().int()),
  destinations: z.object({
    promote: z.object({ classOfferingId: id, gradeName: z.string(), sections: z.array(z.object({ id, name: z.string() })) }).nullable(),
    repeat: z.object({ classOfferingId: id, gradeName: z.string(), sections: z.array(z.object({ id, name: z.string() })) }).nullable(),
  }),
  decisions: z.array(promotionDecision),
  version: z.number().int(),
});
export type PromotionBatch = z.infer<typeof promotionBatch>;
export const createPromotionBatchRequest = z.object({
  resultPublicationId: id,
  targetAcademicYearId: id,
});
export const updatePromotionDecisionRequest = versioned.extend({
  decision: z.enum(promotionDecisionKinds),
  destinationSectionId: id.nullish(),
  overrideReason: z.string().trim().min(3).max(500).nullish(),
});
export const promotionExecutionResult = z.object({
  batch: promotionBatch,
  created: z.number().int(),
  graduated: z.number().int(),
  skipped: z.number().int(),
});
