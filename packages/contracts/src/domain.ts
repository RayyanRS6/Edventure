/**
 * Domain value sets shared by the database schema, the backend and every frontend.
 * The PostgreSQL enum types are generated from these arrays, so changing a list here
 * requires a migration (append new values; never repurpose existing ones).
 */
import { z } from 'zod';

export const schoolStatuses = ['active', 'suspended', 'archived'] as const;
export const genders = ['female', 'male', 'other'] as const;

export const academicYearStatuses = ['planning', 'active', 'closed'] as const;
export const calendarDayKinds = ['instructional', 'holiday', 'closure', 'exam', 'event'] as const;
export const placementReasons = ['admission', 'transfer', 'promotion', 'repeat', 'correction'] as const;
export const subjectRequirements = ['compulsory', 'elective'] as const;
export const curriculumStates = ['draft', 'active', 'retired'] as const;
export const courseEnrollmentStatuses = ['active', 'dropped', 'completed'] as const;

export const timetableStatuses = ['draft', 'published', 'superseded'] as const;
export const periodKinds = ['lesson', 'break', 'assembly'] as const;
export const lessonExceptionKinds = ['cancelled', 'substitution', 'room_change'] as const;

export const attendanceStatuses = ['present', 'absent', 'late', 'excused'] as const;
export const attendanceSources = ['roll_call', 'leave', 'admin_correction'] as const;
export const rollCallStates = ['draft', 'submitted'] as const;

export const leaveAudiences = ['student', 'teacher', 'both'] as const;
export const leaveStates = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export const homeworkStates = ['draft', 'published', 'closed', 'archived'] as const;
export const submissionPolicies = ['none', 'optional', 'required'] as const;
export const homeworkCompletionStates = ['pending', 'submitted', 'completed', 'excused'] as const;

export const quizStates = ['draft', 'published', 'closed'] as const;
export const questionKinds = ['mcq', 'short'] as const;
export const attemptStates = ['in_progress', 'submitted', 'marked'] as const;

export const examKinds = ['test', 'midterm', 'final', 'other'] as const;
export const examCycleStates = ['draft', 'scheduled', 'marking', 'review', 'published', 'closed'] as const;
export const sittingStatuses = ['scheduled', 'rescheduled', 'cancelled'] as const;
export const markOutcomes = ['score', 'absent', 'exempt', 'withheld', 'missing'] as const;
export const policyStates = ['draft', 'active', 'retired'] as const;
export const absentRules = ['fail', 'zero', 'exclude'] as const;
export const publicationStates = ['draft', 'published', 'superseded'] as const;
export const resultOutcomes = ['pass', 'fail', 'incomplete'] as const;
export const subjectOutcomes = ['pass', 'fail', 'absent', 'exempt', 'incomplete'] as const;

export const promotionBatchStates = ['draft', 'reviewed', 'approved', 'executed', 'cancelled'] as const;
export const promotionRecommendations = ['promote', 'repeat', 'graduate', 'review'] as const;
export const promotionDecisionKinds = ['promote', 'repeat', 'graduate', 'withdraw', 'hold'] as const;

export const feeKinds = ['tuition', 'admission', 'exam', 'transport', 'fine', 'other'] as const;
export const feeFrequencies = ['monthly', 'termly', 'annual', 'once'] as const;
export const feePlanStates = ['draft', 'active', 'archived'] as const;
export const invoiceStatuses = ['open', 'void'] as const;
export const invoiceLineSources = ['plan', 'manual', 'fine'] as const;
export const paymentMethods = ['bank', 'cash', 'cheque', 'online'] as const;
export const paymentStatuses = ['posted', 'reversed'] as const;
export const adjustmentKinds = ['waiver', 'discount', 'credit', 'refund', 'write_off'] as const;
/** Derived from balances; never stored. */
export const feeStatuses = ['unpaid', 'partially_paid', 'paid'] as const;

export const importKinds = ['students', 'teachers', 'bank_statement'] as const;
export const importStates = [
  'uploaded',
  'validating',
  'validated',
  'invalid',
  'committing',
  'committed',
  'failed',
  'cancelled',
] as const;
export const importRowStatuses = [
  'valid',
  'invalid',
  'duplicate',
  'matched',
  'unmatched',
  'review',
  'committed',
  'skipped',
] as const;

export const filePurposes = [
  'homework_attachment',
  'submission',
  'material',
  'profile_image',
  'document',
  'announcement_attachment',
  'import',
  'export',
  'report',
] as const;
export const fileScanStates = ['pending', 'clean', 'infected', 'failed', 'skipped'] as const;
export const fileLifecycles = ['upload_pending', 'quarantine', 'available', 'rejected', 'deleted'] as const;

export const announcementCategories = ['general', 'holiday', 'emergency', 'exam', 'fee', 'event'] as const;
export const announcementStates = ['draft', 'published', 'archived'] as const;
export const audienceTargets = ['everyone', 'role', 'class_offering', 'section', 'teaching_group'] as const;
export const deliveryStatuses = ['pending', 'sent', 'delivered', 'failed', 'retired'] as const;

export const reportJobStates = ['queued', 'running', 'succeeded', 'failed', 'expired'] as const;
export const deletionStates = ['pending', 'restored', 'processed', 'cancelled'] as const;
export const deletionSubjects = ['student', 'teacher', 'admin'] as const;

export const attendanceStatus = z.enum(attendanceStatuses);
export type AttendanceStatus = z.infer<typeof attendanceStatus>;
export const markOutcome = z.enum(markOutcomes);
export type MarkOutcome = z.infer<typeof markOutcome>;
export const feeStatus = z.enum(feeStatuses);
export type FeeStatus = z.infer<typeof feeStatus>;
