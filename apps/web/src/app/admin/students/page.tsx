'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Page, StudentListItem } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { Button, LinkButton } from '@/components/ui/button';
import { Input, SelectField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { ErrorState, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { accountTone } from '@/lib/format';
import { useActiveYear, useLang, useSectionOptions } from '@/lib/hooks';

function StudentsList() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const [q, setQ] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [fees, setFees] = useState('');
  const [accountStatus, setAccountStatus] = useState(params.get('accountStatus') ?? '');
  const [minPercentage, setMinPercentage] = useState('');
  const filters = { q: q.trim() || undefined, sectionId: sectionId || undefined, fees: fees || undefined, accountStatus: accountStatus || undefined, minPercentage: minPercentage || undefined, limit: 50 };
  const list = useInfiniteQuery({
    queryKey: ['students', filters],
    queryFn: ({ pageParam }) => api.get<Page<StudentListItem>>('/students', { query: { ...filters, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader
        title={t('nav.students')}
        subtitle={year ? year.name : undefined}
        actions={
          <>
            <LinkButton href="/admin/imports?kind=students" icon={<Upload size={16} />}>
              {t('common.import')}
            </LinkButton>
            <LinkButton href="/admin/students/new" variant="primary" icon={<Plus size={16} />}>
              {t('web.people.addStudent')}
            </LinkButton>
          </>
        }
      />
      <Toolbar>
        <div className="min-w-64 flex-1">
          <label className="mb-1.5 block text-[13px] font-medium text-ink-soft" htmlFor="student-search">
            {t('common.search')}
          </label>
          <Input id="student-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('web.people.searchStudents')} />
        </div>
        <SelectField className="w-48" label={t('web.common.section')} value={sectionId} onValue={setSectionId} placeholder={t('common.all')} options={sections.options} />
        <SelectField
          className="w-44"
          label={t('nav.fees')}
          value={fees}
          onValue={setFees}
          placeholder={t('common.all')}
          options={[
            { value: 'outstanding', label: t('web.people.feesOutstanding') },
            { value: 'overdue', label: t('fees.overdue') },
            { value: 'clear', label: t('web.people.feesClear') },
          ]}
        />
        <SelectField
          className="w-40"
          label={t('web.people.minPercentage')}
          value={minPercentage}
          onValue={setMinPercentage}
          placeholder={t('common.all')}
          options={['33', '50', '60', '70', '80'].map((v) => ({ value: v, label: `≥ ${v}%` }))}
        />
        <SelectField
          className="w-44"
          label={t('web.people.accountStatus')}
          value={accountStatus}
          onValue={setAccountStatus}
          placeholder={t('common.all')}
          options={['active', 'pending', 'suspended', 'disabled'].map((s) => ({ value: s, label: t(`web.status.${s}`) }))}
        />
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
            onRowClick={(r) => router.push(`/admin/students/${r.id}`)}
            columns={[
              {
                key: 'name',
                header: t('web.common.name'),
                cell: (r) => (
                  <div>
                    <p className="font-medium">{localized(lang, r.displayName, r.displayNameUr)}</p>
                    <p className="text-[12px] text-muted" dir="ltr">
                      {r.username}
                    </p>
                  </div>
                ),
              },
              { key: 'adm', header: t('web.people.admissionNumber'), cell: (r) => <span className="tabular">{r.admissionNumber}</span> },
              { key: 'class', header: t('web.common.class'), cell: (r) => (r.enrollment ? `${r.enrollment.gradeName} ${r.enrollment.sectionName ?? ''}` : '—') },
              { key: 'stream', header: t('web.common.stream'), cell: (r) => r.enrollment?.streamName ?? '—' },
              {
                key: 'status',
                header: t('common.status'),
                cell: (r) => (
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={accountTone[r.accountStatus]}>{t(`web.status.${r.accountStatus}`)}</Badge>
                    {r.suspended && <Badge tone="danger">{t('web.people.disciplinarySuspension')}</Badge>}
                  </div>
                ),
              },
            ]}
            footer={
              list.hasNextPage ? (
                <Button size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                  {t('common.loadMore')}
                </Button>
              ) : undefined
            }
          />
        )}
      </Card>
    </>
  );
}

export default function StudentsPage() {
  return (
    <Suspense>
      <StudentsList />
    </Suspense>
  );
}
