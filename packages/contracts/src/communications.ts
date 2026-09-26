import { z } from 'zod';
import { id, isoDateTime, locale, nonEmpty, optionalUrdu, page, pageQuery } from './common';
import { announcementCategories, announcementStates, audienceTargets } from './domain';
import { role } from './roles';

export const audienceSpec = z
  .object({
    target: z.enum(audienceTargets),
    role: role.nullish(),
    classOfferingId: id.nullish(),
    sectionId: id.nullish(),
    teachingGroupId: id.nullish(),
  })
  .refine(
    (a) =>
      (a.target === 'everyone') ||
      (a.target === 'role' && !!a.role) ||
      (a.target === 'class_offering' && !!a.classOfferingId) ||
      (a.target === 'section' && !!a.sectionId) ||
      (a.target === 'teaching_group' && !!a.teachingGroupId),
    { message: 'Choose who should receive this' },
  );
export type AudienceSpec = z.infer<typeof audienceSpec>;

export const fileRef = z.object({
  id,
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  available: z.boolean(),
});
export type FileRef = z.infer<typeof fileRef>;

export const announcement = z.object({
  id,
  title: z.string(),
  titleUr: z.string().nullable(),
  body: z.string(),
  bodyUr: z.string().nullable(),
  category: z.enum(announcementCategories),
  state: z.enum(announcementStates),
  publishedAt: isoDateTime.nullable(),
  createdBy: z.object({ accountId: id, displayName: z.string() }),
  audiences: z.array(audienceSpec),
  recipientCount: z.number().int().nullable(),
  attachments: z.array(fileRef),
  createdAt: isoDateTime,
});
export type Announcement = z.infer<typeof announcement>;

export const createAnnouncementRequest = z.object({
  title: nonEmpty(150),
  titleUr: optionalUrdu,
  body: nonEmpty(5000),
  bodyUr: z.string().trim().max(5000).nullish(),
  category: z.enum(announcementCategories).default('general'),
  audiences: z.array(audienceSpec).min(1).max(20),
  attachmentFileIds: z.array(id).max(5).default([]),
  publish: z.boolean().default(true),
});
export const announcementListQuery = pageQuery.extend({
  state: z.enum(announcementStates).optional(),
  category: z.enum(announcementCategories).optional(),
});
export const announcementPage = page(announcement);

export const notificationItem = z.object({
  id,
  notificationId: id,
  kind: z.string(),
  data: z.record(z.string(), z.unknown()),
  link: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: id.nullable(),
  createdAt: isoDateTime,
  readAt: isoDateTime.nullable(),
});
export type NotificationItem = z.infer<typeof notificationItem>;
export const notificationQuery = pageQuery.extend({ unreadOnly: z.enum(['true', 'false']).optional() });
export const notificationPage = page(notificationItem).extend({ unreadCount: z.number().int() });
export const markReadRequest = z.object({ ids: z.array(id).max(200).optional(), all: z.boolean().optional() });

export const registerDeviceRequest = z.object({
  expoPushToken: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, 'Invalid Expo push token'),
  platform: z.enum(['ios', 'android']),
  locale: locale.default('en'),
});
