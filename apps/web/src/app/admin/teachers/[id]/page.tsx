'use client';

import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeacherDetail, z } from '@edventure/contracts';
import { compensationRecord, endEmploymentResponse } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { AccountActions } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, DefinitionList, Grid, PageHeader } from '@/components/ui/layout';
import { EmptyState, ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { accountTone, formatDate, formatMoney, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

export default function TeacherPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<TeacherDetail>(['teacher', id], `/teachers/${id}`);
  const [endOpen, setEndOpen] = useState(false);
  const [endDate, setEndDate] = useState(todayLocal());
  const [reason, setReason] = useState('');
  const [duties, setDuties] = useState<z.infer<typeof endEmploymentResponse>['unassignedDuties'] | null>(null);
  const end = useAction(() => api.post<z.infer<typeof endEmploymentResponse>>(`/teachers/${id}/end-employment`, { endDate, reason }), {
    invalidate: [['teacher', id], ['teachers']],
    onSuccess: (r) => {
      setEndOpen(false);
      setDuties(r.unassignedDuties);
    },
  });
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const te = q.data;
  const name = localized(lang, te.displayName, te.displayNameUr);
  return (
    <>
      <PageHeader
        back={<Link href="/admin/teachers" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.teachers')}</Link>}
        title={name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{te.employeeNumber}</span>
            <Badge tone={accountTone[te.accountStatus]}>{t(`web.status.${te.accountStatus}`)}</Badge>
            {te.isAdmin && <Badge tone="info">{t('roles.school_admin')}</Badge>}
          </span>
        }
        actions={
          <>
            <AccountActions account={te.account} name={name} invalidate={[['teacher', id], ['teachers']]} />
            {te.employmentStatus !== 'ended' && <Button variant="ghost" onClick={() => setEndOpen(true)}>{t('web.people.endEmployment')}</Button>}
          </>
        }
      />
      {duties && (
        <Card title={t('web.people.dutiesToReassign')} className="mb-4">
          {duties.length === 0 ? (
            <p className="text-muted">{t('web.people.noDuties')}</p>
          ) : (
            <ul className="list-disc space-y-1 ps-5">
              {duties.map((d) => (
                <li key={d.kind + d.id}>
                  {d.label}{' '}
                  <Link className="text-accent-700 hover:underline" href={d.kind === 'timetable_lesson' ? '/admin/timetable' : '/admin/teaching'}>
                    {t('web.people.reassign')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Grid cols={2}>
        <Card title={t('web.people.personal')}>
          <DefinitionList
            items={[
              [t('auth.username'), <span dir="ltr">{te.username}</span>],
              [t('web.people.jobTitle'), te.jobTitle],
              [t('web.common.phone'), te.phone && <span dir="ltr">{te.phone}</span>],
              [t('web.common.email'), te.email],
              [t('web.people.qualifications'), te.qualifications],
              [t('roles.classTeacher'), te.classTeacherOf.map((c) => c.sectionName).join(', ') || null],
            ]}
          />
        </Card>
        <Card title={t('web.people.teachingAssignments')} padded={false}>
          {te.assignments.length === 0 ? (
            <EmptyState title={t('web.people.noAssignments')} />
          ) : (
            <DataTable
              rows={te.assignments}
              rowKey={(r) => r.id}
              columns={[
                { key: 'g', header: t('web.nav.teaching'), cell: (r) => r.teachingGroupName },
                { key: 's', header: t('web.common.subject'), cell: (r) => r.subjectName },
                { key: 'd', header: t('web.common.startDate'), cell: (r) => formatDate(r.startDate, lang) },
              ]}
            />
          )}
        </Card>
        <Card title={t('web.people.employmentHistory')} padded={false}>
          <DataTable
            rows={te.employment}
            rowKey={(r) => r.id}
            columns={[
              { key: 'j', header: t('web.people.jobTitle'), cell: (r) => r.jobTitle ?? '—' },
              { key: 's', header: t('web.common.startDate'), cell: (r) => formatDate(r.startDate, lang) },
              { key: 'e', header: t('web.common.endDate'), cell: (r) => formatDate(r.endDate, lang) },
              { key: 'st', header: t('common.status'), cell: (r) => <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
            ]}
          />
        </Card>
        <Salary teacherId={id} />
      </Grid>
      <Dialog open={endOpen} onClose={() => setEndOpen(false)} title={t('web.people.endEmployment')} footer={<Button variant="danger" loading={end.isPending} disabled={reason.trim().length < 3} onClick={() => end.mutate(undefined)}>{t('common.confirm')}</Button>}>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted">{t('web.people.endEmploymentHint')}</p>
          <TextField label={t('web.common.endDate')} type="date" value={endDate} onValue={setEndDate} />
          <TextField label={t('web.common.reason')} value={reason} onValue={setReason} />
          <InlineError error={end.error} />
        </div>
      </Dialog>
    </>
  );
}

/** Confidential: visible to administrators only (also enforced by the database). */
function Salary({ teacherId }: { teacherId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof compensationRecord>[] }>(['compensation', teacherId], `/teachers/${teacherId}/compensation`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ effectiveFrom: todayLocal(), amount: '', payFrequency: 'monthly', notes: '' });
  const add = useAction(() => api.post(`/teachers/${teacherId}/compensation`, { ...f, notes: f.notes || null }), {
    invalidate: [['compensation', teacherId]],
    success: t('web.common.updated'),
    onSuccess: () => setOpen(false),
  });
  return (
    <Card title={<span className="inline-flex items-center gap-2"><Lock size={14} /> {t('web.people.salary')}</span>} actions={<Button size="sm" onClick={() => setOpen(true)}>{t('web.people.recordSalary')}</Button>} padded={false}>
      <DataTable
        rows={q.data?.items ?? []}
        rowKey={(r) => r.id}
        empty={<EmptyState title={t('web.people.noSalary')} />}
        columns={[
          { key: 'f', header: t('web.common.effectiveDate'), cell: (r) => formatDate(r.effectiveFrom, lang) },
          { key: 't', header: t('web.common.endDate'), cell: (r) => formatDate(r.effectiveTo, lang) },
          { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.amount, r.currency) },
          { key: 'p', header: t('web.people.frequency'), cell: (r) => t(`web.people.${r.payFrequency}`) },
        ]}
      />
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.people.recordSalary')} footer={<Button variant="primary" loading={add.isPending} onClick={() => add.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.effectiveDate')} type="date" value={f.effectiveFrom} onValue={(v) => setF({ ...f, effectiveFrom: v })} />
          <TextField label={`${t('fees.amount')} (PKR)`} value={f.amount} onValue={(v) => setF({ ...f, amount: v.replace(/[^\d.]/g, '') })} dir="ltr" />
          <SelectField label={t('web.people.frequency')} value={f.payFrequency} onValue={(v) => setF({ ...f, payFrequency: v })} options={[{ value: 'monthly', label: t('web.people.monthly') }, { value: 'annual', label: t('web.people.annual') }]} />
          <TextField label={t('web.common.note')} value={f.notes} onValue={(v) => setF({ ...f, notes: v })} />
          <InlineError error={add.error} />
        </div>
      </Dialog>
    </Card>
  );
}
