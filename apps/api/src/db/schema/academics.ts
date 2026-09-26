import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, numeric, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import {
  academicYearStatuses,
  calendarDayKinds,
  courseEnrollmentStatuses,
  curriculumStates,
  enrollmentStatuses,
  placementReasons,
  subjectRequirements,
} from '@edventure/contracts';
import { app, day, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, schools } from './core';
import { students, teachers } from './people';

export const academicYearStatus = app.enum('academic_year_status', academicYearStatuses);
export const calendarDayKind = app.enum('calendar_day_kind', calendarDayKinds);
export const enrollmentStatus = app.enum('enrollment_status', enrollmentStatuses);
export const placementReason = app.enum('placement_reason', placementReasons);
export const subjectRequirement = app.enum('subject_requirement', subjectRequirements);
export const curriculumState = app.enum('curriculum_state', curriculumStates);
export const courseEnrollmentStatus = app.enum('course_enrollment_status', courseEnrollmentStatuses);

export const academicYears = app.table(
  'academic_years',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date').notNull(),
    status: academicYearStatus('status').notNull().default('planning'),
    closedAt: ts('closed_at'),
    closedByAccountId: uuid('closed_by_account_id'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('academic_years', t, schools),
    tfk('academic_years_closed_by_fk', t.schoolId, t.closedByAccountId, accounts),
    uniqueIndex('academic_years_code_uk').on(t.schoolId, t.code),
    uniqueIndex('academic_years_one_active_uk')
      .on(t.schoolId)
      .where(sql`${t.status} = 'active'`),
    check('academic_years_dates', sql`${t.endDate} > ${t.startDate}`),
  ],
);

export const terms = app.table(
  'terms',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    sequence: integer('sequence').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date').notNull(),
  },
  (t) => [
    ...tenantConstraints('terms', t, schools),
    tfk('terms_year_fk', t.schoolId, t.academicYearId, academicYears),
    uniqueIndex('terms_sequence_uk').on(t.schoolId, t.academicYearId, t.sequence),
    check('terms_dates', sql`${t.endDate} > ${t.startDate}`),
  ],
);

/** Exceptions to the weekly working pattern: holidays, closures and special days. */
export const schoolCalendarDays = app.table(
  'school_calendar_days',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id'),
    date: day('date').notNull(),
    kind: calendarDayKind('kind').notNull(),
    title: text('title').notNull(),
    titleUr: text('title_ur'),
    note: text('note'),
  },
  (t) => [
    ...tenantConstraints('school_calendar_days', t, schools),
    tfk('school_calendar_days_year_fk', t.schoolId, t.academicYearId, academicYears),
    uniqueIndex('school_calendar_days_date_uk').on(t.schoolId, t.date),
  ],
);

export const rooms = app.table(
  'rooms',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    capacity: integer('capacity'),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('rooms', t, schools), uniqueIndex('rooms_code_uk').on(t.schoolId, t.code)],
);

/** Configurable grade labels (Nursery, Class 1 … Class 10) and the explicit progression target. */
export const gradeLevels = app.table(
  'grade_levels',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    sortOrder: integer('sort_order').notNull(),
    nextGradeLevelId: uuid('next_grade_level_id'),
    isTerminal: boolean('is_terminal').notNull().default(false),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('grade_levels', t, schools),
    tfk('grade_levels_next_fk', t.schoolId, t.nextGradeLevelId, { schoolId: t.schoolId, id: t.id }),
    uniqueIndex('grade_levels_code_uk').on(t.schoolId, t.code),
    check('grade_levels_terminal', sql`not (${t.isTerminal} and ${t.nextGradeLevelId} is not null)`),
    check('grade_levels_not_self', sql`${t.nextGradeLevelId} is null or ${t.nextGradeLevelId} <> ${t.id}`),
  ],
);

export const subjects = app.table(
  'subjects',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('subjects', t, schools), uniqueIndex('subjects_code_uk').on(t.schoolId, t.code)],
);

/** Configurable academic pathways, e.g. Biology and Computer Science groups in classes 9–10. */
export const streams = app.table(
  'streams',
  {
    ...tenantColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    description: text('description'),
    archivedAt: ts('archived_at'),
  },
  (t) => [...tenantConstraints('streams', t, schools), uniqueIndex('streams_code_uk').on(t.schoolId, t.code)],
);

export const curriculumVersions = app.table(
  'curriculum_versions',
  {
    ...tenantColumns(),
    gradeLevelId: uuid('grade_level_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    name: text('name').notNull(),
    state: curriculumState('state').notNull().default('draft'),
    notes: text('notes'),
  },
  (t) => [
    ...tenantConstraints('curriculum_versions', t, schools),
    tfk('curriculum_versions_grade_fk', t.schoolId, t.gradeLevelId, gradeLevels),
    uniqueIndex('curriculum_versions_uk').on(t.schoolId, t.gradeLevelId, t.versionNumber),
  ],
);

export const curriculumSubjects = app.table(
  'curriculum_subjects',
  {
    ...tenantColumns(),
    curriculumVersionId: uuid('curriculum_version_id').notNull(),
    subjectId: uuid('subject_id').notNull(),
    requirement: subjectRequirement('requirement').notNull().default('compulsory'),
    /** When set, the subject is the default for students in this stream. */
    streamId: uuid('stream_id'),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull().default('1'),
    credit: numeric('credit', { precision: 4, scale: 1 }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    ...tenantConstraints('curriculum_subjects', t, schools),
    tfk('curriculum_subjects_version_fk', t.schoolId, t.curriculumVersionId, curriculumVersions, 'cascade'),
    tfk('curriculum_subjects_subject_fk', t.schoolId, t.subjectId, subjects),
    tfk('curriculum_subjects_stream_fk', t.schoolId, t.streamId, streams),
    uniqueIndex('curriculum_subjects_uk').on(t.schoolId, t.curriculumVersionId, t.subjectId),
  ],
);

/** A grade level instantiated in one academic year ("Class 9 in 2026-27"). */
export const classOfferings = app.table(
  'class_offerings',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    gradeLevelId: uuid('grade_level_id').notNull(),
    curriculumVersionId: uuid('curriculum_version_id'),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('class_offerings', t, schools),
    tfk('class_offerings_year_fk', t.schoolId, t.academicYearId, academicYears),
    tfk('class_offerings_grade_fk', t.schoolId, t.gradeLevelId, gradeLevels),
    tfk('class_offerings_curriculum_fk', t.schoolId, t.curriculumVersionId, curriculumVersions),
    uniqueIndex('class_offerings_uk').on(t.schoolId, t.academicYearId, t.gradeLevelId),
  ],
);

export const sections = app.table(
  'sections',
  {
    ...tenantColumns(),
    classOfferingId: uuid('class_offering_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    capacity: integer('capacity'),
    homeRoomId: uuid('home_room_id'),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('sections', t, schools),
    tfk('sections_class_offering_fk', t.schoolId, t.classOfferingId, classOfferings),
    tfk('sections_room_fk', t.schoolId, t.homeRoomId, rooms),
    uniqueIndex('sections_code_uk').on(t.schoolId, t.classOfferingId, t.code),
  ],
);

/** A subject offered to a class offering; the unit that teaching groups, homework and exams hang off. */
export const courseOfferings = app.table(
  'course_offerings',
  {
    ...tenantColumns(),
    classOfferingId: uuid('class_offering_id').notNull(),
    subjectId: uuid('subject_id').notNull(),
    requirement: subjectRequirement('requirement').notNull().default('compulsory'),
    streamId: uuid('stream_id'),
    weight: numeric('weight', { precision: 5, scale: 2 }).notNull().default('1'),
    credit: numeric('credit', { precision: 4, scale: 1 }),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('course_offerings', t, schools),
    tfk('course_offerings_class_offering_fk', t.schoolId, t.classOfferingId, classOfferings),
    tfk('course_offerings_subject_fk', t.schoolId, t.subjectId, subjects),
    tfk('course_offerings_stream_fk', t.schoolId, t.streamId, streams),
    uniqueIndex('course_offerings_uk').on(t.schoolId, t.classOfferingId, t.subjectId),
  ],
);

/** One enrollment per student per academic year. History is never overwritten. */
export const studentEnrollments = app.table(
  'student_enrollments',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    academicYearId: uuid('academic_year_id').notNull(),
    classOfferingId: uuid('class_offering_id').notNull(),
    status: enrollmentStatus('status').notNull().default('active'),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    statusReason: text('status_reason'),
    sourcePromotionDecisionId: uuid('source_promotion_decision_id'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('student_enrollments', t, schools),
    tfk('student_enrollments_student_fk', t.schoolId, t.studentId, students),
    tfk('student_enrollments_year_fk', t.schoolId, t.academicYearId, academicYears),
    tfk('student_enrollments_class_offering_fk', t.schoolId, t.classOfferingId, classOfferings),
    uniqueIndex('student_enrollments_student_year_uk').on(t.schoolId, t.studentId, t.academicYearId),
    uniqueIndex('student_enrollments_promotion_uk').on(t.sourcePromotionDecisionId),
    index('student_enrollments_class_idx').on(t.schoolId, t.classOfferingId, t.status),
  ],
);

/** Effective-dated section placement `[start_date, end_date)`. Overlaps are excluded in SQL. */
export const studentPlacements = app.table(
  'student_placements',
  {
    ...tenantColumns(),
    enrollmentId: uuid('enrollment_id').notNull(),
    studentId: uuid('student_id').notNull(),
    sectionId: uuid('section_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    reason: placementReason('reason').notNull(),
    note: text('note'),
    createdByAccountId: uuid('created_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('student_placements', t, schools),
    tfk('student_placements_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_placements_student_fk', t.schoolId, t.studentId, students),
    tfk('student_placements_section_fk', t.schoolId, t.sectionId, sections),
    index('student_placements_section_idx').on(t.schoolId, t.sectionId, t.startDate),
    index('student_placements_student_idx').on(t.schoolId, t.studentId),
    check('student_placements_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

export const studentStreamAssignments = app.table(
  'student_stream_assignments',
  {
    ...tenantColumns(),
    enrollmentId: uuid('enrollment_id').notNull(),
    streamId: uuid('stream_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    note: text('note'),
  },
  (t) => [
    ...tenantConstraints('student_stream_assignments', t, schools),
    tfk('student_stream_assignments_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_stream_assignments_stream_fk', t.schoolId, t.streamId, streams),
    check('student_stream_assignments_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/** What a student actually studies. Streams only supply defaults. */
export const studentCourseEnrollments = app.table(
  'student_course_enrollments',
  {
    ...tenantColumns(),
    enrollmentId: uuid('enrollment_id').notNull(),
    studentId: uuid('student_id').notNull(),
    courseOfferingId: uuid('course_offering_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    status: courseEnrollmentStatus('status').notNull().default('active'),
  },
  (t) => [
    ...tenantConstraints('student_course_enrollments', t, schools),
    tfk('student_course_enrollments_enrollment_fk', t.schoolId, t.enrollmentId, studentEnrollments),
    tfk('student_course_enrollments_student_fk', t.schoolId, t.studentId, students),
    tfk('student_course_enrollments_course_fk', t.schoolId, t.courseOfferingId, courseOfferings),
    index('student_course_enrollments_course_idx').on(t.schoolId, t.courseOfferingId),
    index('student_course_enrollments_student_idx').on(t.schoolId, t.studentId),
    check('student_course_enrollments_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/** A teaching audience: a whole section for a subject, or an elective group (e.g. 9A Biology). */
export const teachingGroups = app.table(
  'teaching_groups',
  {
    ...tenantColumns(),
    courseOfferingId: uuid('course_offering_id').notNull(),
    sectionId: uuid('section_id'),
    code: text('code').notNull(),
    name: text('name').notNull(),
    archivedAt: ts('archived_at'),
  },
  (t) => [
    ...tenantConstraints('teaching_groups', t, schools),
    tfk('teaching_groups_course_fk', t.schoolId, t.courseOfferingId, courseOfferings),
    tfk('teaching_groups_section_fk', t.schoolId, t.sectionId, sections),
    uniqueIndex('teaching_groups_code_uk').on(t.schoolId, t.courseOfferingId, t.code),
  ],
);

export const teachingGroupMemberships = app.table(
  'teaching_group_memberships',
  {
    ...tenantColumns(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    studentCourseEnrollmentId: uuid('student_course_enrollment_id').notNull(),
    studentId: uuid('student_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
  },
  (t) => [
    ...tenantConstraints('teaching_group_memberships', t, schools),
    tfk('tgm_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    tfk('tgm_course_enrollment_fk', t.schoolId, t.studentCourseEnrollmentId, studentCourseEnrollments),
    tfk('tgm_student_fk', t.schoolId, t.studentId, students),
    index('tgm_group_idx').on(t.schoolId, t.teachingGroupId),
    index('tgm_student_idx').on(t.schoolId, t.studentId),
    check('tgm_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

export const teacherAssignments = app.table(
  'teacher_assignments',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    isPrimary: boolean('is_primary').notNull().default(true),
    assignedByAccountId: uuid('assigned_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('teacher_assignments', t, schools),
    tfk('teacher_assignments_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('teacher_assignments_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    index('teacher_assignments_teacher_idx').on(t.schoolId, t.teacherId),
    index('teacher_assignments_group_idx').on(t.schoolId, t.teachingGroupId),
    check('teacher_assignments_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/** Explicit administrator assignment. One active class teacher per section (exclusion in SQL). */
export const classTeacherAssignments = app.table(
  'class_teacher_assignments',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    sectionId: uuid('section_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    assignedByAccountId: uuid('assigned_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('class_teacher_assignments', t, schools),
    tfk('class_teacher_assignments_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('class_teacher_assignments_section_fk', t.schoolId, t.sectionId, sections),
    index('class_teacher_assignments_teacher_idx').on(t.schoolId, t.teacherId),
    check('class_teacher_assignments_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/** Substitute roll-call authority for a section. `end_date` is the inclusive last day. */
export const attendanceDelegations = app.table(
  'attendance_delegations',
  {
    ...tenantColumns(),
    sectionId: uuid('section_id').notNull(),
    teacherId: uuid('teacher_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date').notNull(),
    reason: text('reason'),
    grantedByAccountId: uuid('granted_by_account_id'),
    revokedAt: ts('revoked_at'),
  },
  (t) => [
    ...tenantConstraints('attendance_delegations', t, schools),
    tfk('attendance_delegations_section_fk', t.schoolId, t.sectionId, sections),
    tfk('attendance_delegations_teacher_fk', t.schoolId, t.teacherId, teachers),
    check('attendance_delegations_dates', sql`${t.endDate} >= ${t.startDate}`),
  ],
);
