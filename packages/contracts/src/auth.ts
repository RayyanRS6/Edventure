import { z } from 'zod';
import { id, isoDateTime, locale } from './common';
import { experience, role, clientKind } from './roles';

export const schoolCode = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'School code may contain letters, digits and hyphens')
  .transform((v) => v.toUpperCase());

export const username = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, 'Username may contain letters, digits, dots, hyphens and underscores')
  .transform((v) => v.toLowerCase());

/** Minimum password policy shared by every client and the backend. */
export const newPassword = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');

export const loginRequest = z.object({
  schoolCode,
  username,
  password: z.string().min(1).max(256),
  deviceName: z.string().trim().max(100).optional(),
  platform: z.enum(['web', 'ios', 'android']).optional(),
});
export type LoginRequest = z.input<typeof loginRequest>;

export const sessionTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: isoDateTime,
});
export type SessionTokens = z.infer<typeof sessionTokens>;

export const nextStep = z.enum(['ready', 'change_password', 'mfa_enroll', 'mfa_verify']);
export type NextStep = z.infer<typeof nextStep>;

export const meSchool = z.object({
  id,
  code: z.string(),
  name: z.string(),
  nameUr: z.string().nullable(),
  timezone: z.string(),
  currency: z.string(),
  defaultLocale: locale,
});

export const me = z.object({
  accountId: id,
  username: z.string(),
  displayName: z.string(),
  displayNameUr: z.string().nullable(),
  locale,
  roles: z.array(role),
  experiences: z.array(experience),
  school: meSchool,
  studentId: id.nullable(),
  teacherId: id.nullable(),
  /** Sections this teacher currently leads as class teacher. */
  classTeacherSectionIds: z.array(id),
  mustChangePassword: z.boolean(),
  mfa: z.object({
    required: z.boolean(),
    enrolled: z.boolean(),
    verified: z.boolean(),
  }),
  sessionId: id,
});
export type Me = z.infer<typeof me>;

export const loginResponse = z.object({
  me,
  next: nextStep,
  /** Only returned to mobile clients. Web clients receive HttpOnly cookies instead. */
  tokens: sessionTokens.optional(),
});
export type LoginResponse = z.infer<typeof loginResponse>;

export const refreshRequest = z.object({ refreshToken: z.string().min(10).optional() });
export const refreshResponse = z.object({ tokens: sessionTokens.optional(), ok: z.literal(true) });

export const changePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword,
});

export const mfaEnrollResponse = z.object({
  factorId: z.string(),
  otpauthUri: z.string(),
  secret: z.string(),
});
export const mfaVerifyRequest = z.object({
  factorId: z.string().optional(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const sessionSummary = z.object({
  id,
  client: clientKind,
  deviceName: z.string().nullable(),
  platform: z.string().nullable(),
  createdAt: isoDateTime,
  lastSeenAt: isoDateTime,
  current: z.boolean(),
});
export type SessionSummary = z.infer<typeof sessionSummary>;

export const updatePreferencesRequest = z.object({ locale: locale.optional() });
