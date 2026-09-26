import { z } from 'zod';
import { id, isoDateTime } from './common';
import { reportJobStates } from './domain';

/** Stable, English, machine-readable CSV headers. Values may be Urdu (UTF-8). */
export const studentImportColumns = [
  { key: 'admission_number', required: true, example: 'A-1001' },
  { key: 'display_name', required: true, example: 'Ali Raza' },
  { key: 'display_name_ur', required: false, example: 'علی رضا' },
  { key: 'username', required: true, example: 'ali.raza' },
  { key: 'admission_date', required: true, example: '2026-04-01' },
  { key: 'academic_year_code', required: true, example: '2026-27' },
  { key: 'class_code', required: true, example: 'G9' },
  { key: 'section_code', required: true, example: 'A' },
  { key: 'stream_code', required: false, example: 'BIO' },
  { key: 'gender', required: false, example: 'male' },
  { key: 'date_of_birth', required: false, example: '2011-05-14' },
  { key: 'phone', required: false, example: '+92 300 1234567' },
  { key: 'email', required: false, example: '' },
  { key: 'address', required: false, example: 'House 12, Street 4, Lahore' },
  { key: 'guardian_name', required: false, example: 'Raza Ahmed' },
  { key: 'guardian_relationship', required: false, example: 'Father' },
  { key: 'guardian_phone', required: false, example: '+92 321 7654321' },
] as const;

export const teacherImportColumns = [
  { key: 'employee_number', required: true, example: 'E-201' },
  { key: 'display_name', required: true, example: 'Ayesha Khan' },
  { key: 'display_name_ur', required: false, example: 'عائشہ خان' },
  { key: 'username', required: true, example: 'ayesha.khan' },
  { key: 'employment_start_date', required: true, example: '2026-04-01' },
  { key: 'job_title', required: false, example: 'Senior Teacher' },
  { key: 'gender', required: false, example: 'female' },
  { key: 'phone', required: false, example: '+92 300 7654321' },
  { key: 'email', required: false, example: 'ayesha@example.com' },
  { key: 'qualifications', required: false, example: 'MSc Mathematics, B.Ed' },
] as const;

export const peopleImportKind = z.enum(['students', 'teachers']);
export const createPeopleImportRequest = z.object({ kind: peopleImportKind, fileId: id });

/* ---------------- Reports and exports ---------------- */

export const reportKinds = [
  'students',
  'attendance_section',
  'attendance_daily',
  'teacher_attendance',
  'leave',
  'homework_completion',
  'exam_results',
  'fee_balances',
  'report_card',
  'date_sheet',
  'mark_sheet',
  'fee_statement',
] as const;
export const reportKind = z.enum(reportKinds);
export type ReportKind = z.infer<typeof reportKind>;

export const createReportRequest = z.object({
  kind: reportKind,
  format: z.enum(['csv', 'pdf']),
  locale: z.enum(['en', 'ur']).default('en'),
  parameters: z.record(z.string(), z.string()).default({}),
});
export const reportJob = z.object({
  id,
  kind: z.string(),
  format: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  state: z.enum(reportJobStates),
  error: z.string().nullable(),
  fileId: id.nullable(),
  createdAt: isoDateTime,
  completedAt: isoDateTime.nullable(),
  expiresAt: isoDateTime.nullable(),
});
export type ReportJob = z.infer<typeof reportJob>;
