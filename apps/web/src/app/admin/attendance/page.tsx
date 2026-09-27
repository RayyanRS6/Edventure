'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus, AttendanceSummary, z } from '@edventure/contracts';
import { attendanceStatuses, dailyOverview, sectionAttendanceReport, teacherAttendanceDay } from '@edventure/contracts';
import { RollCallEditor } from '@/components/attendance/roll-call-editor';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, Grid, PageHeader, Stat, Tabs, Toolbar } from '@/components/ui/layout';
import { EmptyState, ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { addDays, formatDate, formatPercent, todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useApi, useLang, useSectionOptions } from '@/lib/hooks';

type Tab = 'daily' | 'teachers' | 'reports';

export default function AttendancePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('daily');
  return (
    <>
      <PageHeader title={t('nav.attendance')} subtitle={t('web.attendance.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'daily', label: t('web.attendance.daily') },
          { value: 'teachers', label: t('nav.teachers') },
          { value: 'reports', label: t('nav.reports') },
        ]}
      />
      {tab === 'daily' && <Daily />}
      {tab === 'teachers' && <Teachers />}
      {tab === 'reports' && <SectionReport />}
    </>
  );
}

function DateNav({ date, onDate }: { date: string; onDate: (d: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-2">
      <TextField className="w-44" label={t('common.date')} type="date" value={date} onValue={(v) => v && onDate(v)} />
      <Button onClick={() => onDate(addDays(date, -1))}>{t('web.attendance.prevDay')}</Button>
      <Button onClick={() => onDate(todayLocal())}>{t('common.today')}</Button>
    </div>
  );
}

function Daily() {
  const { t } = useTranslation();
  const lang = useLang();
  const [date, setDate] = useState(todayLocal());
  const q = useApi<z.infer<typeof dailyOverview>>(['attendance-overview', date], '/attendance/overview', { date });
  const [open, setOpen] = useState<{ sectionId: string; label: string } | null>(null);
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <DateNav date={date} onDate={setDate} />
      </Toolbar>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d.instructional ? (
        <Card>
          <EmptyState title={t('web.attendance.notInstructional')} hint={formatDate(date, lang, { dateStyle: 'full' })} />
        </Card>
      ) : (
        <>
          <Grid cols={4}>
            <Stat label={t('attendance.rate')} value={d.overall.rate ? formatPercent(d.overall.rate) : t('common.noData')} hint={t('attendance.summary', d.overall)} />
            <Stat label={t('attendance.completeness')} value={d.overall.completeness ? formatPercent(d.overall.completeness, 0) : t('common.noData')} hint={t('web.attendance.sectionsSubmitted', { done: d.sections.filter((s) => s.state === 'submitted').length, total: d.sections.length })} />
            <Stat label={t('attendance.absent')} value={d.overall.absent} tone={d.overall.absent ? 'danger' : undefined} />
            <Stat label={t('web.attendance.teacherRate')} value={d.teachers.rate ? formatPercent(d.teachers.rate) : t('common.noData')} hint={t('attendance.summary', d.teachers)} />
          </Grid>
          <Card padded={false}>
            <DataTable
              rows={d.sections}
              rowKey={(r) => r.sectionId}
              onRowClick={(r) => setOpen({ sectionId: r.sectionId, label: `${r.gradeName} ${r.sectionName}` })}
              columns={[
                { key: 's', header: t('web.common.section'), cell: (r) => <span className="font-medium">{r.gradeName} {r.sectionName}</span> },
                { key: 'st', header: t('common.status'), cell: (r) => <Badge tone={r.state === 'submitted' ? 'success' : r.state === 'draft' ? 'warning' : 'danger'}>{t(`web.status.${r.state}`)}</Badge> },
                { key: 'p', header: t('attendance.present'), numeric: true, cell: (r) => r.present },
                { key: 'a', header: t('attendance.absent'), numeric: true, cell: (r) => <span className={clsx(r.absent && 'font-semibold text-danger-fg')}>{r.absent}</span> },
                { key: 'l', header: t('attendance.late'), numeric: true, cell: (r) => r.late },
                { key: 'e', header: t('attendance.excused'), numeric: true, cell: (r) => r.excused },
                { key: 'n', header: t('web.common.total'), numeric: true, cell: (r) => r.rosterSize },
              ]}
            />
          </Card>
        </>
      )}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open ? `${open.label} · ${formatDate(date, lang)}` : ''} wide>
        {open && <RollCallEditor sectionId={open.sectionId} date={date} />}
      </Dialog>
    </div>
  );
}

type TeacherRow = { status: AttendanceStatus | null; note: string; recordVersion: number | null };

function Teachers() {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayLocal());
  const q = useApi<z.infer<typeof teacherAttendanceDay>>(['teacher-attendance', date], '/attendance/teachers', { date });
  const [rows, setRows] = useState<Record<string, TeacherRow>>({});
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (q.data) setRows(Object.fromEntries(q.data.entries.map((e) => [e.teacherId, { status: e.status ?? (e.onLeave ? 'excused' : null), note: e.note ?? '', recordVersion: e.recordVersion }])));
  }, [q.data]);
  const past = date !== todayLocal();
  const save = useAction(
    () =>
      api.put('/attendance/teachers', {
        date,
        correctionReason: past && reason ? reason : null,
        entries: Object.entries(rows)
          .filter(([, r]) => r.status)
          .map(([teacherId, r]) => ({ teacherId, status: r.status!, note: r.note || null, recordVersion: r.recordVersion })),
      }),
    { invalidate: [['teacher-attendance', date], ['attendance-overview']], success: t('web.common.updated'), onSuccess: () => setReason('') },
  );
  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <DateNav date={date} onDate={setDate} />
        <Button onClick={() => setRows((s) => Object.fromEntries(Object.entries(s).map(([k, r]) => [k, r.status ? r : { ...r, status: 'present' }])))}>{t('web.attendance.fillPresent')}</Button>
      </Toolbar>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorState error={q.error} />
      ) : !q.data.instructional ? (
        <Card><EmptyState title={t('web.attendance.notInstructional')} /></Card>
      ) : (
        <Card padded={false}>
          <DataTable
            rows={q.data.entries}
            rowKey={(r) => r.teacherId}
            columns={[
              { key: 'n', header: t('web.common.teacher'), cell: (r) => <div><p className="font-medium">{r.displayName}</p><p className="text-[12px] text-muted">{r.employeeNumber}{r.onLeave ? ` · ${t('web.attendance.onLeave')}` : ''}</p></div> },
              {
                key: 's',
                header: t('common.status'),
                cell: (r) => (
                  <div role="radiogroup" aria-label={r.displayName} className="flex flex-wrap gap-1">
                    {attendanceStatuses.map((s) => (
                      <button
                        key={s}
                        role="radio"
                        aria-checked={rows[r.teacherId]?.status === s}
                        onClick={() => setRows((x) => ({ ...x, [r.teacherId]: { ...x[r.teacherId]!, status: s } }))}
                        className={clsx('h-8 rounded-lg border px-2.5 text-[13px] font-medium', rows[r.teacherId]?.status === s ? 'border-accent-600 bg-accent-50 text-accent-800' : 'border-line text-muted hover:bg-sunken')}
                      >
                        {t(`attendance.${s}`)}
                      </button>
                    ))}
                  </div>
                ),
              },
              {
                key: 'note',
                header: t('web.common.note'),
                cell: (r) => (
                  <input
                    className="h-8 w-full min-w-40 rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
                    value={rows[r.teacherId]?.note ?? ''}
                    aria-label={t('web.common.note')}
                    onChange={(e) => setRows((x) => ({ ...x, [r.teacherId]: { ...x[r.teacherId]!, note: e.target.value } }))}
                  />
                ),
              },
            ]}
          />
          <div className="flex flex-col gap-3 border-t border-line p-4">
            {past && <TextField label={t('attendance.correctionReason')} value={reason} onValue={setReason} hint={t('web.attendance.teacherCorrectionHint')} />}
            <InlineError error={save.error} />
            <div className="flex justify-end">
              <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function SectionReport() {
  const { t } = useTranslation();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const [sectionId, setSectionId] = useState('');
  const [range, setRange] = useState({ from: addDays(todayLocal(), -30), to: todayLocal() });
  const sid = sectionId || sections.options[0]?.value;
  const q = useApi<z.infer<typeof sectionAttendanceReport>>(['section-attendance', sid, range], sid ? `/attendance/sections/${sid}/report` : null, range);
  const r = q.data;
  const rate = (s: AttendanceSummary) => (s.rate ? formatPercent(s.rate) : t('common.noData'));
  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SelectField className="w-52" label={t('web.common.section')} value={sid ?? ''} onValue={setSectionId} options={sections.options} />
        <TextField className="w-40" label={t('common.from')} type="date" value={range.from} onValue={(v) => setRange({ ...range, from: v })} />
        <TextField className="w-40" label={t('common.to')} type="date" value={range.to} onValue={(v) => setRange({ ...range, to: v })} />
      </Toolbar>
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : r ? (
        <>
          <Grid cols={4}>
            <Stat label={t('attendance.rate')} value={rate(r.overall)} hint={t('attendance.summary', r.overall)} />
            <Stat label={t('attendance.completeness')} value={r.overall.completeness ? formatPercent(r.overall.completeness, 0) : t('common.noData')} />
            <Stat label={t('web.attendance.instructionalDays')} value={r.instructionalDays} />
            <Stat label={t('web.attendance.rollCallsSubmitted')} value={r.rollCallsSubmitted} />
          </Grid>
          <Card padded={false}>
            <DataTable
              rows={[...r.students].sort((a, b) => Number(a.summary.rate ?? 101) - Number(b.summary.rate ?? 101))}
              rowKey={(s) => s.studentId}
              columns={[
                { key: 'n', header: t('web.common.student'), cell: (s) => <div><p className="font-medium">{s.displayName}</p><p className="text-[12px] text-muted">{s.admissionNumber}</p></div> },
                { key: 'r', header: t('attendance.rate'), numeric: true, cell: (s) => <span className={clsx(s.summary.rate && Number(s.summary.rate) < 75 && 'font-semibold text-danger-fg')}>{rate(s.summary)}</span> },
                { key: 'p', header: t('attendance.present'), numeric: true, cell: (s) => s.summary.present },
                { key: 'a', header: t('attendance.absent'), numeric: true, cell: (s) => s.summary.absent },
                { key: 'l', header: t('attendance.late'), numeric: true, cell: (s) => s.summary.late },
                { key: 'e', header: t('attendance.excused'), numeric: true, cell: (s) => s.summary.excused },
              ]}
            />
          </Card>
          <p className="text-[13px] text-muted">{t('web.attendance.rateHint')}</p>
        </>
      ) : null}
    </div>
  );
}
