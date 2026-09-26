import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, smallint, text, time, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { lessonExceptionKinds, periodKinds, timetableStatuses } from '@edventure/contracts';
import { app, day, tenantColumns, tenantConstraints, tfk, ts, version } from './_helpers';
import { accounts, schools } from './core';
import { teachers } from './people';
import { academicYears, rooms, teachingGroups } from './academics';

export const timetableStatus = app.enum('timetable_version_status', timetableStatuses);
export const periodKind = app.enum('period_kind', periodKinds);
export const lessonExceptionKind = app.enum('lesson_exception_kind', lessonExceptionKinds);

export const periodDefinitions = app.table(
  'period_definitions',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    sequence: integer('sequence').notNull(),
    name: text('name').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    kind: periodKind('kind').notNull().default('lesson'),
  },
  (t) => [
    ...tenantConstraints('period_definitions', t, schools),
    tfk('period_definitions_year_fk', t.schoolId, t.academicYearId, academicYears),
    uniqueIndex('period_definitions_sequence_uk').on(t.schoolId, t.academicYearId, t.sequence),
    check('period_definitions_times', sql`${t.endTime} > ${t.startTime}`),
  ],
);

export type TimetableValidation = {
  checkedAt: string;
  conflicts: Array<{ kind: 'teacher' | 'room' | 'student'; weekday: number; periodId: string; lessonIds: string[]; detail: string }>;
};

export const timetableVersions = app.table(
  'timetable_versions',
  {
    ...tenantColumns(),
    academicYearId: uuid('academic_year_id').notNull(),
    name: text('name').notNull(),
    status: timetableStatus('status').notNull().default('draft'),
    effectiveFrom: day('effective_from'),
    effectiveTo: day('effective_to'),
    publishedAt: ts('published_at'),
    publishedByAccountId: uuid('published_by_account_id'),
    validation: jsonb('validation').$type<TimetableValidation>(),
    notes: text('notes'),
    version: version(),
  },
  (t) => [
    ...tenantConstraints('timetable_versions', t, schools),
    tfk('timetable_versions_year_fk', t.schoolId, t.academicYearId, academicYears),
    tfk('timetable_versions_publisher_fk', t.schoolId, t.publishedByAccountId, accounts),
    index('timetable_versions_year_idx').on(t.schoolId, t.academicYearId, t.status),
  ],
);

export const timetableLessons = app.table(
  'timetable_lessons',
  {
    ...tenantColumns(),
    timetableVersionId: uuid('timetable_version_id').notNull(),
    weekday: smallint('weekday').notNull(),
    periodDefinitionId: uuid('period_definition_id').notNull(),
    teachingGroupId: uuid('teaching_group_id').notNull(),
    teacherId: uuid('teacher_id').notNull(),
    roomId: uuid('room_id'),
  },
  (t) => [
    ...tenantConstraints('timetable_lessons', t, schools),
    tfk('timetable_lessons_version_fk', t.schoolId, t.timetableVersionId, timetableVersions, 'cascade'),
    tfk('timetable_lessons_period_fk', t.schoolId, t.periodDefinitionId, periodDefinitions),
    tfk('timetable_lessons_group_fk', t.schoolId, t.teachingGroupId, teachingGroups),
    tfk('timetable_lessons_teacher_fk', t.schoolId, t.teacherId, teachers),
    tfk('timetable_lessons_room_fk', t.schoolId, t.roomId, rooms),
    check('timetable_lessons_weekday', sql`${t.weekday} between 1 and 7`),
    uniqueIndex('timetable_lessons_group_slot_uk').on(t.timetableVersionId, t.weekday, t.periodDefinitionId, t.teachingGroupId),
    // A teacher and a room can only be in one place at a time. Student conflicts are checked by the service.
    uniqueIndex('timetable_lessons_teacher_slot_uk').on(t.timetableVersionId, t.weekday, t.periodDefinitionId, t.teacherId),
    uniqueIndex('timetable_lessons_room_slot_uk')
      .on(t.timetableVersionId, t.weekday, t.periodDefinitionId, t.roomId)
      .where(sql`${t.roomId} is not null`),
    index('timetable_lessons_teacher_idx').on(t.schoolId, t.teacherId),
  ],
);

/** Date-specific cancellation, substitution or room change. */
export const lessonExceptions = app.table(
  'lesson_exceptions',
  {
    ...tenantColumns(),
    timetableLessonId: uuid('timetable_lesson_id').notNull(),
    date: day('date').notNull(),
    kind: lessonExceptionKind('kind').notNull(),
    substituteTeacherId: uuid('substitute_teacher_id'),
    roomId: uuid('room_id'),
    note: text('note'),
    createdByAccountId: uuid('created_by_account_id'),
  },
  (t) => [
    ...tenantConstraints('lesson_exceptions', t, schools),
    tfk('lesson_exceptions_lesson_fk', t.schoolId, t.timetableLessonId, timetableLessons),
    tfk('lesson_exceptions_substitute_fk', t.schoolId, t.substituteTeacherId, teachers),
    tfk('lesson_exceptions_room_fk', t.schoolId, t.roomId, rooms),
    uniqueIndex('lesson_exceptions_uk').on(t.schoolId, t.timetableLessonId, t.date),
    check(
      'lesson_exceptions_substitute_required',
      sql`${t.kind} <> 'substitution' or ${t.substituteTeacherId} is not null`,
    ),
  ],
);
