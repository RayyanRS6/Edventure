import { z } from 'zod';
import { id, isoDate, isoDateTime, nonEmpty, timeOfDay, versioned, weekday } from './common';
import { lessonExceptionKinds, periodKinds, timetableStatuses } from './domain';

export const periodDefinition = z.object({
  id,
  academicYearId: id,
  sequence: z.number().int(),
  name: z.string(),
  startTime: timeOfDay,
  endTime: timeOfDay,
  kind: z.enum(periodKinds),
});
export type PeriodDefinition = z.infer<typeof periodDefinition>;

export const createPeriodRequest = z
  .object({
    academicYearId: id,
    sequence: z.number().int().min(1).max(20),
    name: nonEmpty(40),
    startTime: timeOfDay,
    endTime: timeOfDay,
    kind: z.enum(periodKinds).default('lesson'),
  })
  .refine((p) => p.endTime > p.startTime, { path: ['endTime'], message: 'End time must be after start time' });
export const updatePeriodRequest = z.object({
  name: nonEmpty(40).optional(),
  startTime: timeOfDay.optional(),
  endTime: timeOfDay.optional(),
  kind: z.enum(periodKinds).optional(),
});

export const conflict = z.object({
  kind: z.enum(['teacher', 'room', 'student']),
  weekday: z.number().int(),
  periodId: id,
  lessonIds: z.array(id),
  detail: z.string(),
});

export const timetableVersion = z.object({
  id,
  academicYearId: id,
  name: z.string(),
  status: z.enum(timetableStatuses),
  effectiveFrom: isoDate.nullable(),
  effectiveTo: isoDate.nullable(),
  publishedAt: isoDateTime.nullable(),
  lessonCount: z.number().int(),
  conflicts: z.array(conflict).nullable(),
  validatedAt: isoDateTime.nullable(),
  version: z.number().int(),
});
export type TimetableVersion = z.infer<typeof timetableVersion>;

export const createTimetableVersionRequest = z.object({
  academicYearId: id,
  name: nonEmpty(100),
  copyFromVersionId: id.nullish(),
});

export const lesson = z.object({
  id,
  weekday,
  periodId: id,
  teachingGroupId: id,
  groupName: z.string(),
  subjectName: z.string(),
  subjectNameUr: z.string().nullable(),
  sectionId: id.nullable(),
  sectionName: z.string().nullable(),
  gradeName: z.string(),
  teacherId: id,
  teacherName: z.string(),
  roomId: id.nullable(),
  roomName: z.string().nullable(),
});
export type Lesson = z.infer<typeof lesson>;

export const timetableDetail = timetableVersion.extend({
  periods: z.array(periodDefinition),
  lessons: z.array(lesson),
});

export const upsertLessonRequest = z.object({
  weekday,
  periodDefinitionId: id,
  teachingGroupId: id,
  /** Defaults to the group's primary assigned teacher. */
  teacherId: id.nullish(),
  roomId: id.nullish(),
});

export const publishTimetableRequest = versioned.extend({ effectiveFrom: isoDate });

export const lessonException = z.object({
  id,
  timetableLessonId: id,
  date: isoDate,
  kind: z.enum(lessonExceptionKinds),
  substituteTeacherId: id.nullable(),
  substituteTeacherName: z.string().nullable(),
  roomId: id.nullable(),
  note: z.string().nullable(),
});
export const createLessonExceptionRequest = z
  .object({
    timetableLessonId: id,
    date: isoDate,
    kind: z.enum(lessonExceptionKinds),
    substituteTeacherId: id.nullish(),
    roomId: id.nullish(),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((e) => e.kind !== 'substitution' || !!e.substituteTeacherId, { path: ['substituteTeacherId'], message: 'Choose the substitute teacher' })
  .refine((e) => e.kind !== 'room_change' || !!e.roomId, { path: ['roomId'], message: 'Choose the new room' });

/** A day as the teacher or student experiences it: published lessons with date-specific changes applied. */
export const dayLesson = lesson.extend({
  startTime: timeOfDay,
  endTime: timeOfDay,
  periodName: z.string(),
  status: z.enum(['scheduled', 'cancelled', 'substituted', 'room_changed']),
  note: z.string().nullable(),
  /** True when this lesson is taught by the viewer as a substitute. */
  asSubstitute: z.boolean(),
});
export type DayLesson = z.infer<typeof dayLesson>;
export const daySchedule = z.object({
  date: isoDate,
  instructional: z.boolean(),
  calendarNote: z.string().nullable(),
  lessons: z.array(dayLesson),
});
export type DaySchedule = z.infer<typeof daySchedule>;

export const weekScheduleQuery = z.object({
  studentId: id.optional(),
  teacherId: id.optional(),
  sectionId: id.optional(),
  date: isoDate.optional(),
});
export const weekSchedule = z.object({
  versionId: id.nullable(),
  effectiveFrom: isoDate.nullable(),
  periods: z.array(periodDefinition),
  lessons: z.array(lesson),
});
export type WeekSchedule = z.infer<typeof weekSchedule>;
