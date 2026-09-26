import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { pushText, type AppLocale } from '@edventure/i18n';
import type { Db } from '../../db/client';
import { accounts, deviceTokens, notificationDeliveries, notificationRecipients, notifications } from '../../db/schema';
import { withTenant } from '../../db/tenant';

const EXPO_SEND = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS = 'https://exp.host/--/api/v2/push/getReceipts';

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export type PushTransport = (url: string, body: unknown) => Promise<{ data: unknown }>;

/**
 * Best-effort push through the Expo Push Service. The in-app notification is the durable record;
 * push text is localized per device and never contains marks, amounts or other sensitive details.
 */
export class PushService {
  constructor(
    private readonly db: Db,
    private readonly accessToken?: string,
    private readonly transport?: PushTransport,
  ) {}

  private async post(url: string, body: unknown) {
    if (this.transport) return this.transport(url, body);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (res.status >= 500 || res.status === 429) throw new Error(`Expo push service returned ${res.status}`);
    return (await res.json()) as { data: unknown };
  }

  async deliver(schoolId: string, notificationId: string) {
    const ctx = { schoolId, accountId: null, roles: [] as const };
    const targets = await withTenant(this.db, ctx, async (tx) => {
      const [n] = await tx.select().from(notifications).where(eq(notifications.id, notificationId));
      if (!n) return null;
      const rows = await tx
        .select({ recipientId: notificationRecipients.id, device: deviceTokens, accountLocale: accounts.locale })
        .from(notificationRecipients)
        .innerJoin(accounts, and(eq(accounts.id, notificationRecipients.accountId), eq(accounts.status, 'active')))
        .innerJoin(deviceTokens, and(eq(deviceTokens.accountId, notificationRecipients.accountId), isNull(deviceTokens.retiredAt)))
        .where(
          and(
            eq(notificationRecipients.notificationId, notificationId),
            sql`not exists (select 1 from app.notification_deliveries d where d.recipient_id = ${notificationRecipients.id}
              and d.device_token_id = ${deviceTokens.id} and d.status in ('sent', 'delivered', 'retired'))`,
          ),
        );
      return { n, rows };
    });
    if (!targets || !targets.rows.length) return { sent: 0 };
    const { n, rows } = targets;
    let sent = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const messages = chunk.map((r) => {
        const locale = (r.device.locale ?? r.accountLocale ?? 'en') as AppLocale;
        const text = pushText(locale, n.kind, { ...n.data, title: locale === 'ur' && n.data['titleUr'] ? n.data['titleUr'] : n.data['title'] });
        return { to: r.device.expoPushToken, title: text.title, body: text.body, sound: 'default', data: { notificationId: n.id, link: n.link } };
      });
      const response = await this.post(EXPO_SEND, messages);
      const tickets = (response.data as ExpoTicket[]) ?? [];
      await withTenant(this.db, ctx, async (tx) => {
        for (const [j, r] of chunk.entries()) {
          const ticket = tickets[j];
          const ok = ticket?.status === 'ok';
          const notRegistered = ticket?.details?.error === 'DeviceNotRegistered';
          await tx
            .insert(notificationDeliveries)
            .values({
              schoolId,
              recipientId: r.recipientId,
              deviceTokenId: r.device.id,
              status: ok ? 'sent' : notRegistered ? 'retired' : 'failed',
              ticketId: ticket?.id ?? null,
              attempts: 1,
              lastError: ok ? null : (ticket?.message ?? 'No ticket returned'),
              sentAt: ok ? new Date() : null,
            })
            .onConflictDoUpdate({
              target: [notificationDeliveries.schoolId, notificationDeliveries.recipientId, notificationDeliveries.deviceTokenId],
              set: {
                status: ok ? 'sent' : notRegistered ? 'retired' : 'failed',
                ticketId: ticket?.id ?? null,
                attempts: sql`${notificationDeliveries.attempts} + 1`,
                lastError: ok ? null : (ticket?.message ?? 'No ticket returned'),
                sentAt: ok ? new Date() : null,
              },
            });
          if (notRegistered) await tx.update(deviceTokens).set({ retiredAt: new Date(), retiredReason: 'DeviceNotRegistered' }).where(eq(deviceTokens.id, r.device.id));
          if (ok) sent++;
        }
      });
    }
    return { sent };
  }

  /** Checks Expo receipts for sent tickets and retires invalid device tokens. */
  async checkReceipts(schoolId: string) {
    const ctx = { schoolId, accountId: null, roles: [] as const };
    const pending = await withTenant(this.db, ctx, (tx) =>
      tx
        .select()
        .from(notificationDeliveries)
        .where(and(eq(notificationDeliveries.status, 'sent'), isNull(notificationDeliveries.receiptCheckedAt), lt(notificationDeliveries.sentAt, new Date(Date.now() - 15 * 60 * 1000))))
        .limit(1000),
    );
    for (let i = 0; i < pending.length; i += 300) {
      const chunk = pending.slice(i, i + 300).filter((d) => d.ticketId);
      if (!chunk.length) continue;
      const response = await this.post(EXPO_RECEIPTS, { ids: chunk.map((d) => d.ticketId) });
      const receipts = (response.data as Record<string, ExpoTicket>) ?? {};
      await withTenant(this.db, ctx, async (tx) => {
        for (const d of chunk) {
          const r = receipts[d.ticketId!];
          if (!r) continue;
          const notRegistered = r.details?.error === 'DeviceNotRegistered';
          await tx
            .update(notificationDeliveries)
            .set({ status: r.status === 'ok' ? 'delivered' : notRegistered ? 'retired' : 'failed', lastError: r.message ?? null, receiptCheckedAt: new Date() })
            .where(eq(notificationDeliveries.id, d.id));
          if (notRegistered) await tx.update(deviceTokens).set({ retiredAt: new Date(), retiredReason: 'DeviceNotRegistered' }).where(eq(deviceTokens.id, d.deviceTokenId));
        }
      });
    }
    return { checked: pending.length };
  }

  /** Transient failures are retried by re-running delivery for the failed rows' notifications. */
  async failedNotificationIds(schoolId: string) {
    const rows = await withTenant(this.db, { schoolId, accountId: null, roles: [] }, (tx) =>
      tx
        .selectDistinct({ id: notificationRecipients.notificationId })
        .from(notificationDeliveries)
        .innerJoin(notificationRecipients, eq(notificationRecipients.id, notificationDeliveries.recipientId))
        .where(and(eq(notificationDeliveries.status, 'failed'), lt(notificationDeliveries.attempts, 4))),
    );
    return rows.map((r) => r.id);
  }
}
