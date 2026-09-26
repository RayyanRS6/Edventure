import { sql } from 'drizzle-orm';
import { check, index, jsonb, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  attendanceSources,
  attendanceStatuses,
  leaveAudiences,
  leaveStates,
  rollCallStates,
} from '@edventure/contracts';
import { app, day, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, schools } from './core';
import { students, teachers } from './people';
import { sections, studentEnrollments, studentPlacements } from './academics';

export const attendanceStatus = app.enum('attendance_status', attendanceStatuses);
export const attendanceSource = app.enum('attendance_source', attendanceSources);
export const rollCallState = app.enum('roll_call_state', rollCallStates);
export const leaveAudience = app.enum('leave_audience', leaveAudiences);
export const leaveState = app.enum('leave_state', leaveStates);

/** School-configurable reasons. Statuses stay fixed so reports keep their meaning. */
export const attendanceReasonCodes = app.table(
  'attendance_reason_codes',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    label: text('label').notNull(),
    labelUr: text('label_ur'),
    appliesTo: attendanceStatus('applies_to'),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('attendance_reason_codes', t, schools),
    uniqueIndex('attendance_reason_codes_uk').on(t.schoolId, t.code),
  ],
);

export const leaveTypes = app.table(
  'leave_types',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    audience: leaveAudience('audience').notNull().default('both'),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('leave_types', t, schools), uniqueIndex('leave_types_code_uk').on(t.schoolId, t.code)],
);

export const leaveRequests = app.table(
  'leave_requests',
  {
    ...tenantColumns(),
    requesterAccountId: uuid('requester_account_id').notNull(),
    studentId: uuid('student_id'),
    teacherId: uuid('teacher_id'),
    leaveTypeId: uuid('leave_type_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date').notNull(),
    reason: text('reason').notNull(),
    state: leaveState('state').notNull().default('pending'),
    decidedByAccountId: uuid('decided_by_account_id'),
    decidedAt: ts('decided_at'),
    decisionNote: text('decision_note'),
    cancelledAt: ts('cancelled_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('leave_requests', t, schools),
    tfk('leave_requests_requester_fk', t.schoolId, t.requesterAccountId, accounts),
    tfk('leave_requests_student_fk', t.schoolId, t.studentId, students),
    tfk('leave_requests_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('leave_requests_type_fk', t.schoolId, t.leaveTypeId, leaveTypes),
    tfk('leave_requests_decider_fk', t.schoolId, t.decidedByAccountId, accounts),
    index('leave_requests_state_idx').on(t.schoolId, t.state, t.startDate),
    check('leave_requests_subject', sql`num_nonnulls(${t.studentId}, ${t.teacherId}) = 1`),
    // Inclusive date range: a one-day leave has start_date = end_date.
    check('leave_requests_dates', sql`${t.endDate} >= ${t.startDate}`),
  ],
);

/** Daily roll call per section. A partially completed roll call remains a draft. */
export const attendanceRollCalls = app.table(
  'attendance_roll_calls',
  {
    ...tenantColumns(),
    sectionId: uuid('section_id').notNull(),
    date: day('date').notNull(),
    state: rollCallState('state').notNull().default('draft'),
    rosterRevision: text('roster_revision'),
    /** Server-side draft (partial roll call). Only submitted roll calls write attendance records. */
    draftEntries: jsonb('draft_entries').$type<Array<{ studentId: string; status: string; reasonCodeId?: string | null; note?: string | null }>>(),
    submittedByAccountId: uuid('submitted_by_account_id'),
    submittedAt: ts('submitted_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('attendance_roll_calls', t, schools),
    tfk('attendance_roll_calls_section_fk', t.schoolId, t.sectionId, sections),
    tfk('attendance_roll_calls_submitter_fk', t.schoolId, t.submittedByAccountId, accounts),
    uniqueIndex('attendance_roll_calls_uk').on(t.schoolId, t.sectionId, t.date),
  ],
);

/** One daily attendance record per student and date. Missing records mean "not recorded". */
export const studentAttendance = app.table(
  'student_attendance',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    enrollmentId: uuid('enrollment_id').notNull(),
    placementId: uuid('placement_id').notNull(),
    sectionId: uuid('section_id').notNull(),
    rollCallId: uuid('roll_call_id'),
    date: day('date').notNull(),
    status: attendanceStatus('status').notNull(),
    reasonCodeId: uuid('reason_code_id'),
    note: text('note'),
    source: attendanceSource('source').notNull().default('roll_call'),
    leaveRequestId: uuid('leave_request_id'),
    recordedByAccountId: uuid('recorded_by_account_id').notNull(),
    recordedAt: ts('recorded_at').notNull().defaultNow(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('student_attendance', t, schools),
    tfk('student_attendance_student_fk', t.schoolId, t.studentId, students),
    tfk('student_attendance_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_attendance_placement_fk', t.schoolId, t.placementId, studentPlacements),
    tfk('student_attendance_section_fk', t.schoolId, t.sectionId, sections),
    tfk('student_attendance_roll_call_fk', t.schoolId, t.rollCallId, attendanceRollCalls),
    tfk('student_attendance_reason_fk', t.schoolId, t.reasonCodeId, attendanceReasonCodes),
    tfk('student_attendance_leave_fk', t.schoolId, t.leaveRequestId, leaveRequests),
    tfk('student_attendance_recorder_fk', t.schoolId, t.recordedByAccountId, accounts),
    uniqueIndex('student_attendance_student_date_uk').on(t.schoolId, t.studentId, t.date),
    index('student_attendance_section_date_idx').on(t.schoolId, t.sectionId, t.date),
    index('student_attendance_enrollment_idx').on(t.schoolId, t.enrollmentId, t.date),
  ],
);

export const teacherAttendance = app.table(
  'teacher_attendance',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    date: day('date').notNull(),
    status: attendanceStatus('status').notNull(),
    reasonCodeId: uuid('reason_code_id'),
    note: text('note'),
    source: attendanceSource('source').notNull().default('admin_correction'),
    leaveRequestId: uuid('leave_request_id'),
    recordedByAccountId: uuid('recorded_by_account_id').notNull(),
    recordedAt: ts('recorded_at').notNull().defaultNow(),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('teacher_attendance', t, schools),
    tfk('teacher_attendance_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('teacher_attendance_reason_fk', t.schoolId, t.reasonCodeId, attendanceReasonCodes),
    tfk('teacher_attendance_leave_fk', t.schoolId, t.leaveRequestId, leaveRequests),
    tfk('teacher_attendance_recorder_fk', t.schoolId, t.recordedByAccountId, accounts),
    uniqueIndex('teacher_attendance_teacher_date_uk').on(t.schoolId, t.teacherId, t.date),
    index('teacher_attendance_date_idx').on(t.schoolId, t.date),
  ],
);

/** Every correction after submission is preserved with its reason. */
export const attendanceRevisions = app.table(
  'attendance_revisions',
  {
    ...tenantColumns(),
    studentAttendanceId: uuid('student_attendance_id'),
    teacherAttendanceId: uuid('teacher_attendance_id'),
    previousStatus: attendanceStatus('previous_status'),
    newStatus: attendanceStatus('new_status'),
    reason: text('reason').notNull(),
    changedByAccountId: uuid('changed_by_account_id').notNull(),
    changedAt: ts('changed_at').notNull().defaultNow(),
  },
  (t) => [
    ...tenantConstraints('attendance_revisions', t, schools),
    tfk('attendance_revisions_student_fk', t.schoolId, t.studentAttendanceId, studentAttendance),
    tfk('attendance_revisions_teacher_fk', t.schoolId, t.teacherAttendanceId, teacherAttendance),
    tfk('attendance_revisions_changer_fk', t.schoolId, t.changedByAccountId, accounts),
    check('attendance_revisions_subject', sql`num_nonnulls(${t.studentAttendanceId}, ${t.teacherAttendanceId}) = 1`),
  ],
);

/** Disciplinary suspension is independent of account access and enrollment. */
export const disciplinarySuspensions = app.table(
  'disciplinary_suspensions',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date').notNull(),
    reason: text('reason').notNull(),
    decidedByAccountId: uuid('decided_by_account_id').notNull(),
    revokedAt: ts('revoked_at'),
    revokedReason: text('revoked_reason'),
  },
  (t) => [
    ...tenantConstraints('disciplinary_suspensions', t, schools),
    tfk('disciplinary_suspensions_student_fk', t.schoolId, t.studentId, students),
    tfk('disciplinary_suspensions_decider_fk', t.schoolId, t.decidedByAccountId, accounts),
    check('disciplinary_suspensions_dates', sql`${t.endDate} >= ${t.startDate}`),
  ],
);
