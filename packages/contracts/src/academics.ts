import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, optionalUrdu, versioned } from './common';
import { academicYearStatuses, calendarDayKinds, placementReasons, subjectRequirements } from './domain';

const code = (max = 16) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, digits, dots, hyphens or underscores')
    .transform((v) => v.toUpperCase());

/* ---------- School settings ---------- */

export const schoolSettings = z.object({
  id,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  defaultLocale: z.enum(['en', 'ur']),
  branding: z.object({ primaryColor: z.string().optional(), logoFileId: z.string().optional() }),
  policies: z.object({
    attendance: z.object({
      workingWeekdays: z.array(z.number().int().min(1).max(7)),
      sameDayTeacherCorrection: z.boolean(),
    }),
    retention: z.object({ recoveryDays: z.number().int(), purgeEnabled: z.boolean(), exportDownloadHours: z.number().int() }),
    notifications: z.object({
      feeReminderMode: z.enum(['preview', 'scheduled']),
      feeReminderDaysAfterDue: z.array(z.number().int()),
    }),
    operations: z.object({ offlineCacheDays: z.number().int(), minimumMobileVersion: z.string().nullable() }),
  }),
  version: z.number().int(),
});
export type SchoolSettings = z.infer<typeof schoolSettings>;

export const updateSchoolSettingsRequest = versioned.extend({
  name: nonEmpty(200).optional(),
  nameUr: optionalUrdu,
  defaultLocale: z.enum(['en', 'ur']).optional(),
  branding: z.object({ primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), logoFileId: id.optional() }).optional(),
  attendance: z
    .object({
      workingWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
      sameDayTeacherCorrection: z.boolean(),
    })
    .optional(),
  notifications: z
    .object({
      feeReminderMode: z.enum(['preview', 'scheduled']),
      feeReminderDaysAfterDue: z.array(z.number().int().min(0).max(120)).max(5),
    })
    .optional(),
  retention: z
    .object({
      recoveryDays: z.literal(30),
      purgeEnabled: z.boolean(),
      exportDownloadHours: z.number().int().min(1).max(168),
    })
    .optional(),
});

/* ---------- Academic years, terms, calendar ---------- */

export const academicYear = z.object({
  id,
  code: z.string(),
  name: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  status: z.enum(academicYearStatuses),
  closedAt: isoDateTime.nullable(),
  version: z.number().int(),
});
export type AcademicYear = z.infer<typeof academicYear>;

export const createAcademicYearRequest = z
  .object({ code: nonEmpty(20), name: nonEmpty(100), startDate: isoDate, endDate: isoDate })
  .refine((v) => v.endDate > v.startDate, { path: ['endDate'], message: 'End date must be after the start date' });

export const updateAcademicYearRequest = versioned.extend({
  name: nonEmpty(100).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});

/** Closure is blocked while unresolved work remains; the response lists it. */
export const academicYearClosureCheck = z.object({
  canClose: z.boolean(),
  blockers: z.array(z.object({ kind: z.string(), count: z.number().int(), message: z.string() })),
});

export const term = z.object({
  id,
  academicYearId: id,
  name: z.string(),
  nameUr: z.string().nullable(),
  sequence: z.number().int(),
  startDate: isoDate,
  endDate: isoDate,
});
export const createTermRequest = z
  .object({
    name: nonEmpty(60),
    nameUr: optionalUrdu,
    sequence: z.number().int().min(1).max(12),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((v) => v.endDate > v.startDate, { path: ['endDate'], message: 'End date must be after the start date' });

export const calendarDay = z.object({
  id,
  date: isoDate,
  kind: z.enum(calendarDayKinds),
  title: z.string(),
  titleUr: z.string().nullable(),
  note: z.string().nullable(),
});
export type CalendarDay = z.infer<typeof calendarDay>;
export const upsertCalendarDayRequest = z.object({
  date: isoDate,
  kind: z.enum(calendarDayKinds),
  title: nonEmpty(120),
  titleUr: optionalUrdu,
  note: z.string().trim().max(500).nullish(),
  /** Publish a holiday/closure alert to everyone. */
  notify: z.boolean().default(false),
});
export const calendarQuery = z.object({ from: isoDate, to: isoDate });

/* ---------- Structure ---------- */

export const room = z.object({ id, code: z.string(), name: z.string(), capacity: z.number().int().nullable(), archived: z.boolean() });
export const createRoomRequest = z.object({ code: code(), name: nonEmpty(80), capacity: z.number().int().min(1).max(2000).nullish() });

export const gradeLevel = z.object({
  id,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  sortOrder: z.number().int(),
  nextGradeLevelId: id.nullable(),
  isTerminal: z.boolean(),
  archived: z.boolean(),
});
export type GradeLevel = z.infer<typeof gradeLevel>;
export const createGradeLevelRequest = z.object({
  code: code(),
  name: nonEmpty(60),
  nameUr: optionalUrdu,
  sortOrder: z.number().int().min(0).max(1000),
  nextGradeLevelId: id.nullish(),
  isTerminal: z.boolean().default(false),
});
export const updateGradeLevelRequest = z.object({
  name: nonEmpty(60).optional(),
  nameUr: optionalUrdu,
  sortOrder: z.number().int().min(0).max(1000).optional(),
  nextGradeLevelId: id.nullish(),
  isTerminal: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const subject = z.object({ id, code: z.string(), name: z.string(), nameUr: z.string().nullable(), archived: z.boolean() });
export type Subject = z.infer<typeof subject>;
export const createSubjectRequest = z.object({ code: code(), name: nonEmpty(80), nameUr: optionalUrdu });
export const updateSubjectRequest = z.object({ name: nonEmpty(80).optional(), nameUr: optionalUrdu, archived: z.boolean().optional() });

export const stream = z.object({
  id,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  description: z.string().nullable(),
  archived: z.boolean(),
});
export type Stream = z.infer<typeof stream>;
export const createStreamRequest = z.object({
  code: code(),
  name: nonEmpty(80),
  nameUr: optionalUrdu,
  description: z.string().trim().max(500).nullish(),
});
export const updateStreamRequest = z.object({
  name: nonEmpty(80).optional(),
  nameUr: optionalUrdu,
  description: z.string().trim().max(500).nullish(),
  archived: z.boolean().optional(),
});

export const curriculumSubject = z.object({
  id,
  subjectId: id,
  subjectName: z.string(),
  requirement: z.enum(subjectRequirements),
  streamId: id.nullable(),
  streamName: z.string().nullable(),
  weight: z.string(),
  credit: z.string().nullable(),
  sortOrder: z.number().int(),
});
export const curriculum = z.object({
  id,
  gradeLevelId: id,
  versionNumber: z.number().int(),
  name: z.string(),
  state: z.enum(['draft', 'active', 'retired']),
  subjects: z.array(curriculumSubject),
});
export type Curriculum = z.infer<typeof curriculum>;
const curriculumSubjectInput = z.object({
  subjectId: id,
  requirement: z.enum(subjectRequirements).default('compulsory'),
  streamId: id.nullish(),
  weight: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).default('1'),
  credit: z.string().regex(/^\d{1,2}(\.\d)?$/).nullish(),
  sortOrder: z.number().int().default(0),
});
export const createCurriculumRequest = z.object({
  gradeLevelId: id,
  name: nonEmpty(100),
  subjects: z.array(curriculumSubjectInput).min(1).max(40),
});
export const updateCurriculumRequest = z.object({
  name: nonEmpty(100).optional(),
  state: z.enum(['draft', 'active', 'retired']).optional(),
  subjects: z.array(curriculumSubjectInput).min(1).max(40).optional(),
});

export const section = z.object({
  id,
  classOfferingId: id,
  code: z.string(),
  name: z.string(),
  capacity: z.number().int().nullable(),
  homeRoomId: id.nullable(),
  archived: z.boolean(),
  studentCount: z.number().int(),
  classTeacher: z.object({ teacherId: id, displayName: z.string(), assignmentId: id }).nullable(),
});
export type Section = z.infer<typeof section>;

export const courseOffering = z.object({
  id,
  classOfferingId: id,
  subjectId: id,
  subjectCode: z.string(),
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  requirement: z.enum(subjectRequirements),
  streamId: id.nullable(),
  weight: z.string(),
  credit: z.string().nullable(),
  archived: z.boolean(),
});
export type CourseOffering = z.infer<typeof courseOffering>;

export const classOffering = z.object({
  id,
  academicYearId: id,
  gradeLevelId: id,
  gradeCode: z.string(),
  gradeName: z.string(),
  gradeNameUr: z.string().nullable(),
  sortOrder: z.number().int(),
  curriculumVersionId: id.nullable(),
  archived: z.boolean(),
  sections: z.array(section),
  courses: z.array(courseOffering),
});
export type ClassOffering = z.infer<typeof classOffering>;

export const createClassOfferingRequest = z.object({
  academicYearId: id,
  gradeLevelId: id,
  /** Copies subjects from this curriculum version into course offerings. */
  curriculumVersionId: id.nullish(),
  sections: z
    .array(z.object({ code: code(8), name: nonEmpty(40), capacity: z.number().int().min(1).max(500).nullish() }))
    .min(1)
    .max(26),
});
export const createSectionRequest = z.object({
  code: code(8),
  name: nonEmpty(40),
  capacity: z.number().int().min(1).max(500).nullish(),
  homeRoomId: id.nullish(),
});
export const updateSectionRequest = z.object({
  name: nonEmpty(40).optional(),
  capacity: z.number().int().min(1).max(500).nullish(),
  homeRoomId: id.nullish(),
  archived: z.boolean().optional(),
});
export const createCourseOfferingRequest = z.object({
  subjectId: id,
  requirement: z.enum(subjectRequirements).default('compulsory'),
  streamId: id.nullish(),
  weight: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).default('1'),
  credit: z.string().regex(/^\d{1,2}(\.\d)?$/).nullish(),
  /** Enroll every active student of the class (respecting stream for stream-specific subjects). */
  enrollStudents: z.boolean().default(true),
});
export const updateCourseOfferingRequest = z.object({
  requirement: z.enum(subjectRequirements).optional(),
  streamId: id.nullish(),
  weight: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).optional(),
  credit: z.string().regex(/^\d{1,2}(\.\d)?$/).nullish(),
  archived: z.boolean().optional(),
});

/* ---------- Enrollment and placements ---------- */

export const placementHistoryItem = z.object({
  id,
  sectionId: id,
  sectionName: z.string(),
  gradeName: z.string(),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  reason: z.enum(placementReasons),
  note: z.string().nullable(),
});

export const changeSectionRequest = z.object({
  sectionId: id,
  effectiveDate: isoDate,
  note: z.string().trim().max(500).nullish(),
});

export const changeStreamRequest = z.object({
  streamId: id,
  effectiveDate: isoDate,
  note: z.string().trim().max(500).nullish(),
  /** When false, only returns the impact preview without changing anything. */
  apply: z.boolean().default(false),
});
export const streamChangePreview = z.object({
  addSubjects: z.array(z.object({ courseOfferingId: id, subjectName: z.string() })),
  dropSubjects: z.array(z.object({ courseOfferingId: id, subjectName: z.string() })),
  affectedTeachingGroups: z.array(z.object({ teachingGroupId: id, name: z.string(), change: z.enum(['join', 'leave']) })),
  upcomingExamPapers: z.array(z.object({ examPaperId: id, subjectName: z.string() })),
  applied: z.boolean(),
});

export const enrollStudentRequest = z.object({
  classOfferingId: id,
  sectionId: id,
  streamId: id.nullish(),
  startDate: isoDate,
});
export const endEnrollmentRequest = z.object({
  status: z.enum(['withdrawn', 'transferred', 'completed']),
  endDate: isoDate,
  reason: z.string().trim().min(3).max(500),
});

export const subjectEnrollment = z.object({
  id,
  courseOfferingId: id,
  subjectName: z.string(),
  requirement: z.enum(subjectRequirements),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  status: z.enum(['active', 'dropped', 'completed']),
  teachingGroups: z.array(z.object({ id, name: z.string() })),
});
export const updateSubjectEnrollmentsRequest = z.object({
  effectiveDate: isoDate,
  add: z.array(id).max(20).default([]),
  drop: z.array(id).max(20).default([]),
});

/* ---------- Teaching groups and assignments ---------- */

export const teachingGroup = z.object({
  id,
  courseOfferingId: id,
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  classOfferingId: id,
  gradeName: z.string(),
  sectionId: id.nullable(),
  sectionName: z.string().nullable(),
  code: z.string(),
  name: z.string(),
  memberCount: z.number().int(),
  teachers: z.array(z.object({ teacherId: id, displayName: z.string(), assignmentId: id, isPrimary: z.boolean() })),
  archived: z.boolean(),
});
export type TeachingGroup = z.infer<typeof teachingGroup>;

export const createTeachingGroupRequest = z.object({
  courseOfferingId: id,
  sectionId: id.nullish(),
  code: code(16),
  name: nonEmpty(80),
  /** Add every student taking this subject in the section (or class when no section). */
  populate: z.boolean().default(true),
  effectiveDate: isoDate.optional(),
});
export const updateGroupMembersRequest = z.object({
  effectiveDate: isoDate,
  add: z.array(id).max(200).default([]),
  remove: z.array(id).max(200).default([]),
});
export const groupMember = z.object({
  studentId: id,
  displayName: z.string(),
  admissionNumber: z.string(),
  startDate: isoDate,
  endDate: isoDate.nullable(),
});

export const assignTeacherRequest = z.object({
  teacherId: id,
  teachingGroupId: id,
  startDate: isoDate,
  endDate: isoDate.nullish(),
  isPrimary: z.boolean().default(true),
});
export const endAssignmentRequest = z.object({ endDate: isoDate });

export const classTeacherAssignment = z.object({
  id,
  teacherId: id,
  teacherName: z.string(),
  sectionId: id,
  sectionName: z.string(),
  gradeName: z.string(),
  startDate: isoDate,
  endDate: isoDate.nullable(),
});
export const assignClassTeacherRequest = z.object({
  teacherId: id,
  sectionId: id,
  startDate: isoDate,
  /** End the current class teacher's assignment on the start date instead of failing. */
  replaceCurrent: z.boolean().default(false),
});
/** The timetable may suggest a class teacher (the teacher of the section's first period); admins decide. */
export const classTeacherSuggestion = z.object({
  sectionId: id,
  teacherId: id.nullable(),
  teacherName: z.string().nullable(),
  reason: z.string(),
});

export const delegation = z.object({
  id,
  sectionId: id,
  sectionName: z.string(),
  teacherId: id,
  teacherName: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().nullable(),
});
export const createDelegationRequest = z
  .object({
    sectionId: id,
    teacherId: id,
    startDate: isoDate,
    /** Inclusive last day of the delegation. */
    lastDate: isoDate,
    reason: z.string().trim().max(300).nullish(),
  })
  .refine((v) => v.lastDate >= v.startDate, { path: ['lastDate'], message: 'Last date cannot be before the start date' });
