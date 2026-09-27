'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Page, TeacherListItem } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { Button, LinkButton } from '@/components/ui/button';
import { Input, SelectField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { ErrorState, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { accountTone } from '@/lib/format';
import { useLang } from '@/lib/hooks';

export default function TeachersPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('');
  const filters = { q: q.trim() || undefined, employmentStatus: employmentStatus || undefined, limit: 50 };
  const list = useInfiniteQuery({
    queryKey: ['teachers', filters],
    queryFn: ({ pageParam }) => api.get<Page<TeacherListItem>>('/teachers', { query: { ...filters, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader
        title={t('nav.teachers')}
        actions={
          <>
            <LinkButton href="/admin/imports?kind=teachers" icon={<Upload size={16} />}>{t('common.import')}</LinkButton>
            <LinkButton href="/admin/teachers/new" variant="primary" icon={<Plus size={16} />}>{t('web.people.addTeacher')}</LinkButton>
          </>
        }
      />
      <Toolbar>
        <div className="min-w-64 flex-1">
          <label className="mb-1.5 block text-[13px] font-medium text-ink-soft" htmlFor="teacher-search">{t('common.search')}</label>
          <Input id="teacher-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('web.people.searchTeachers')} />
        </div>
        <SelectField className="w-48" label={t('web.people.employment')} value={employmentStatus} onValue={setEmploymentStatus} placeholder={t('common.all')} options={['active', 'on_leave', 'ended'].map((v) => ({ value: v, label: t(`web.status.${v}`) }))} />
      </Toolbar>
      <Card padded={false}>
        {list.isLoading ? (
          <LoadingBlock />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/teachers/${r.id}`)}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <div><p className="font-medium">{localized(lang, r.displayName, r.displayNameUr)}</p><p className="text-[12px] text-muted" dir="ltr">{r.username}</p></div> },
              { key: 'e', header: t('web.people.employeeNumber'), cell: (r) => <span className="tabular">{r.employeeNumber}</span> },
              { key: 'j', header: t('web.people.jobTitle'), cell: (r) => r.jobTitle ?? '—' },
              { key: 'c', header: t('roles.classTeacher'), cell: (r) => r.classTeacherOf.map((c) => c.sectionName).join(', ') || '—' },
              {
                key: 's',
                header: t('common.status'),
                cell: (r) => (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={accountTone[r.accountStatus]}>{t(`web.status.${r.accountStatus}`)}</Badge>
                    {r.isAdmin && <Badge tone="info">{t('roles.school_admin')}</Badge>}
                  </span>
                ),
              },
            ]}
            footer={list.hasNextPage ? <Button size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>{t('common.loadMore')}</Button> : undefined}
          />
        )}
      </Card>
    </>
  );
}
