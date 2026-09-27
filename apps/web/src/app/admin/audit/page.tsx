'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { auditEvent, z } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useLang } from '@/lib/hooks';

type AuditEvent = z.infer<typeof auditEvent>;
type AuditPage = { items: AuditEvent[]; nextCursor: string | null };

export default function AuditPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const [filters, setFilters] = useState({ action: '', entityType: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [open, setOpen] = useState<string | null>(null);
  const query = Object.fromEntries(Object.entries(applied).filter(([, v]) => v));
  const q = useInfiniteQuery({
    queryKey: ['audit', query],
    queryFn: ({ pageParam }) => api.get<AuditPage>('/audit-events', { query: { ...query, limit: 50, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title={t('nav.audit')} subtitle={t('web.audit.subtitle')} />
      <Toolbar>
        <TextField className="w-52" label={t('web.audit.action')} value={filters.action} onValue={(v) => setFilters({ ...filters, action: v.trim() })} placeholder="marks.saved" dir="ltr" />
        <TextField className="w-40" label={t('web.audit.entity')} value={filters.entityType} onValue={(v) => setFilters({ ...filters, entityType: v.trim() })} placeholder="student" dir="ltr" />
        <TextField className="w-40" label={t('common.from')} type="date" value={filters.from} onValue={(v) => setFilters({ ...filters, from: v })} />
        <TextField className="w-40" label={t('common.to')} type="date" value={filters.to} onValue={(v) => setFilters({ ...filters, to: v })} />
        <Button onClick={() => setApplied(filters)}>{t('web.common.apply')}</Button>
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t('common.noResults')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-sunken/60">
                  {[t('web.audit.when'), t('web.audit.who'), t('web.audit.action'), t('web.audit.entity'), t('web.common.reason')].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <Fragment key={e.id}>
                    <tr className="cursor-pointer border-b border-line hover:bg-sunken/60" onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[13px]">{formatDateTime(e.occurredAt, lang)}</td>
                      <td className="px-4 py-2.5">{e.actor ?? <span className="text-muted">{t('web.audit.system')}</span>}</td>
                      <td className="px-4 py-2.5"><code className="text-[12px]">{e.action}</code></td>
                      <td className="px-4 py-2.5 text-[13px] text-muted">{e.entityType}</td>
                      <td className="px-4 py-2.5 text-[13px]">
                        <span className="flex items-center justify-between gap-2">{e.reason ?? '—'}<ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open === e.id ? 'rotate-180' : ''}`} /></span>
                      </td>
                    </tr>
                    {open === e.id && (
                      <tr className="border-b border-line bg-sunken/40">
                        <td colSpan={5} className="px-4 py-3">
                          <pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-[12px]">{JSON.stringify({ entityId: e.entityId, requestId: e.requestId, ...e.summary }, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.hasNextPage && (
          <div className="border-t border-line px-5 py-3">
            <Button size="sm" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>{t('common.loadMore')}</Button>
          </div>
        )}
      </Card>
      <p className="mt-3 text-[13px] text-muted">{t('web.audit.hint')}</p>
    </>
  );
}
