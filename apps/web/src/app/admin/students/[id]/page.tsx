'use client';

import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeeStatement, StudentDetail, z } from '@edventure/contracts';
import { disciplinarySuspension, myResult, placementHistoryItem, streamChangePreview, studentAttendanceReport, subjectEnrollment } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { AccountActions } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, DefinitionList, Grid, PageHeader, Stat, Tabs } from '@/components/ui/layout';
import { EmptyState, ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, fieldError } from '@/lib/api';
import { accountTone, addDays, feeTone, formatDate, formatMoney, formatNumber, formatPercent, stateTone, todayLocal } from '@/lib/format';
import { useAction, useApi, useClasses, useLang, useStreams } from '@/lib/hooks';

type Tab = 'overview' | 'enrollment' | 'attendance' | 'results' | 'fees' | 'discipline';

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const [tab, setTab] = useState<Tab>('overview');
  const q = useApi<StudentDetail>(['student', id], `/students/${id}`);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;
  const name = localized(lang, s.displayName, s.displayNameUr);
  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/students" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.students')}
          </Link>
        }
        title={name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{s.admissionNumber}</span>
            {s.enrollment && <span>· {s.enrollment.gradeName} {s.enrollment.sectionName}</span>}
            <Badge tone={accountTone[s.accountStatus]}>{t(`web.status.${s.accountStatus}`)}</Badge>
            {s.suspended && <Badge tone="danger">{t('web.people.disciplinarySuspension')}</Badge>}
          </span>
        }
        actions={<AccountActions account={s.account} name={name} invalidate={[['student', id], ['students']]} />}
      />
      {s.deletion && (
        <p className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-danger-fg">{t('web.people.pendingDeletion', { date: formatDate(s.deletion.recoverUntil, lang) })}</p>
      )}
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: t('web.common.details') },
          { value: 'enrollment', label: t('web.people.enrollment') },
          { value: 'attendance', label: t('nav.attendance') },
          { value: 'results', label: t('nav.results') },
          { value: 'fees', label: t('nav.fees') },
          { value: 'discipline', label: t('web.people.discipline') },
        ]}
      />
      {tab === 'overview' && <Overview s={s} />}
      {tab === 'enrollment' && <Enrollment s={s} />}
      {tab === 'attendance' && <AttendanceTab s={s} />}
      {tab === 'results' && <ResultsTab studentId={s.id} />}
      {tab === 'fees' && <FeesTab studentId={s.id} />}
      {tab === 'discipline' && <Discipline studentId={s.id} />}
    </>
  );
}

function Overview({ s }: { s: StudentDetail }) {
  const { t } = useTranslation();
  const lang = useLang();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ displayName: s.displayName, displayNameUr: s.displayNameUr ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', dateOfBirth: s.dateOfBirth ?? '', notes: s.notes ?? '' });
  const save = useAction(
    () =>
      api.patch(`/students/${s.id}`, {
        version: s.version,
        displayName: f.displayName,
        displayNameUr: f.displayNameUr || null,
        phone: f.phone || null,
        email: f.email || null,
        address: f.address || null,
        dateOfBirth: f.dateOfBirth || null,
        notes: f.notes || null,
      }),
    { invalidate: [['student', s.id], ['students']], success: t('web.common.updated'), onSuccess: () => setEditing(false) },
  );
  return (
    <Grid cols={2}>
      <Card title={t('web.people.personal')} actions={<Button size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>{t('common.edit')}</Button>}>
        <DefinitionList
          items={[
            [t('web.common.name'), s.displayName],
            [t('web.common.nameUr'), s.displayNameUr],
            [t('auth.username'), <span dir="ltr">{s.username}</span>],
            [t('web.people.admissionDate'), formatDate(s.admissionDate, lang)],
            [t('web.common.dateOfBirth'), formatDate(s.dateOfBirth, lang)],
            [t('web.common.gender'), s.gender ? t(`web.common.${s.gender}`) : null],
            [t('web.common.phone'), s.phone && <span dir="ltr">{s.phone}</span>],
            [t('web.common.email'), s.email],
            [t('web.common.address'), s.address],
            [t('web.common.note'), s.notes],
          ]}
        />
      </Card>
      <Card title={t('web.people.guardians')}>
        {s.guardians.length === 0 ? (
          <EmptyState title={t('web.people.noGuardians')} />
        ) : (
          <ul className="flex flex-col gap-3">
            {s.guardians.map((g) => (
              <li key={g.id} className="rounded-lg border border-line p-3">
                <p className="font-medium">
                  {localized(lang, g.name, g.nameUr)} <span className="text-muted">· {g.relationship}</span>
                </p>
                <p className="text-[13px] text-muted" dir="ltr">
                  {[g.phone, g.altPhone, g.email].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-1 flex gap-1">
                  {g.isPrimary && <Badge tone="info">{t('web.people.primaryContact')}</Badge>}
                  {g.isEmergency && <Badge tone="warning">{t('web.people.emergencyContact')}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={t('common.edit')}
        footer={
          <>
            <Button onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <TextField label={t('web.common.name')} value={f.displayName} onValue={(v) => setF({ ...f, displayName: v })} error={fieldError(save.error, 'displayName')} />
          <TextField label={t('web.common.nameUr')} value={f.displayNameUr} onValue={(v) => setF({ ...f, displayNameUr: v })} dir="rtl" />
          <TextField label={t('web.common.phone')} value={f.phone} onValue={(v) => setF({ ...f, phone: v })} dir="ltr" error={fieldError(save.error, 'phone')} />
          <TextField label={t('web.common.email')} value={f.email} onValue={(v) => setF({ ...f, email: v })} dir="ltr" error={fieldError(save.error, 'email')} />
          <TextField label={t('web.common.address')} value={f.address} onValue={(v) => setF({ ...f, address: v })} />
          <TextField label={t('web.common.dateOfBirth')} type="date" value={f.dateOfBirth} onValue={(v) => setF({ ...f, dateOfBirth: v })} />
          <TextField label={t('web.common.note')} value={f.notes} onValue={(v) => setF({ ...f, notes: v })} />
          <InlineError error={save.error} />
        </div>
      </Dialog>
    </Grid>
  );
}

function Enrollment({ s }: { s: StudentDetail }) {
  const { t } = useTranslation();
  const lang = useLang();
  const current = s.enrollments.find((e) => e.status === 'active');
  const classes = useClasses(current?.academicYearId);
  const streams = useStreams();
  const placements = useApi<{ items: z.infer<typeof placementHistoryItem>[] }>(['student', s.id, 'placements'], `/students/${s.id}/placements`);
  const subjects = useApi<{ items: z.infer<typeof subjectEnrollment>[] }>(['student', s.id, 'subjects'], `/students/${s.id}/subject-enrollments`);
  const [dialog, setDialog] = useState<'section' | 'stream' | 'end' | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(addDays(todayLocal(), 1));
  const [endStatus, setEndStatus] = useState('withdrawn');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<z.infer<typeof streamChangePreview> | null>(null);
  const cls = classes.data?.items.find((c) => c.id === current?.classOfferingId);
  const invalidate = [['student', s.id], ['students']];
  const changeSection = useAction(() => api.post(`/students/${s.id}/section-change`, { sectionId, effectiveDate }), { invalidate, success: t('web.common.updated'), onSuccess: () => setDialog(null) });
  const streamAction = useAction(
    (apply: boolean) => api.post<z.infer<typeof streamChangePreview>>(`/students/${s.id}/stream-change`, { streamId, effectiveDate, apply }),
    { invalidate, onSuccess: (p) => (p.applied ? setDialog(null) : setPreview(p)) },
  );
  const end = useAction(() => api.post(`/students/${s.id}/enrollment/end`, { status: endStatus, endDate: effectiveDate, reason }), { invalidate, success: t('web.common.updated'), onSuccess: () => setDialog(null) });

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={t('web.people.currentEnrollment')}
        actions={
          current && (
            <>
              <Button size="sm" onClick={() => setDialog('section')}>{t('web.people.changeSection')}</Button>
              <Button size="sm" onClick={() => { setPreview(null); setDialog('stream'); }}>{t('web.people.changeStream')}</Button>
              <Button size="sm" variant="ghost" className="text-danger-fg" onClick={() => setDialog('end')}>{t('web.people.endEnrollment')}</Button>
            </>
          )
        }
      >
        {current ? (
          <DefinitionList
            items={[
              [t('web.common.year'), current.academicYearCode],
              [t('web.common.class'), current.gradeName],
              [t('web.common.section'), current.sectionName],
              [t('web.common.stream'), current.streamName],
              [t('web.common.startDate'), formatDate(current.startDate, lang)],
            ]}
          />
        ) : (
          <EmptyState title={t('web.people.notEnrolled')} />
        )}
      </Card>
      <Grid cols={2}>
        <Card title={t('nav.subjects')} padded={false}>
          <DataTable
            rows={subjects.data?.items ?? []}
            rowKey={(r) => r.id}
            columns={[
              { key: 's', header: t('web.common.subject'), cell: (r) => r.subjectName },
              { key: 'g', header: t('web.nav.teaching'), cell: (r) => r.teachingGroups.map((g) => g.name).join(', ') || '—' },
              { key: 'st', header: t('common.status'), cell: (r) => <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
            ]}
          />
        </Card>
        <Card title={t('web.common.history')} padded={false}>
          <DataTable
            rows={placements.data?.items ?? []}
            rowKey={(r) => r.id}
            columns={[
              { key: 'c', header: t('web.common.section'), cell: (r) => `${r.gradeName} ${r.sectionName}` },
              { key: 'f', header: t('web.common.startDate'), cell: (r) => formatDate(r.startDate, lang) },
              { key: 'e', header: t('web.common.endDate'), cell: (r) => formatDate(r.endDate, lang) },
              { key: 'r', header: t('web.common.reason'), cell: (r) => t(`web.placement.${r.reason}`) },
            ]}
          />
        </Card>
      </Grid>
      <Card title={t('web.people.allYears')} padded={false}>
        <DataTable
          rows={s.enrollments}
          rowKey={(r) => r.id}
          columns={[
            { key: 'y', header: t('web.common.year'), cell: (r) => r.academicYearCode },
            { key: 'c', header: t('web.common.class'), cell: (r) => `${r.gradeName} ${r.sectionName ?? ''}` },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.status] ?? 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
          ]}
        />
      </Card>

      <Dialog
        open={dialog === 'section'}
        onClose={() => setDialog(null)}
        title={t('web.people.changeSection')}
        footer={<Button variant="primary" loading={changeSection.isPending} disabled={!sectionId} onClick={() => changeSection.mutate(undefined)}>{t('common.save')}</Button>}
      >
        <div className="grid gap-3">
          <SelectField label={t('web.common.section')} value={sectionId} onValue={setSectionId} placeholder={t('web.common.select')} options={(cls?.sections ?? []).filter((x) => x.id !== current?.sectionId && !x.archived).map((x) => ({ value: x.id, label: `${cls!.gradeName} ${x.name}` }))} />
          <TextField label={t('web.common.effectiveDate')} type="date" value={effectiveDate} onValue={setEffectiveDate} hint={t('web.people.historyKept')} />
          <InlineError error={changeSection.error} />
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'stream'}
        onClose={() => setDialog(null)}
        title={t('web.people.changeStream')}
        footer={
          preview ? (
            <Button variant="primary" loading={streamAction.isPending} onClick={() => streamAction.mutate(true)}>{t('web.people.applyChange')}</Button>
          ) : (
            <Button variant="primary" loading={streamAction.isPending} disabled={!streamId} onClick={() => streamAction.mutate(false)}>{t('web.people.previewImpact')}</Button>
          )
        }
      >
        <div className="grid gap-3">
          <SelectField label={t('web.common.stream')} value={streamId} onValue={(v) => { setStreamId(v); setPreview(null); }} placeholder={t('web.common.select')} options={(streams.data?.items ?? []).filter((x) => !x.archived).map((x) => ({ value: x.id, label: x.name }))} />
          <TextField label={t('web.common.effectiveDate')} type="date" value={effectiveDate} onValue={(v) => { setEffectiveDate(v); setPreview(null); }} />
          {preview && (
            <div className="rounded-lg border border-line p-3 text-sm">
              <p className="font-medium">{t('web.people.impact')}</p>
              <ul className="mt-2 list-disc space-y-1 ps-5 text-ink-soft">
                {preview.addSubjects.map((x) => <li key={x.courseOfferingId}>+ {x.subjectName}</li>)}
                {preview.dropSubjects.map((x) => <li key={x.courseOfferingId}>− {x.subjectName}</li>)}
                {preview.affectedTeachingGroups.map((g) => <li key={g.teachingGroupId + g.change}>{g.change === 'join' ? '+' : '−'} {g.name}</li>)}
                {preview.upcomingExamPapers.map((p) => <li key={p.examPaperId}>{t('web.people.examAffected', { subject: p.subjectName })}</li>)}
              </ul>
            </div>
          )}
          <InlineError error={streamAction.error} />
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'end'}
        onClose={() => setDialog(null)}
        title={t('web.people.endEnrollment')}
        footer={<Button variant="danger" loading={end.isPending} disabled={reason.trim().length < 3} onClick={() => end.mutate(undefined)}>{t('common.confirm')}</Button>}
      >
        <div className="grid gap-3">
          <SelectField label={t('common.status')} value={endStatus} onValue={setEndStatus} options={['withdrawn', 'transferred'].map((v) => ({ value: v, label: t(`web.status.${v}`) }))} />
          <TextField label={t('web.common.endDate')} type="date" value={effectiveDate} onValue={setEffectiveDate} />
          <TextField label={t('web.common.reason')} value={reason} onValue={setReason} />
          <p className="text-[13px] text-muted">{t('web.people.endEnrollmentHint')}</p>
          <InlineError error={end.error} />
        </div>
      </Dialog>
    </div>
  );
}

function AttendanceTab({ s }: { s: StudentDetail }) {
  const { t } = useTranslation();
  const lang = useLang();
  const [from, setFrom] = useState(addDays(todayLocal(), -30));
  const [to, setTo] = useState(todayLocal());
  const q = useApi<z.infer<typeof studentAttendanceReport>>(['attendance', 'student', s.id], `/attendance/students/${s.id}/report`, { from, to });
  const sum = q.data?.summary;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <TextField label={t('web.common.fromDate')} type="date" value={from} onValue={setFrom} />
        <TextField label={t('web.common.toDate')} type="date" value={to} onValue={setTo} />
      </div>
      {q.isLoading ? (
        <LoadingBlock />
      ) : sum ? (
        <>
          <Grid cols={4}>
            <Stat label={t('attendance.rate')} value={sum.rate ? formatPercent(sum.rate) : t('common.noData')} />
            <Stat label={t('attendance.present')} value={sum.present} hint={`${t('attendance.late')}: ${sum.late}`} />
            <Stat label={t('attendance.absent')} value={sum.absent} tone={sum.absent ? 'danger' : undefined} />
            <Stat label={t('attendance.completeness')} value={sum.completeness ? formatPercent(sum.completeness, 0) : t('common.noData')} hint={`${t('attendance.excused')}: ${sum.excused}`} />
          </Grid>
          <Card padded={false}>
            <DataTable
              rows={[...(q.data?.days ?? [])].reverse()}
              rowKey={(r) => r.date}
              columns={[
                { key: 'd', header: t('common.date'), cell: (r) => formatDate(r.date, lang, { dateStyle: 'full' }) },
                { key: 's', header: t('common.status'), cell: (r) => (r.status ? <Badge tone={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : r.status === 'late' ? 'warning' : 'info'}>{t(`attendance.${r.status}`)}</Badge> : t('attendance.notRecorded')) },
                { key: 'n', header: t('web.common.note'), cell: (r) => r.note ?? '' },
              ]}
            />
          </Card>
        </>
      ) : (
        <ErrorState error={q.error} />
      )}
    </div>
  );
}

function ResultsTab({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof myResult>[] }>(['results', 'student', studentId], `/students/${studentId}/results`);
  if (q.isLoading) return <LoadingBlock />;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState title={t('web.results.noneYet')} />;
  return (
    <div className="flex flex-col gap-4">
      {items.map((r) => (
        <Card
          key={r.publicationId}
          title={`${localized(lang, r.examCycleName, r.examCycleNameUr)} · ${r.academicYearCode}`}
          actions={<Link className="text-[13px] text-accent-700 hover:underline" href={`/admin/results/${r.publicationId}/report-card/${studentId}`}>{t('exams.reportCard')}</Link>}
          padded={false}
        >
          <div className="flex flex-wrap gap-6 px-5 py-3">
            <span>{t('exams.percentage')}: <b className="tabular">{formatPercent(r.result.percentage, 2)}</b></span>
            <span>{t('exams.grade')}: <bdi dir="ltr" className="font-bold">{r.result.gradeLabel ?? '—'}</bdi></span>
            <Badge tone={stateTone[r.result.outcome]}>{t(`exams.${r.result.outcome}`)}</Badge>
          </div>
          <DataTable
            rows={r.result.subjects}
            rowKey={(x) => x.courseOfferingId}
            columns={[
              { key: 's', header: t('web.common.subject'), cell: (x) => localized(lang, x.subjectName, x.subjectNameUr) },
              { key: 'm', header: t('exams.marks'), numeric: true, cell: (x) => `${formatNumber(x.obtainedMarks)} / ${formatNumber(x.maxMarks)}` },
              { key: 'g', header: t('exams.grade'), cell: (x) => <bdi dir="ltr">{x.gradeLabel ?? '—'}</bdi> },
              { key: 'o', header: t('common.status'), cell: (x) => <Badge tone={x.outcome === 'pass' ? 'success' : x.outcome === 'exempt' ? 'neutral' : 'danger'}>{t(`exams.${x.outcome}`)}</Badge> },
            ]}
          />
        </Card>
      ))}
    </div>
  );
}

function FeesTab({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<FeeStatement>(['fees', 'statement', studentId], `/students/${studentId}/fee-statement`);
  if (q.isLoading) return <LoadingBlock />;
  if (!q.data) return <ErrorState error={q.error} />;
  const s = q.data;
  return (
    <div className="flex flex-col gap-4">
      <Grid cols={4}>
        <Stat label={t('fees.amount')} value={formatMoney(s.totals.charged, s.currency)} />
        <Stat label={t('fees.paidAmount')} value={formatMoney(s.totals.paid, s.currency)} />
        <Stat label={t('fees.balance')} value={formatMoney(s.totals.balance, s.currency)} tone={Number(s.totals.overdue) > 0 ? 'danger' : undefined} hint={Number(s.totals.overdue) > 0 ? `${t('fees.overdue')}: ${formatMoney(s.totals.overdue, s.currency)}` : undefined} />
        <Stat label={t('web.fees.credit')} value={formatMoney(s.totals.credit, s.currency)} />
      </Grid>
      <Card title={t('web.nav.invoices')} padded={false} actions={<Link href={`/admin/fees/invoices?studentId=${studentId}`} className="text-[13px] text-accent-700 hover:underline">{t('web.common.viewAll')}</Link>}>
        <DataTable
          rows={s.invoices}
          rowKey={(r) => r.id}
          columns={[
            { key: 'n', header: '#', cell: (r) => <Link className="tabular text-accent-700 hover:underline" href={`/admin/fees/invoices/${r.id}`}>{r.invoiceNumber}</Link> },
            { key: 'p', header: t('web.fees.period'), cell: (r) => r.periodLabel },
            { key: 'd', header: t('fees.dueDate'), cell: (r) => formatDate(r.dueDate, lang) },
            { key: 't', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.totalAmount, s.currency) },
            { key: 'b', header: t('fees.balance'), numeric: true, cell: (r) => formatMoney(r.balance, s.currency) },
            { key: 's', header: t('common.status'), cell: (r) => <span className="flex gap-1"><Badge tone={feeTone[r.feeStatus]}>{t(`fees.${r.feeStatus}`)}</Badge>{r.overdue && <Badge tone="danger">{t('fees.overdue')}</Badge>}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function Discipline({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof disciplinarySuspension>[] }>(['suspensions', studentId], `/students/${studentId}/suspensions`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ startDate: todayLocal(), endDate: addDays(todayLocal(), 2), reason: '' });
  const add = useAction(() => api.post(`/students/${studentId}/suspensions`, f), {
    invalidate: [['suspensions', studentId], ['student', studentId]],
    success: t('web.common.created'),
    onSuccess: () => setOpen(false),
  });
  const revoke = useAction((id: string) => api.post(`/suspensions/${id}/revoke`, { reason: 'Revoked by administrator' }), { invalidate: [['suspensions', studentId], ['student', studentId]], toastErrors: true });
  return (
    <Card title={t('web.people.disciplinarySuspensions')} actions={<Button size="sm" onClick={() => setOpen(true)}>{t('web.people.addSuspension')}</Button>} padded={false}>
      <p className="px-5 pt-3 text-[13px] text-muted">{t('web.people.suspensionHint')}</p>
      <DataTable
        rows={q.data?.items ?? []}
        rowKey={(r) => r.id}
        columns={[
          { key: 'd', header: t('common.date'), cell: (r) => `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}` },
          { key: 'r', header: t('web.common.reason'), cell: (r) => r.reason },
          { key: 's', header: t('common.status'), cell: (r) => (r.revokedAt ? <Badge>{t('web.people.revoked')}</Badge> : <Badge tone="danger">{t('web.status.active')}</Badge>) },
          { key: 'a', header: '', cell: (r) => !r.revokedAt && <Button size="sm" variant="ghost" onClick={() => revoke.mutate(r.id)}>{t('web.people.revoke')}</Button> },
        ]}
      />
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.people.addSuspension')} footer={<Button variant="danger" loading={add.isPending} disabled={f.reason.trim().length < 3} onClick={() => add.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('leave.startDate')} type="date" value={f.startDate} onValue={(v) => setF({ ...f, startDate: v })} />
          <TextField label={t('leave.endDate')} type="date" value={f.endDate} onValue={(v) => setF({ ...f, endDate: v })} />
          <TextField label={t('web.common.reason')} value={f.reason} onValue={(v) => setF({ ...f, reason: v })} />
          <InlineError error={add.error} />
        </div>
      </Dialog>
    </Card>
  );
}
