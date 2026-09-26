import { and, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { Announcement, AudienceSpec, NotificationItem } from '@edventure/contracts';
import { createAnnouncementRequest, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  announcementAttachments,
  announcementAudiences,
  announcements,
  deviceTokens,
  files,
  notificationRecipients,
  notifications,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import type { JobQueue } from '../../jobs/queue';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { classTeacherSectionIds, teacherGroupIds, today } from '../../platform/scope';
import { resolveAudience } from './audience';

export interface NotifyInput {
  kind: string;
  data?: Record<string, unknown>;
  recipients: string[];
  entityType?: string;
  entityId?: string;
  link?: string;
  /** Prevents duplicate notifications for the same event (e.g. reminders). */
  dedupeKey?: string;
  push?: boolean;
}

type AnnouncementRow = typeof announcements.$inferSelect;

export class CommunicationsService {
  constructor(
    private readonly db: Db,
    private readonly jobs: JobQueue,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /**
   * Creates the durable in-app notification and its recipients inside the caller's transaction and
   * enqueues best-effort push delivery in the same transaction.
   */
  async notify(tx: Tx, actor: Actor, input: NotifyInput): Promise<string | null> {
    const recipients = [...new Set(input.recipients)].filter((id) => id !== actor.accountId || input.kind.startsWith('report'));
    if (recipients.length === 0) return null;
    const [row] = await tx
      .insert(notifications)
      .values({
        schoolId: actor.schoolId,
        kind: input.kind,
        data: input.data ?? {},
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        link: input.link ?? null,
        dedupeKey: input.dedupeKey ?? null,
        createdByAccountId: actor.client === 'system' ? null : actor.accountId,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    if (!row) return null; // duplicate event
    for (let i = 0; i < recipients.length; i += 1000) {
      await tx.insert(notificationRecipients).values(
        recipients.slice(i, i + 1000).map((accountId) => ({ schoolId: actor.schoolId, notificationId: row.id, accountId })),
      );
    }
    if (input.push !== false) {
      await this.jobs.enqueue(tx, 'notificationDeliver', { schoolId: actor.schoolId, notificationId: row.id });
    }
    return row.id;
  }

  /* ---------------- Announcements ---------------- */

  /** Admins broadcast anywhere; class teachers to their sections; teachers to their teaching groups. */
  private async assertCanTarget(tx: Tx, actor: Actor, audiences: AudienceSpec[]) {
    if (isAdmin(actor)) return;
    if (!actor.teacherId) throw errors.forbidden();
    const date = today(actor);
    const [sections, groups] = await Promise.all([
      classTeacherSectionIds(tx, actor.teacherId, date),
      teacherGroupIds(tx, actor.teacherId, date),
    ]);
    for (const a of audiences) {
      const allowed =
        (a.target === 'section' && a.sectionId && sections.includes(a.sectionId)) ||
        (a.target === 'teaching_group' && a.teachingGroupId && groups.includes(a.teachingGroupId));
      if (!allowed) throw errors.forbidden('Teachers can only send notices to their own sections and teaching groups');
    }
  }

  async createAnnouncement(actor: Actor, raw: z.input<typeof createAnnouncementRequest>): Promise<Announcement> {
    const input = createAnnouncementRequest.parse(raw);
    return this.run(actor, async (tx) => {
      await this.assertCanTarget(tx, actor, input.audiences);
      const [row] = await tx
        .insert(announcements)
        .values({
          schoolId: actor.schoolId,
          title: input.title,
          titleUr: input.titleUr ?? null,
          body: input.body,
          bodyUr: input.bodyUr ?? null,
          category: input.category,
          createdByAccountId: actor.accountId,
        })
        .returning();
      await tx.insert(announcementAudiences).values(
        input.audiences.map((a) => ({
          schoolId: actor.schoolId,
          announcementId: row!.id,
          target: a.target,
          role: a.role ?? null,
          classOfferingId: a.classOfferingId ?? null,
          sectionId: a.sectionId ?? null,
          teachingGroupId: a.teachingGroupId ?? null,
        })),
      );
      if (input.attachmentFileIds.length) {
        const usable = await tx
          .select({ id: files.id })
          .from(files)
          .where(and(inArray(files.id, input.attachmentFileIds), inArray(files.lifecycle, ['quarantine', 'available'])));
        if (usable.length !== input.attachmentFileIds.length) throw errors.field('attachmentFileIds', 'An attachment is missing or was rejected');
        await tx.insert(announcementAttachments).values(
          input.attachmentFileIds.map((fileId) => ({ schoolId: actor.schoolId, announcementId: row!.id, fileId })),
        );
      }
      await audit(tx, actor, { action: 'announcement.created', entityType: 'announcement', entityId: row!.id });
      if (input.publish) await this.publishInTx(tx, actor, row!);
      return this.load(tx, row!.id);
    });
  }

  async publishAnnouncement(actor: Actor, announcementId: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(announcements).where(eq(announcements.id, announcementId)).for('update');
      const ann = required(row, 'Announcement');
      if (!isAdmin(actor) && ann.createdByAccountId !== actor.accountId) throw errors.forbidden();
      if (ann.state !== 'draft') throw errors.rule('Only drafts can be published');
      await this.publishInTx(tx, actor, ann);
      return this.load(tx, announcementId);
    });
  }

  /** Recipients are snapshotted at publication; later roster changes do not alter who received it. */
  private async publishInTx(tx: Tx, actor: Actor, ann: AnnouncementRow) {
    const audienceRows = await tx.select().from(announcementAudiences).where(eq(announcementAudiences.announcementId, ann.id));
    const audiences = audienceRows.map((a) => ({
      target: a.target,
      role: a.role,
      classOfferingId: a.classOfferingId,
      sectionId: a.sectionId,
      teachingGroupId: a.teachingGroupId,
    })) as AudienceSpec[];
    await this.assertCanTarget(tx, actor, audiences);
    const recipients = await resolveAudience(tx, audiences, today(actor));
    await tx
      .update(announcements)
      .set({ state: 'published', publishedAt: new Date(), recipientCount: recipients.length })
      .where(eq(announcements.id, ann.id));
    await this.notify(tx, actor, {
      kind: 'announcement.published',
      data: { title: ann.title, titleUr: ann.titleUr, category: ann.category },
      recipients,
      entityType: 'announcement',
      entityId: ann.id,
      link: `/announcements/${ann.id}`,
      dedupeKey: `announcement:${ann.id}`,
    });
    await audit(tx, actor, {
      action: 'announcement.published',
      entityType: 'announcement',
      entityId: ann.id,
      summary: { recipients: recipients.length },
    });
  }

  async archiveAnnouncement(actor: Actor, announcementId: string) {
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(announcements)
        .set({ state: 'archived' })
        .where(
          and(
            eq(announcements.id, announcementId),
            isAdmin(actor) ? undefined : eq(announcements.createdByAccountId, actor.accountId),
          ),
        )
        .returning({ id: announcements.id });
      if (!rows.length) throw errors.notFound('Announcement');
      await audit(tx, actor, { action: 'announcement.archived', entityType: 'announcement', entityId: announcementId });
    });
  }

  /** Admins see all; others see what they authored or received. */
  async listAnnouncements(actor: Actor, query: { cursor?: string; limit: number; state?: string; category?: string }) {
    return this.run(actor, async (tx) => {
      const cursor = decodeCursor(query.cursor, 2) as [string, string] | null;
      const visibility = isAdmin(actor)
        ? undefined
        : or(
            eq(announcements.createdByAccountId, actor.accountId),
            sql`exists (select 1 from app.notification_recipients r join app.notifications n on n.id = r.notification_id
                 where n.entity_type = 'announcement' and n.entity_id = ${announcements.id} and r.account_id = ${actor.accountId})`,
          );
      const rows = await tx
        .select({ id: announcements.id, createdAt: announcements.createdAt })
        .from(announcements)
        .where(
          and(
            visibility,
            query.state ? eq(announcements.state, query.state as never) : isAdmin(actor) ? undefined : eq(announcements.state, 'published'),
            query.category ? eq(announcements.category, query.category as never) : undefined,
            cursor
              ? or(
                  lt(announcements.createdAt, new Date(cursor[0])),
                  and(eq(announcements.createdAt, new Date(cursor[0])), lt(announcements.id, cursor[1])),
                )
              : undefined,
          ),
        )
        .orderBy(desc(announcements.createdAt), desc(announcements.id))
        .limit(query.limit + 1);
      const pageRows = rows.slice(0, query.limit);
      const items = await Promise.all(pageRows.map((r) => this.load(tx, r.id)));
      const last = pageRows[pageRows.length - 1];
      return {
        items,
        nextCursor: rows.length > query.limit && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
      };
    });
  }

  async getAnnouncement(actor: Actor, announcementId: string) {
    return this.run(actor, async (tx) => {
      const ann = await this.load(tx, announcementId);
      if (!isAdmin(actor) && ann.createdBy.accountId !== actor.accountId) {
        const [received] = await tx.execute<{ ok: boolean }>(sql`
          select exists (select 1 from app.notification_recipients r join app.notifications n on n.id = r.notification_id
            where n.entity_type = 'announcement' and n.entity_id = ${announcementId} and r.account_id = ${actor.accountId}) as ok`);
        if (!received?.ok) throw errors.notFound('Announcement');
      }
      return ann;
    });
  }

  private async load(tx: Tx, announcementId: string): Promise<Announcement> {
    const [row] = await tx
      .select({ a: announcements, creatorName: accounts.displayName })
      .from(announcements)
      .innerJoin(accounts, eq(accounts.id, announcements.createdByAccountId))
      .where(eq(announcements.id, announcementId));
    const found = required(row, 'Announcement');
    const [aud, att] = await Promise.all([
      tx.select().from(announcementAudiences).where(eq(announcementAudiences.announcementId, announcementId)),
      tx
        .select({ f: files })
        .from(announcementAttachments)
        .innerJoin(files, eq(files.id, announcementAttachments.fileId))
        .where(eq(announcementAttachments.announcementId, announcementId)),
    ]);
    const a = found.a;
    return {
      id: a.id,
      title: a.title,
      titleUr: a.titleUr,
      body: a.body,
      bodyUr: a.bodyUr,
      category: a.category,
      state: a.state,
      publishedAt: a.publishedAt?.toISOString() ?? null,
      createdBy: { accountId: a.createdByAccountId, displayName: found.creatorName },
      audiences: aud.map((x) => ({
        target: x.target,
        role: x.role,
        classOfferingId: x.classOfferingId,
        sectionId: x.sectionId,
        teachingGroupId: x.teachingGroupId,
      })),
      recipientCount: a.recipientCount,
      attachments: att.map(({ f }) => ({
        id: f.id,
        name: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        available: f.lifecycle === 'available',
      })),
      createdAt: a.createdAt.toISOString(),
    };
  }

  /* ---------------- Inbox ---------------- */

  async inbox(actor: Actor, query: { cursor?: string; limit: number; unreadOnly?: string }) {
    return this.run(actor, async (tx) => {
      const cursor = decodeCursor(query.cursor, 2) as [string, string] | null;
      const rows = await tx
        .select({ r: notificationRecipients, n: notifications })
        .from(notificationRecipients)
        .innerJoin(notifications, eq(notifications.id, notificationRecipients.notificationId))
        .where(
          and(
            eq(notificationRecipients.accountId, actor.accountId),
            isNull(notificationRecipients.archivedAt),
            query.unreadOnly === 'true' ? isNull(notificationRecipients.readAt) : undefined,
            cursor
              ? or(
                  lt(notificationRecipients.createdAt, new Date(cursor[0])),
                  and(eq(notificationRecipients.createdAt, new Date(cursor[0])), lt(notificationRecipients.id, cursor[1])),
                )
              : undefined,
          ),
        )
        .orderBy(desc(notificationRecipients.createdAt), desc(notificationRecipients.id))
        .limit(query.limit + 1);
      const [unread] = await tx
        .select({ n: count() })
        .from(notificationRecipients)
        .where(and(eq(notificationRecipients.accountId, actor.accountId), isNull(notificationRecipients.readAt), isNull(notificationRecipients.archivedAt)));
      const page = rows.slice(0, query.limit);
      const last = page[page.length - 1];
      const items: NotificationItem[] = page.map(({ r, n }) => ({
        id: r.id,
        notificationId: n.id,
        kind: n.kind,
        data: n.data,
        link: n.link,
        entityType: n.entityType,
        entityId: n.entityId,
        createdAt: r.createdAt.toISOString(),
        readAt: r.readAt?.toISOString() ?? null,
      }));
      return {
        items,
        nextCursor: rows.length > query.limit && last ? encodeCursor([last.r.createdAt.toISOString(), last.r.id]) : null,
        unreadCount: unread?.n ?? 0,
      };
    });
  }

  async markRead(actor: Actor, input: { ids?: string[]; all?: boolean }) {
    await this.run(actor, (tx) =>
      tx
        .update(notificationRecipients)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notificationRecipients.accountId, actor.accountId),
            isNull(notificationRecipients.readAt),
            input.all ? undefined : inArray(notificationRecipients.id, input.ids?.length ? input.ids : ['00000000-0000-0000-0000-000000000000']),
          ),
        ),
    );
  }

  /* ---------------- Devices ---------------- */

  async registerDevice(actor: Actor, input: { expoPushToken: string; platform: string; locale: 'en' | 'ur' }) {
    await this.run(actor, async (tx) => {
      // A token moves with the device: re-registering under a new account retires the old binding.
      await tx
        .update(deviceTokens)
        .set({ retiredAt: new Date(), retiredReason: 'reassigned' })
        .where(and(eq(deviceTokens.expoPushToken, input.expoPushToken), sql`${deviceTokens.accountId} <> ${actor.accountId}`));
      await tx
        .insert(deviceTokens)
        .values({
          schoolId: actor.schoolId,
          accountId: actor.accountId,
          appSessionId: actor.appSessionId,
          expoPushToken: input.expoPushToken,
          platform: input.platform,
          locale: input.locale,
        })
        .onConflictDoUpdate({
          target: [deviceTokens.schoolId, deviceTokens.expoPushToken],
          set: {
            accountId: actor.accountId,
            appSessionId: actor.appSessionId,
            locale: input.locale,
            lastSeenAt: new Date(),
            retiredAt: null,
            retiredReason: null,
          },
        });
    });
  }

  async unregisterDevice(actor: Actor, expoPushToken: string) {
    await this.run(actor, (tx) =>
      tx
        .update(deviceTokens)
        .set({ retiredAt: new Date(), retiredReason: 'unregistered' })
        .where(and(eq(deviceTokens.expoPushToken, expoPushToken), eq(deviceTokens.accountId, actor.accountId))),
    );
  }
}
