'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationItem } from '@edventure/contracts';
import { pushText } from '@edventure/i18n';
import { Button } from '@/components/ui/button';
import { Card, PageHeader, Tabs } from '@/components/ui/layout';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useLang } from '@/lib/hooks';

type InboxPage = { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };

/** Notification links are app routes shared with mobile; map the ones the admin website handles. */
const adminSections = ['leave', 'announcements', 'reports', 'calendar', 'timetable', 'imports', 'results', 'exams', 'fees', 'attendance', 'students', 'teachers'];
function webRouteFor(link: string | null) {
  if (!link?.startsWith('/')) return null;
  const [path, query] = link.slice(1).split('?');
  const section = path?.split('/')[0] ?? '';
  if (!adminSections.includes(section)) return null;
  const detailSections = ['students', 'teachers', 'results', 'exams'];
  return `/admin/${detailSections.includes(section) ? path : section}${query ? `?${query}` : ''}`;
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const q = useInfiniteQuery({
    queryKey: ['notifications', 'inbox', filter],
    queryFn: ({ pageParam }) => api.get<InboxPage>('/notifications', { query: { limit: 30, cursor: pageParam, unreadOnly: filter === 'unread' ? 'true' : undefined } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const markRead = useAction((body: { ids?: string[]; all?: boolean }) => api.post('/notifications/read', body), { invalidate: [['notifications']] });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = q.data?.pages[0]?.unreadCount ?? 0;

  const openItem = (n: NotificationItem) => {
    if (!n.readAt) markRead.mutate({ ids: [n.id] });
    const route = webRouteFor(n.link);
    if (route) router.push(route);
    else void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <>
      <PageHeader
        title={t('nav.notifications')}
        subtitle={unread ? t('web.notifications.unread', { count: unread }) : undefined}
        actions={<Button icon={<CheckCheck size={16} />} disabled={!unread} loading={markRead.isPending && !!markRead.variables?.all} onClick={() => markRead.mutate({ all: true })}>{t('notifications.markAllRead')}</Button>}
      />
      <Tabs<'all' | 'unread'> value={filter} onChange={setFilter} tabs={[{ value: 'all', label: t('common.all') }, { value: 'unread', label: t('web.notifications.unreadTab') }]} />
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell size={22} />} title={t('notifications.empty')} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const text = pushText(lang, n.kind, n.data);
              return (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className={clsx('flex w-full items-start gap-3 px-5 py-3.5 text-start hover:bg-sunken/60', !n.readAt && 'bg-accent-50/50')}>
                    <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent-600')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block', !n.readAt && 'font-semibold')}>{text.title}</span>
                      <span className="block text-[13px] text-muted">{text.body}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-subtle">{formatDateTime(n.createdAt, lang)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {q.hasNextPage && (
          <div className="border-t border-line px-5 py-3">
            <Button size="sm" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t('common.loadMore')}</Button>
          </div>
        )}
      </Card>
    </>
  );
}
