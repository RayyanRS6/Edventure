import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, optionalUrdu, page, pageQuery, percentage, versioned } from './common';
import { accountStatus, enrollmentStatus, employmentStatus, provisioningState, role } from './roles';
import { genders } from './domain';
import { username } from './auth';

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d][\d\s-]{5,}$/, 'Enter a valid phone number')
  .nullish();
const email = z.email('Enter a valid email address').max(200).nullish();
const optionalText = (max = 500) => z.string().trim().max(max).nullish();

export const gender = z.enum(genders);

export const accountSummary = z.object({
  id,
  username: z.string(),
  displayName: z.string(),
  displayNameUr: z.string().nullable(),
  status: accountStatus,
  provisioningState,
  provisioningError: z.string().nullable(),
  roles: z.array(role),
  mustChangePassword: z.boolean(),
  lastLoginAt: isoDateTime.nullable(),
  version: z.number().int(),
});
export type AccountSummary = z.infer<typeof accountSummary>;

/** Returned once, immediately after provisioning or a reset. Never stored or retrievable later. */
export const issuedCredential = z.object({
  accountId: id,
  username: z.string(),
  displayName: z.string(),
  temporaryPassword: z.string(),
});
export type IssuedCredential = z.infer<typeof issuedCredential>;

export const issueCredentialsRequest = z.object({ accountIds: z.array(id).min(1).max(500) });
export const issueCredentialsResponse = z.object({
  issued: z.array(issuedCredential),
  failed: z.array(z.object({ accountId: id, message: z.string() })),
});

export const accountStatusChange = z.object({ reason: z.string().trim().min(3).max(500) });
export const updateRolesRequest = versioned.extend({ roles: z.array(role).min(1) });

export const guardianInput = z.object({
  id: id.optional(),
  name: nonEmpty(120),
  nameUr: optionalUrdu,
  relationship: nonEmpty(40),
  phone,
  altPhone: phone,
  email,
  address: optionalText(),
  occupation: optionalText(100),
  isPrimary: z.boolean().default(false),
  isEmergency: z.boolean().default(false),
});
export type GuardianInput = z.input<typeof guardianInput>;

export const guardian = z.object({
  id,
  name: z.string(),
  nameUr: z.string().nullable(),
  relationship: z.string(),
  phone: z.string().nullable(),
  altPhone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  occupation: z.string().nullable(),
  isPrimary: z.boolean(),
  isEmergency: z.boolean(),
});

const personFields = {
  displayName: nonEmpty(120),
  displayNameUr: optionalUrdu,
  gender: gender.nullish(),
  phone,
  email,
  address: optionalText(),
};

export const createStudentRequest = z.object({
  ...personFields,
  admissionNumber: nonEmpty(32),
  username,
  admissionDate: isoDate,
  dateOfBirth: isoDate.nullish(),
  notes: optionalText(2000),
  enrollment: z.object({
    classOfferingId: id,
    sectionId: id,
    streamId: id.nullish(),
    /** Defaults to the admission date. */
    startDate: isoDate.optional(),
  }),
  guardians: z.array(guardianInput).max(4).default([]),
});
export type CreateStudentRequest = z.input<typeof createStudentRequest>;

export const updateStudentRequest = versioned.extend({
  displayName: nonEmpty(120).optional(),
  displayNameUr: optionalUrdu,
  gender: gender.nullish(),
  phone,
  email,
  address: optionalText(),
  dateOfBirth: isoDate.nullish(),
  admissionNumber: nonEmpty(32).optional(),
  notes: optionalText(2000),
  guardians: z.array(guardianInput).max(4).optional(),
});

export const enrollmentSummary = z.object({
  id,
  academicYearId: id,
  academicYearCode: z.string(),
  classOfferingId: id,
  gradeLevelId: id,
  gradeName: z.string(),
  sectionId: id.nullable(),
  sectionName: z.string().nullable(),
  streamId: id.nullable(),
  streamName: z.string().nullable(),
  status: enrollmentStatus,
  startDate: isoDate,
  endDate: isoDate.nullable(),
});
export type EnrollmentSummary = z.infer<typeof enrollmentSummary>;

export const studentListItem = z.object({
  id,
  accountId: id,
  admissionNumber: z.string(),
  displayName: z.string(),
  displayNameUr: z.string().nullable(),
  username: z.string(),
  accountStatus,
  enrollment: enrollmentSummary.nullable(),
  suspended: z.boolean(),
});
export type StudentListItem = z.infer<typeof studentListItem>;

export const studentListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  academicYearId: id.optional(),
  classOfferingId: id.optional(),
  sectionId: id.optional(),
  streamId: id.optional(),
  accountStatus: accountStatus.optional(),
  enrollmentStatus: enrollmentStatus.optional(),
  /** Fee filter derived from balances. */
  fees: z.enum(['outstanding', 'overdue', 'clear']).optional(),
  /** Latest published result percentage range. */
  minPercentage: percentage.optional(),
  maxPercentage: percentage.optional(),
  gradeLabel: z.string().max(10).optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
});
export type StudentListQuery = z.input<typeof studentListQuery>;

export const studentDetail = studentListItem.extend({
  gender: gender.nullable(),
  dateOfBirth: isoDate.nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  admissionDate: isoDate,
  notes: z.string().nullable(),
  guardians: z.array(guardian),
  account: accountSummary,
  enrollments: z.array(enrollmentSummary),
  activeSuspension: z
    .object({ id, startDate: isoDate, endDate: isoDate, reason: z.string() })
    .nullable(),
  deletion: z.object({ requestedAt: isoDateTime, recoverUntil: isoDateTime }).nullable(),
  version: z.number().int(),
});
export type StudentDetail = z.infer<typeof studentDetail>;

export const createStudentResponse = z.object({
  student: studentDetail,
  credential: issuedCredential.nullable(),
  provisioningError: z.string().nullable(),
});

export const createTeacherRequest = z.object({
  ...personFields,
  employeeNumber: nonEmpty(32),
  username,
  employmentStartDate: isoDate,
  jobTitle: optionalText(100),
  qualifications: optionalText(1000),
  /** Also grant the school-admin role (requires MFA). */
  isAdmin: z.boolean().default(false),
});
export type CreateTeacherRequest = z.input<typeof createTeacherRequest>;

export const updateTeacherRequest = versioned.extend({
  displayName: nonEmpty(120).optional(),
  displayNameUr: optionalUrdu,
  gender: gender.nullish(),
  phone,
  email,
  address: optionalText(),
  qualifications: optionalText(1000),
  employeeNumber: nonEmpty(32).optional(),
});

export const teacherListItem = z.object({
  id,
  accountId: id,
  employeeNumber: z.string(),
  displayName: z.string(),
  displayNameUr: z.string().nullable(),
  username: z.string(),
  accountStatus,
  employmentStatus: employmentStatus.nullable(),
  jobTitle: z.string().nullable(),
  classTeacherOf: z.array(z.object({ sectionId: id, sectionName: z.string() })),
  isAdmin: z.boolean(),
});
export type TeacherListItem = z.infer<typeof teacherListItem>;

export const teacherListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  accountStatus: accountStatus.optional(),
  employmentStatus: employmentStatus.optional(),
  includeDeleted: z.enum(['true', 'false']).optional(),
});

export const employmentRecord = z.object({
  id,
  startDate: isoDate,
  endDate: isoDate.nullable(),
  status: employmentStatus,
  jobTitle: z.string().nullable(),
  notes: z.string().nullable(),
});

export const teacherDetail = teacherListItem.extend({
  gender: gender.nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  qualifications: z.string().nullable(),
  account: accountSummary,
  employment: z.array(employmentRecord),
  assignments: z.array(
    z.object({
      id,
      teachingGroupId: id,
      teachingGroupName: z.string(),
      subjectName: z.string(),
      startDate: isoDate,
      endDate: isoDate.nullable(),
    }),
  ),
  deletion: z.object({ requestedAt: isoDateTime, recoverUntil: isoDateTime }).nullable(),
  version: z.number().int(),
});
export type TeacherDetail = z.infer<typeof teacherDetail>;

export const createTeacherResponse = z.object({
  teacher: teacherDetail,
  credential: issuedCredential.nullable(),
  provisioningError: z.string().nullable(),
});

export const endEmploymentRequest = z.object({
  endDate: isoDate,
  reason: z.string().trim().min(3).max(500),
});

/** Teacher departure: access ends and open duties are listed for reassignment. */
export const endEmploymentResponse = z.object({
  unassignedDuties: z.array(
    z.object({
      kind: z.enum(['teaching_group', 'class_teacher', 'timetable_lesson']),
      id,
      label: z.string(),
    }),
  ),
});

export const compensationRecord = z.object({
  id,
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  amount: z.string(),
  currency: z.string(),
  payFrequency: z.string(),
  notes: z.string().nullable(),
});
export const createCompensationRequest = z.object({
  effectiveFrom: isoDate,
  amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
  payFrequency: z.enum(['monthly', 'annual']).default('monthly'),
  notes: optionalText(1000),
});

export const createAdminRequest = z.object({
  displayName: nonEmpty(120),
  displayNameUr: optionalUrdu,
  username,
});

export const adminListItem = z.object({
  accountId: id,
  username: z.string(),
  displayName: z.string(),
  status: accountStatus,
  lastLoginAt: isoDateTime.nullable(),
  isTeacher: z.boolean(),
});

/** Second confirmation shows exactly when recovery ends and what will be affected. */
export const deletionPreview = z.object({
  accountId: id,
  displayName: z.string(),
  recoverUntil: isoDateTime,
  impacts: z.array(z.string()),
});
export const deleteAccountRequest = z.object({
  /** Must be `true`: the client shows two confirmations before sending this. */
  confirm: z.literal(true),
  reason: z.string().trim().max(500).optional(),
});
export const deletionResult = z.object({ accountId: id, recoverUntil: isoDateTime });
export const restoreResult = z.object({
  accountId: id,
  restored: z.literal(true),
  /** Assignments that were replaced while the account was deleted and are not restored automatically. */
  notRestored: z.array(z.string()),
});

export const suspensionRequest = z.object({
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().min(3).max(1000),
});
export const disciplinarySuspension = z.object({
  id,
  studentId: id,
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string(),
  revokedAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
});

export const studentListPage = page(studentListItem);
export const teacherListPage = page(teacherListItem);
