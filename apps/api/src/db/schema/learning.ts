import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, text, time, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  attemptStates,
  homeworkCompletionStates,
  homeworkStates,
  questionKinds,
  quizStates,
  submissionPolicies,
} from '@edventure/contracts';
import { app, day, marks, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, files, schools } from './core';
import { students, teachers } from './people';
import { studentCourseEnrollments, teachingGroups } from './academics';

export const homeworkState = app.enum('homework_state', homeworkStates);
export const submissionPolicy = app.enum('submission_policy', submissionPolicies);
export const homeworkCompletionState = app.enum('homework_completion_state', homeworkCompletionStates);
export const quizState = app.enum('quiz_state', quizStates);
export const questionKind = app.enum('question_kind', questionKinds);
export const attemptState = app.enum('attempt_state', attemptStates);

export const homework = app.table(
  'homework',
  {
    ...tenantColumns(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    title: text('title').notNull(),
    titleUr: text('title_ur'),
    instructions: text('instructions'),
    instructionsUr: text('instructions_ur'),
    dueDate: day('due_date').notNull(),
    dueTime: time('due_time'),
    submissionPolicy: submissionPolicy('submission_policy').notNull().default('optional'),
    maxScore: marks('max_score'),
    state: homeworkState('state').notNull().default('draft'),
    publishedAt: ts('published_at'),
    createdByTeacherId: uuid('created_by_teacher_id'),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('homework', t, schools),
    tfk('homework_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    tfk('homework_teacher_fk', t.schoolId, t.createdByTeacherId, teachers),
    tfk('homework_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    index('homework_group_due_idx').on(t.schoolId, t.teachingGroupId, t.dueDate),
  ],
);

export const homeworkAttachments = app.table(
  'homework_attachments',
  {
    ...tenantColumns(),
    homeworkId: uuid('homework_id').notNull(),
    fileId: uuid('file_id').notNull(),
  },
  (t) => [
    ...tenantConstraints('homework_attachments', t, schools),
    tfk('homework_attachments_homework_fk', t.schoolId, t.homeworkId, homework, 'cascade'),
    tfk('homework_attachments_file_fk', t.schoolId, t.fileId, files),
    uniqueIndex('homework_attachments_uk').on(t.schoolId, t.homeworkId, t.fileId),
  ],
);

/** Audience snapshot taken at publication. Students joining later are added explicitly. */
export const homeworkRecipients = app.table(
  'homework_recipients',
  {
    ...tenantColumns(),
    homeworkId: uuid('homework_id').notNull(),
    studentId: uuid('student_id').notNull(),
    studentCourseEnrollmentId: uuid('student_course_enrollment_id'),
    completionState: homeworkCompletionState('completion_state').notNull().default('pending'),
    completedAt: ts('completed_at'),
    addedReason: text('added_reason').notNull().default('publish'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('homework_recipients', t, schools),
    tfk('homework_recipients_homework_fk', t.schoolId, t.homeworkId, homework),
    tfk('homework_recipients_student_fk', t.schoolId, t.studentId, students),
    tfk('homework_recipients_sce_fk', t.schoolId, t.studentCourseEnrollmentId, studentCourseEnrollments),
    uniqueIndex('homework_recipients_uk').on(t.schoolId, t.homeworkId, t.studentId),
    index('homework_recipients_student_idx').on(t.schoolId, t.studentId, t.completionState),
  ],
);

/** Each resubmission is a new revision; earlier revisions are preserved. */
export const homeworkSubmissions = app.table(
  'homework_submissions',
  {
    ...tenantColumns(),
    recipientId: uuid('recipient_id').notNull(),
    revision: integer('revision').notNull(),
    body: text('body'),
    submittedAt: ts('submitted_at').notNull().defaultNow(),
    isLate: boolean('is_late').notNull().default(false),
    feedback: text('feedback'),
    score: marks('score'),
    feedbackByAccountId: uuid('feedback_by_account_id'),
    feedbackAt: ts('feedback_at'),
  },
  (t) => [
    ...tenantConstraints('homework_submissions', t, schools),
    tfk('homework_submissions_recipient_fk', t.schoolId, t.recipientId, homeworkRecipients),
    tfk('homework_submissions_feedback_by_fk', t.schoolId, t.feedbackByAccountId, accounts),
    uniqueIndex('homework_submissions_revision_uk').on(t.schoolId, t.recipientId, t.revision),
  ],
);

export const submissionAttachments = app.table(
  'submission_attachments',
  {
    ...tenantColumns(),
    submissionId: uuid('submission_id').notNull(),
    fileId: uuid('file_id').notNull(),
  },
  (t) => [
    ...tenantConstraints('submission_attachments', t, schools),
    tfk('submission_attachments_submission_fk', t.schoolId, t.submissionId, homeworkSubmissions, 'cascade'),
    tfk('submission_attachments_file_fk', t.schoolId, t.fileId, files),
    uniqueIndex('submission_attachments_uk').on(t.schoolId, t.submissionId, t.fileId),
  ],
);

/** Learning materials (e.g. PDFs) that teachers share with a teaching group. */
export const learningMaterials = app.table(
  'learning_materials',
  {
    ...tenantColumns(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    title: text('title').notNull(),
    titleUr: text('title_ur'),
    description: text('description'),
    fileId: uuid('file_id').notNull(),
    publishedAt: ts('published_at'),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('learning_materials', t, schools),
    tfk('learning_materials_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    tfk('learning_materials_file_fk', t.schoolId, t.fileId, files),
    tfk('learning_materials_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    index('learning_materials_group_idx').on(t.schoolId, t.teachingGroupId),
  ],
);

export const quizzes = app.table(
  'quizzes',
  {
    ...tenantColumns(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    title: text('title').notNull(),
    titleUr: text('title_ur'),
    instructions: text('instructions'),
    state: quizState('state').notNull().default('draft'),
    availableFrom: ts('available_from'),
    availableUntil: ts('available_until'),
    timeLimitMinutes: integer('time_limit_minutes'),
    maxAttempts: integer('max_attempts').notNull().default(1),
    /** Questions are versioned. Once an attempt starts on a version, that version is immutable. */
    contentVersion: integer('content_version').notNull().default(1),
    resultsReleasedAt: ts('results_released_at'),
    createdByAccountId: uuid('created_by_account_id').notNull(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('quizzes', t, schools),
    tfk('quizzes_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    tfk('quizzes_creator_fk', t.schoolId, t.createdByAccountId, accounts),
    check('quizzes_attempts', sql`${t.maxAttempts} >= 1`),
    check('quizzes_time_limit', sql`${t.timeLimitMinutes} is null or ${t.timeLimitMinutes} > 0`),
    check(
      'quizzes_window',
      sql`${t.availableFrom} is null or ${t.availableUntil} is null or ${t.availableUntil} > ${t.availableFrom}`,
    ),
  ],
);

export const quizQuestions = app.table(
  'quiz_questions',
  {
    ...tenantColumns(),
    quizId: uuid('quiz_id').notNull(),
    contentVersion: integer('content_version').notNull(),
    sequence: integer('sequence').notNull(),
    kind: questionKind('kind').notNull(),
    prompt: text('prompt').notNull(),
    promptUr: text('prompt_ur'),
    points: marks('points').notNull(),
    /** Optional model answer to guide manual marking of short answers. */
    guidance: text('guidance'),
  },
  (t) => [
    ...tenantConstraints('quiz_questions', t, schools),
    tfk('quiz_questions_quiz_fk', t.schoolId, t.quizId, quizzes),
    uniqueIndex('quiz_questions_sequence_uk').on(t.schoolId, t.quizId, t.contentVersion, t.sequence),
    check('quiz_questions_points', sql`${t.points} > 0`),
  ],
);

export const quizOptions = app.table(
  'quiz_options',
  {
    ...tenantColumns(),
    questionId: uuid('question_id').notNull(),
    sequence: integer('sequence').notNull(),
    text: text('text').notNull(),
    textUr: text('text_ur'),
    isCorrect: boolean('is_correct').notNull().default(false),
  },
  (t) => [
    ...tenantConstraints('quiz_options', t, schools),
    tfk('quiz_options_question_fk', t.schoolId, t.questionId, quizQuestions, 'cascade'),
    uniqueIndex('quiz_options_sequence_uk').on(t.schoolId, t.questionId, t.sequence),
  ],
);

export const quizAssignments = app.table(
  'quiz_assignments',
  {
    ...tenantColumns(),
    quizId: uuid('quiz_id').notNull(),
    studentId: uuid('student_id').notNull(),
    studentCourseEnrollmentId: uuid('student_course_enrollment_id'),
    extraAttempts: integer('extra_attempts').notNull().default(0),
  },
  (t) => [
    ...tenantConstraints('quiz_assignments', t, schools),
    tfk('quiz_assignments_quiz_fk', t.schoolId, t.quizId, quizzes),
    tfk('quiz_assignments_student_fk', t.schoolId, t.studentId, students),
    tfk('quiz_assignments_sce_fk', t.schoolId, t.studentCourseEnrollmentId, studentCourseEnrollments),
    uniqueIndex('quiz_assignments_uk').on(t.schoolId, t.quizId, t.studentId),
  ],
);

/** Server-authoritative timing: `deadline_at` is fixed when the attempt starts. */
export const quizAttempts = app.table(
  'quiz_attempts',
  {
    ...tenantColumns(),
    quizAssignmentId: uuid('quiz_assignment_id').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    contentVersion: integer('content_version').notNull(),
    startedAt: ts('started_at').notNull().defaultNow(),
    deadlineAt: ts('deadline_at'),
    submittedAt: ts('submitted_at'),
    autoSubmitted: boolean('auto_submitted').notNull().default(false),
    state: attemptState('state').notNull().default('in_progress'),
    score: marks('score'),
    maxScore: marks('max_score'),
  },
  (t) => [
    ...tenantConstraints('quiz_attempts', t, schools),
    tfk('quiz_attempts_assignment_fk', t.schoolId, t.quizAssignmentId, quizAssignments),
    uniqueIndex('quiz_attempts_number_uk').on(t.schoolId, t.quizAssignmentId, t.attemptNumber),
  ],
);

export const quizAnswers = app.table(
  'quiz_answers',
  {
    ...tenantColumns(),
    attemptId: uuid('attempt_id').notNull(),
    questionId: uuid('question_id').notNull(),
    selectedOptionId: uuid('selected_option_id'),
    textAnswer: text('text_answer'),
    savedAt: ts('saved_at').notNull().defaultNow(),
    autoScore: marks('auto_score'),
    manualScore: marks('manual_score'),
    markedByAccountId: uuid('marked_by_account_id'),
    markedAt: ts('marked_at'),
    feedback: text('feedback'),
  },
  (t) => [
    ...tenantConstraints('quiz_answers', t, schools),
    tfk('quiz_answers_attempt_fk', t.schoolId, t.attemptId, quizAttempts),
    tfk('quiz_answers_question_fk', t.schoolId, t.questionId, quizQuestions),
    tfk('quiz_answers_option_fk', t.schoolId, t.selectedOptionId, quizOptions),
    tfk('quiz_answers_marker_fk', t.schoolId, t.markedByAccountId, accounts),
    uniqueIndex('quiz_answers_uk').on(t.schoolId, t.attemptId, t.questionId),
  ],
);
