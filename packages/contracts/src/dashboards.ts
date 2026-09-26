import { z } from 'zod';
import { id, isoDate, isoDateTime, money, page, pageQuery, timeOfDay } from './common';
import { attendanceSummary } from './attendance';
import { daySchedule } from './timetable';

export const actionItem = z.object({
  kind: z.enum([
    'roll_call_missing',
    'leave_pending',
    'provisioning_failed',
    'import_review',
    'results_draft',
    'unallocated_receipts',
    'exam_review',
    'homework_to_review',
    'quiz_to_mark',
    'marks_to_enter',
  ]),
  count: z.number().int(),
  /** Relative route in the app where the item is handled. */
  link: z.string(),
  priority: z.number().int(),
});
export type ActionItem = z.infer<typeof actionItem>;

export const upcomingExam = z.object({ date: isoDate, startTime: timeOfDay, subjectName: z.string(), gradeName: z.string(), sectionName: z.string().nullable(), examCycleName: z.string() });
export const announcementBrief = z.object({ id, title: z.string(), titleUr: z.string().nullable(), category: z.string(), publishedAt: isoDateTime.nullable() });

export const adminDashboard = z.object({
  date: isoDate,
  academicYear: z.object({ id, code: z.string(), name: z.string() }).nullable(),
  metrics: z.object({
    enrollment: z.object({ active: z.number().int(), teachers: z.number().int() }),
    attendanceToday: z.object({ rate: z.string().nullable(), completeness: z.string().nullable(), instructional: z.boolean() }),
    outstandingFees: z.object({ amount: money, overdue: money, studentsOverdue: z.number().int(), currency: z.string() }),
    pendingApprovals: z.object({ total: z.number().int(), leave: z.number().int() }),
  }),
  actions: z.array(actionItem),
  upcomingExams: z.array(upcomingExam),
  recentAnnouncements: z.array(announcementBrief),
});
export type AdminDashboard = z.infer<typeof adminDashboard>;

export const teacherDashboard = z.object({
  date: isoDate,
  today: daySchedule,
  rollCalls: z.array(z.object({ sectionId: id, sectionName: z.string(), gradeName: z.string(), state: z.enum(['not_started', 'draft', 'submitted']), delegated: z.boolean() })),
  tasks: z.array(actionItem),
  recentAnnouncements: z.array(announcementBrief),
});
export type TeacherDashboard = z.infer<typeof teacherDashboard>;

export const studentDashboard = z.object({
  date: isoDate,
  today: daySchedule,
  upcomingHomework: z.array(z.object({ id, title: z.string(), subjectName: z.string(), dueDate: isoDate, status: z.string() })),
  openQuizzes: z.array(z.object({ id, title: z.string(), subjectName: z.string(), availableUntil: isoDateTime.nullable(), attemptsRemaining: z.number().int().nullable() })),
  upcomingExams: z.array(upcomingExam),
  latestResult: z.object({ publicationId: id, examCycleName: z.string(), percentage: z.string().nullable(), gradeLabel: z.string().nullable(), outcome: z.string() }).nullable(),
  attendance: attendanceSummary.nullable(),
  fees: z.object({ balance: money, overdue: money, nextDueDate: isoDate.nullable(), currency: z.string() }),
  alerts: z.object({ unreadNotifications: z.number().int(), suspended: z.boolean() }),
});
export type StudentDashboard = z.infer<typeof studentDashboard>;

export const searchResults = z.object({
  students: z.array(z.object({ id, displayName: z.string(), admissionNumber: z.string(), detail: z.string().nullable() })),
  teachers: z.array(z.object({ id, displayName: z.string(), employeeNumber: z.string() })),
});

export const auditEvent = z.object({
  id,
  action: z.string(),
  entityType: z.string(),
  entityId: id.nullable(),
  actor: z.string().nullable(),
  summary: z.record(z.string(), z.unknown()),
  reason: z.string().nullable(),
  requestId: z.string().nullable(),
  occurredAt: isoDateTime,
});
export const auditQuery = pageQuery.extend({
  entityType: z.string().max(60).optional(),
  entityId: id.optional(),
  actorAccountId: id.optional(),
  action: z.string().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export const auditPage = page(auditEvent);
