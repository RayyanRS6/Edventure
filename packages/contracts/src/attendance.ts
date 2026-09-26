import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, optionalUrdu, page, pageQuery, versioned } from './common';
import { attendanceStatuses, leaveAudiences, leaveStates } from './domain';

export const attendanceStatusEnum = z.enum(attendanceStatuses);

export const reasonCode = z.object({
  id,
  code: z.string(),
  label: z.string(),
  labelUr: z.string().nullable(),
  appliesTo: attendanceStatusEnum.nullable(),
});

export const rosterEntry = z.object({
  studentId: id,
  displayName: z.string(),
  displayNameUr: z.string().nullable(),
  admissionNumber: z.string(),
  status: attendanceStatusEnum.nullable(),
  reasonCodeId: id.nullable(),
  note: z.string().nullable(),
  /** Approved leave covers this date (proposed as excused). */
  onLeave: z.boolean(),
  suspended: z.boolean(),
  recordVersion: z.number().int().nullable(),
});
export type RosterEntry = z.infer<typeof rosterEntry>;

export const rollCall = z.object({
  sectionId: id,
  sectionName: z.string(),
  gradeName: z.string(),
  date: isoDate,
  instructional: z.boolean(),
  state: z.enum(['not_started', 'draft', 'submitted']),
  version: z.number().int().nullable(),
  /** Changes whenever the class list changes; stale drafts must be reviewed before submission. */
  rosterRevision: z.string(),
  submittedAt: isoDateTime.nullable(),
  submittedBy: z.string().nullable(),
  canEdit: z.boolean(),
  /** Editing now counts as a correction and requires a reason. */
  correctionRequiresReason: z.boolean(),
  entries: z.array(rosterEntry),
  reasonCodes: z.array(reasonCode),
});
export type RollCall = z.infer<typeof rollCall>;

export const rollCallEntryInput = z.object({
  studentId: id,
  status: attendanceStatusEnum,
  reasonCodeId: id.nullish(),
  note: z.string().trim().max(300).nullish(),
});
export const saveRollCallRequest = z.object({
  rosterRevision: z.string().min(8),
  /** Roll-call version from the last load (null when not started). */
  version: z.number().int().nullable(),
  entries: z.array(rollCallEntryInput).max(200),
  submit: z.boolean().default(false),
  correctionReason: z.string().trim().min(3).max(300).nullish(),
});
export type SaveRollCallRequest = z.input<typeof saveRollCallRequest>;

export const correctAttendanceRequest = z.object({
  studentId: id,
  date: isoDate,
  status: attendanceStatusEnum,
  reasonCodeId: id.nullish(),
  note: z.string().trim().max(300).nullish(),
  reason: z.string().trim().min(3).max(300),
});

export const rollCallTask = z.object({
  sectionId: id,
  sectionName: z.string(),
  gradeName: z.string(),
  date: isoDate,
  state: z.enum(['not_started', 'draft', 'submitted']),
  delegated: z.boolean(),
});

export const teacherAttendanceEntry = z.object({
  teacherId: id,
  displayName: z.string(),
  employeeNumber: z.string(),
  status: attendanceStatusEnum.nullable(),
  reasonCodeId: id.nullable(),
  note: z.string().nullable(),
  onLeave: z.boolean(),
  recordVersion: z.number().int().nullable(),
});
export const teacherAttendanceDay = z.object({ date: isoDate, instructional: z.boolean(), entries: z.array(teacherAttendanceEntry) });
export const saveTeacherAttendanceRequest = z.object({
  date: isoDate,
  entries: z
    .array(
      z.object({
        teacherId: id,
        status: attendanceStatusEnum,
        reasonCodeId: id.nullish(),
        note: z.string().trim().max(300).nullish(),
        recordVersion: z.number().int().nullish(),
      }),
    )
    .max(500),
  correctionReason: z.string().trim().min(3).max(300).nullish(),
});

/** Rate = (present + late) ÷ (present + late + absent). Excused days are excluded and shown separately. */
export const attendanceSummary = z.object({
  present: z.number().int(),
  absent: z.number().int(),
  late: z.number().int(),
  excused: z.number().int(),
  recordedDays: z.number().int(),
  expectedDays: z.number().int(),
  /** Decimal string percentage, or null for "No data". */
  rate: z.string().nullable(),
  /** Recording completeness percentage (recorded ÷ expected), or null. */
  completeness: z.string().nullable(),
});
export type AttendanceSummary = z.infer<typeof attendanceSummary>;

export const studentAttendanceReport = z.object({
  studentId: id,
  displayName: z.string(),
  from: isoDate,
  to: isoDate,
  summary: attendanceSummary,
  days: z.array(z.object({ date: isoDate, status: attendanceStatusEnum.nullable(), note: z.string().nullable() })),
});

export const sectionAttendanceReport = z.object({
  sectionId: id,
  sectionName: z.string(),
  from: isoDate,
  to: isoDate,
  overall: attendanceSummary,
  rollCallsSubmitted: z.number().int(),
  instructionalDays: z.number().int(),
  students: z.array(z.object({ studentId: id, displayName: z.string(), admissionNumber: z.string(), summary: attendanceSummary })),
});

export const dailyOverview = z.object({
  date: isoDate,
  instructional: z.boolean(),
  overall: attendanceSummary,
  sections: z.array(
    z.object({
      sectionId: id,
      sectionName: z.string(),
      gradeName: z.string(),
      state: z.enum(['not_started', 'draft', 'submitted']),
      present: z.number().int(),
      absent: z.number().int(),
      late: z.number().int(),
      excused: z.number().int(),
      rosterSize: z.number().int(),
    }),
  ),
  teachers: attendanceSummary,
});

export const attendanceRangeQuery = z.object({ from: isoDate, to: isoDate });

/* ---------------- Leave ---------------- */

export const leaveType = z.object({
  id,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  audience: z.enum(leaveAudiences),
  archived: z.boolean(),
});
export const createLeaveTypeRequest = z.object({
  code: z.string().trim().min(1).max(16).transform((v) => v.toUpperCase()),
  name: nonEmpty(60),
  nameUr: optionalUrdu,
  audience: z.enum(leaveAudiences).default('both'),
});

export const leaveRequest = z.object({
  id,
  requester: z.object({ accountId: id, displayName: z.string() }),
  subject: z.object({ kind: z.enum(['student', 'teacher']), id, displayName: z.string(), detail: z.string().nullable() }),
  leaveTypeId: id,
  leaveTypeName: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string(),
  state: z.enum(leaveStates),
  decidedBy: z.string().nullable(),
  decidedAt: isoDateTime.nullable(),
  decisionNote: z.string().nullable(),
  createdAt: isoDateTime,
  version: z.number().int(),
});
export type LeaveRequest = z.infer<typeof leaveRequest>;

export const createLeaveRequest = z
  .object({
    leaveTypeId: id,
    startDate: isoDate,
    /** Inclusive last day. */
    endDate: isoDate,
    reason: z.string().trim().min(3).max(1000),
    /** Administrators may file on behalf of a student or teacher. */
    studentId: id.nullish(),
    teacherId: id.nullish(),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'The last day cannot be before the first day' });

export const decideLeaveRequest = versioned.extend({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).nullish(),
});
export const leaveDecisionResult = z.object({
  request: leaveRequest,
  excusedDaysCreated: z.number().int(),
  /** Existing present/late/absent records the approval did not overwrite; review them. */
  conflicts: z.array(z.object({ date: isoDate, status: attendanceStatusEnum })),
});

export const leaveListQuery = pageQuery.extend({
  state: z.enum(leaveStates).optional(),
  audience: z.enum(['student', 'teacher']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  mine: z.enum(['true', 'false']).optional(),
});
export const leavePage = page(leaveRequest);
