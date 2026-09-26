import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, optionalUrdu, page, pageQuery, score, timeOfDay, versioned } from './common';
import { attemptStates, homeworkCompletionStates, homeworkStates, questionKinds, quizStates, submissionPolicies } from './domain';
import { fileRef } from './communications';

/* ---------------- Homework ---------------- */

export const homeworkSummary = z.object({
  id,
  teachingGroupId: id,
  groupName: z.string(),
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  title: z.string(),
  titleUr: z.string().nullable(),
  dueDate: isoDate,
  dueTime: timeOfDay.nullable(),
  submissionPolicy: z.enum(submissionPolicies),
  maxScore: score.nullable(),
  state: z.enum(homeworkStates),
  publishedAt: isoDateTime.nullable(),
  createdBy: z.string(),
  /** Teacher/admin view: completion counts. */
  completion: z.object({ total: z.number().int(), submitted: z.number().int(), completed: z.number().int(), late: z.number().int() }).nullable(),
  /** Student view: own status. */
  myStatus: z.enum(homeworkCompletionStates).nullable(),
  myLate: z.boolean().nullable(),
  version: z.number().int(),
});
export type HomeworkSummary = z.infer<typeof homeworkSummary>;

export const homeworkDetail = homeworkSummary.extend({
  instructions: z.string().nullable(),
  instructionsUr: z.string().nullable(),
  attachments: z.array(fileRef),
  mySubmissions: z
    .array(
      z.object({
        id,
        revision: z.number().int(),
        body: z.string().nullable(),
        submittedAt: isoDateTime,
        isLate: z.boolean(),
        attachments: z.array(fileRef),
        feedback: z.string().nullable(),
        score: score.nullable(),
      }),
    )
    .nullable(),
});
export type HomeworkDetail = z.infer<typeof homeworkDetail>;

export const createHomeworkRequest = z.object({
  teachingGroupId: id,
  title: nonEmpty(150),
  titleUr: optionalUrdu,
  instructions: z.string().trim().max(5000).nullish(),
  instructionsUr: z.string().trim().max(5000).nullish(),
  dueDate: isoDate,
  dueTime: timeOfDay.nullish(),
  submissionPolicy: z.enum(submissionPolicies).default('optional'),
  maxScore: score.nullish(),
  attachmentFileIds: z.array(id).max(5).default([]),
  publish: z.boolean().default(true),
});
export const updateHomeworkRequest = versioned.extend({
  title: nonEmpty(150).optional(),
  titleUr: optionalUrdu,
  instructions: z.string().trim().max(5000).nullish(),
  instructionsUr: z.string().trim().max(5000).nullish(),
  dueDate: isoDate.optional(),
  dueTime: timeOfDay.nullish(),
  attachmentFileIds: z.array(id).max(5).optional(),
});
export const homeworkListQuery = pageQuery.extend({
  teachingGroupId: id.optional(),
  sectionId: id.optional(),
  state: z.enum(homeworkStates).optional(),
  dueFrom: isoDate.optional(),
  dueTo: isoDate.optional(),
  status: z.enum(homeworkCompletionStates).optional(),
});
export const homeworkPage = page(homeworkSummary);

export const recipientStatus = z.object({
  recipientId: id,
  studentId: id,
  displayName: z.string(),
  admissionNumber: z.string(),
  completionState: z.enum(homeworkCompletionStates),
  latestSubmission: z
    .object({ id, revision: z.number().int(), submittedAt: isoDateTime, isLate: z.boolean(), feedback: z.string().nullable(), score: score.nullable(), attachments: z.array(fileRef), body: z.string().nullable() })
    .nullable(),
  version: z.number().int(),
});

export const submitHomeworkRequest = z.object({
  body: z.string().trim().max(10000).nullish(),
  attachmentFileIds: z.array(id).max(5).default([]),
});
export const markCompleteRequest = z.object({ studentIds: z.array(id).min(1).max(200), state: z.enum(['completed', 'pending', 'excused']) });
export const feedbackRequest = z.object({ feedback: z.string().trim().max(5000).nullish(), score: score.nullish(), markCompleted: z.boolean().default(true) });

/** Section-level completion for class teachers. */
export const sectionHomeworkSummary = z.object({
  sectionId: id,
  from: isoDate,
  to: isoDate,
  items: z.array(z.object({ homeworkId: id, title: z.string(), subjectName: z.string(), dueDate: isoDate, total: z.number().int(), done: z.number().int() })),
});

/* ---------------- Materials ---------------- */

export const learningMaterial = z.object({
  id,
  teachingGroupId: id,
  groupName: z.string(),
  subjectName: z.string(),
  title: z.string(),
  titleUr: z.string().nullable(),
  description: z.string().nullable(),
  file: fileRef,
  publishedAt: isoDateTime.nullable(),
  createdBy: z.string(),
});
export const createMaterialRequest = z.object({
  teachingGroupId: id,
  title: nonEmpty(150),
  titleUr: optionalUrdu,
  description: z.string().trim().max(2000).nullish(),
  fileId: id,
});

/* ---------------- Quizzes ---------------- */

export const quizOptionInput = z.object({ text: nonEmpty(500), textUr: optionalUrdu, isCorrect: z.boolean().default(false) });
export const quizQuestionInput = z
  .object({
    kind: z.enum(questionKinds),
    prompt: nonEmpty(2000),
    promptUr: optionalUrdu,
    points: score,
    guidance: z.string().trim().max(2000).nullish(),
    options: z.array(quizOptionInput).max(8).default([]),
  })
  .refine((q) => q.kind !== 'mcq' || (q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1), {
    message: 'Multiple-choice questions need at least two options and exactly one correct answer',
    path: ['options'],
  });

export const createQuizRequest = z.object({
  teachingGroupId: id,
  title: nonEmpty(150),
  titleUr: optionalUrdu,
  instructions: z.string().trim().max(3000).nullish(),
  availableFrom: isoDateTime.nullish(),
  availableUntil: isoDateTime.nullish(),
  timeLimitMinutes: z.number().int().min(1).max(300).nullish(),
  maxAttempts: z.number().int().min(1).max(5).default(1),
  questions: z.array(quizQuestionInput).min(1).max(100),
});
export const updateQuizRequest = versioned.extend({
  title: nonEmpty(150).optional(),
  titleUr: optionalUrdu,
  instructions: z.string().trim().max(3000).nullish(),
  availableFrom: isoDateTime.nullish(),
  availableUntil: isoDateTime.nullish(),
  timeLimitMinutes: z.number().int().min(1).max(300).nullish(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
  /** Replacing questions after attempts began creates a new immutable content version. */
  questions: z.array(quizQuestionInput).min(1).max(100).optional(),
});

export const quizQuestionView = z.object({
  id,
  sequence: z.number().int(),
  kind: z.enum(questionKinds),
  prompt: z.string(),
  promptUr: z.string().nullable(),
  points: score,
  options: z.array(z.object({ id, text: z.string(), textUr: z.string().nullable(), isCorrect: z.boolean().optional() })),
  guidance: z.string().nullable().optional(),
});

export const quizSummary = z.object({
  id,
  teachingGroupId: id,
  groupName: z.string(),
  subjectName: z.string(),
  title: z.string(),
  titleUr: z.string().nullable(),
  state: z.enum(quizStates),
  availableFrom: isoDateTime.nullable(),
  availableUntil: isoDateTime.nullable(),
  timeLimitMinutes: z.number().int().nullable(),
  maxAttempts: z.number().int(),
  questionCount: z.number().int(),
  totalPoints: score,
  resultsReleased: z.boolean(),
  /** Teacher view. */
  attemptsSubmitted: z.number().int().nullable(),
  toMark: z.number().int().nullable(),
  /** Student view. */
  myAttempt: z.object({ id, state: z.enum(attemptStates), score: score.nullable(), deadlineAt: isoDateTime.nullable() }).nullable(),
  attemptsRemaining: z.number().int().nullable(),
  version: z.number().int(),
});
export type QuizSummary = z.infer<typeof quizSummary>;

export const quizDetail = quizSummary.extend({
  instructions: z.string().nullable(),
  questions: z.array(quizQuestionView),
});

export const quizAttempt = z.object({
  id,
  quizId: id,
  attemptNumber: z.number().int(),
  state: z.enum(attemptStates),
  startedAt: isoDateTime,
  deadlineAt: isoDateTime.nullable(),
  submittedAt: isoDateTime.nullable(),
  serverTime: isoDateTime,
  score: score.nullable(),
  maxScore: score.nullable(),
  resultsReleased: z.boolean(),
  questions: z.array(quizQuestionView),
  answers: z.array(
    z.object({
      questionId: id,
      selectedOptionId: id.nullable(),
      textAnswer: z.string().nullable(),
      score: score.nullable(),
      feedback: z.string().nullable(),
    }),
  ),
});
export type QuizAttempt = z.infer<typeof quizAttempt>;

export const saveAnswerRequest = z.object({
  questionId: id,
  selectedOptionId: id.nullish(),
  textAnswer: z.string().max(5000).nullish(),
});
export const markAnswerRequest = z.object({ score, feedback: z.string().trim().max(2000).nullish() });
export const quizListQuery = pageQuery.extend({ teachingGroupId: id.optional(), state: z.enum(quizStates).optional() });
export const quizPage = page(quizSummary);
export const quizAttemptRow = z.object({
  id,
  studentId: id,
  displayName: z.string(),
  attemptNumber: z.number().int(),
  state: z.enum(attemptStates),
  submittedAt: isoDateTime.nullable(),
  score: score.nullable(),
  maxScore: score.nullable(),
  needsMarking: z.boolean(),
});
