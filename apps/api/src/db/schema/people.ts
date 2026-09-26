import { sql } from 'drizzle-orm';
import { boolean, check, index, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { employmentStatuses, genders } from '@edventure/contracts';
import { app, day, money, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, files, schools } from './core';

export const gender = app.enum('gender', genders);
export const employmentStatus = app.enum('employment_status', employmentStatuses);

/** Student profile. Display names live on the account so every role shares one identity record. */
export const students = app.table(
  'students',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    admissionNumber: text('admission_number').notNull(),
    admissionDate: day('admission_date').notNull(),
    gender: gender('gender'),
    dateOfBirth: day('date_of_birth'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    photoFileId: uuid('photo_file_id'),
    notes: text('notes'),
    deletedAt: ts('deleted_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('students', t, schools),
    tfk('students_account_fk', t.schoolId, t.accountId, accounts),
    tfk('students_photo_fk', t.schoolId, t.photoFileId, files),
    uniqueIndex('students_account_uk').on(t.accountId),
    uniqueIndex('students_admission_number_uk').on(t.schoolId, t.admissionNumber),
  ],
);

export const teachers = app.table(
  'teachers',
  {
    ...tenantColumns(),
    accountId: uuid('account_id').notNull(),
    employeeNumber: text('employee_number').notNull(),
    gender: gender('gender'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    qualifications: text('qualifications'),
    photoFileId: uuid('photo_file_id'),
    deletedAt: ts('deleted_at'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('teachers', t, schools),
    tfk('teachers_account_fk', t.schoolId, t.accountId, accounts),
    tfk('teachers_photo_fk', t.schoolId, t.photoFileId, files),
    uniqueIndex('teachers_account_uk').on(t.accountId),
    uniqueIndex('teachers_employee_number_uk').on(t.schoolId, t.employeeNumber),
  ],
);

/** Contact records only; guardians do not have login accounts in the first release. */
export const guardians = app.table(
  'guardians',
  {
    ...tenantColumns(),
    name: text('name').notNull(),
    nameUr: text('name_ur'),
    phone: text('phone'),
    altPhone: text('alt_phone'),
    email: text('email'),
    address: text('address'),
    occupation: text('occupation'),
  },
  (t) => [...tenantConstraints('guardians', t, schools)],
);

export const studentGuardians = app.table(
  'student_guardians',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    guardianId: uuid('guardian_id').notNull(),
    relationship: text('relationship').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    isEmergency: boolean('is_emergency').notNull().default(false),
  },
  (t) => [
    ...tenantConstraints('student_guardians', t, schools),
    tfk('student_guardians_student_fk', t.schoolId, t.studentId, students, 'cascade'),
    tfk('student_guardians_guardian_fk', t.schoolId, t.guardianId, guardians),
    uniqueIndex('student_guardians_uk').on(t.schoolId, t.studentId, t.guardianId),
  ],
);

export const employmentRecords = app.table(
  'employment_records',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    startDate: day('start_date').notNull(),
    endDate: day('end_date'),
    status: employmentStatus('status').notNull().default('active'),
    jobTitle: text('job_title'),
    notes: text('notes'),
  },
  (t) => [
    ...tenantConstraints('employment_records', t, schools),
    tfk('employment_records_teacher_fk', t.schoolId, t.teacherId, teachers),
    index('employment_records_teacher_idx').on(t.schoolId, t.teacherId),
    check('employment_records_dates', sql`${t.endDate} is null or ${t.endDate} > ${t.startDate}`),
  ],
);

/**
 * Confidential compensation. Separate from the teacher profile and protected by an additional
 * row-level policy that requires the school-admin role in the transaction context.
 */
export const compensationRecords = app.table(
  'compensation_records',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    effectiveFrom: day('effective_from').notNull(),
    effectiveTo: day('effective_to'),
    amount: money('amount').notNull(),
    currency: text('currency').notNull().default('PKR'),
    payFrequency: text('pay_frequency').notNull().default('monthly'),
    notes: text('notes'),
    recordedByAccountId: uuid('recorded_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('compensation_records', t, schools),
    tfk('compensation_records_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('compensation_records_recorder_fk', t.schoolId, t.recordedByAccountId, accounts),
    check('compensation_records_amount', sql`${t.amount} >= 0`),
    check('compensation_records_dates', sql`${t.effectiveTo} is null or ${t.effectiveTo} > ${t.effectiveFrom}`),
  ],
);

export const studentDocuments = app.table(
  'student_documents',
  {
    ...tenantColumns(),
    studentId: uuid('student_id').notNull(),
    fileId: uuid('file_id').notNull(),
    title: text('title').notNull(),
    uploadedByAccountId: uuid('uploaded_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('student_documents', t, schools),
    tfk('student_documents_student_fk', t.schoolId, t.studentId, students),
    tfk('student_documents_file_fk', t.schoolId, t.fileId, files),
  ],
);

export const teacherDocuments = app.table(
  'teacher_documents',
  {
    ...tenantColumns(),
    teacherId: uuid('teacher_id').notNull(),
    fileId: uuid('file_id').notNull(),
    title: text('title').notNull(),
    uploadedByAccountId: uuid('uploaded_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('teacher_documents', t, schools),
    tfk('teacher_documents_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('teacher_documents_file_fk', t.schoolId, t.fileId, files),
  ],
);
