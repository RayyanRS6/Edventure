'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExamCycle, ExamPaper, ReportJob, ReportKind, ResultPublication } from '@edventure/contracts';
import { PersonPicker, type PickedPerson } from '@/components/people/person-picker';
import { Button } from '@/components/ui/button';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, downloadFile } from '@/lib/api';
import { addDays, formatDateTime, stateTone, todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang, useSectionOptions } from '@/lib/hooks';

type Param = 'classOfferingId' | 'sectionId' | 'from' | 'to' | 'date' | 'publicationId' | 'examCycleId' | 'examPaperId' | 'studentId' | 'blank';
const catalog: Record<ReportKind, { formats: Array<'csv' | 'pdf'>; required: Param[]; optional?: Param[] }> = {
  students: { formats: ['csv'], required: [], optional: ['classOfferingId', 'sectionId'] },
  attendance_daily: { formats: ['csv'], required: ['date'] },
  attendance_section: { formats: ['csv'], required: ['sectionId', 'from', 'to'] },
  teacher_attendance: { formats: ['csv'], required: ['from', 'to'] },
  leave: { formats: ['csv'], required: ['from', 'to'] },
  homework_completion: { formats: ['csv'], required: ['sectionId', 'from', 'to'] },
  exam_results: { formats: ['csv'], required: ['publicationId'] },
  report_card: { formats: ['pdf'], required: ['publicationId'] },
  date_sheet: { formats: ['pdf', 'csv'], required: ['examCycleId'], optional: ['classOfferingId'] },
  mark_sheet: { formats: ['pdf'], required: ['examCycleId', 'examPaperId'], optional: ['sectionId', 'blank'] },
  fee_balances: { formats: ['csv'], required: [] },
  fee_statement: { formats: ['pdf'], required: ['studentId'] },
};
const kinds = Object.keys(catalog) as ReportKind[];

export default function ReportsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const jobs = useApi<{ items: ReportJob[] }>(['reports'], '/reports', undefined, { refetchInterval: 4000 });
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const sections = useSectionOptions(year?.id);
  const cycles = useApi<{ items: ExamCycle[] }>(['exams', year?.id], year ? '/exams' : null, year ? { academicYearId: year.id } : undefined);
  const publications = useApi<{ items: ResultPublication[] }>(['results'], '/results');
  const [kind, setKind] = useState<ReportKind>('students');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const [locale, setLocale] = useState<'en' | 'ur'>(lang);
  const [p, setP] = useState<Partial<Record<Param, string>>>({ from: addDays(todayLocal(), -30), to: todayLocal(), date: todayLocal() });
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const papers = useApi<{ items: ExamPaper[] }>(['exam-papers', p.examCycleId, 'all'], p.examCycleId ? `/exams/${p.examCycleId}/papers` : null);
  const spec = catalog[kind];
  const fields = [...spec.required, ...(spec.optional ?? [])];

  const request = useAction(
    () => {
      const parameters: Record<string, string> = {};
      for (const f of fields) {
        const v = f === 'studentId' ? student?.id : p[f];
        if (v) parameters[f] = v;
      }
      return api.post('/reports', { kind, format, locale, parameters });
    },
    { invalidate: [['reports']], success: t('web.reports.queued') },
  );
  const ready = spec.required.every((f) => (f === 'studentId' ? !!student : !!p[f]));
  const set = (k: Param, v: string) => setP((s) => ({ ...s, [k]: v }));

  return (
    <>
      <PageHeader title={t('nav.reports')} subtitle={t('web.reports.subtitle')} />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card title={t('web.reports.new')}>
          <div className="grid gap-3">
            <SelectField
              label={t('web.reports.kind')}
              value={kind}
              onValue={(v) => {
                const k = v as ReportKind;
                setKind(k);
                setFormat(catalog[k].formats[0]!);
              }}
              options={kinds.map((k) => ({ value: k, label: t(`web.reports.kinds.${k}`) }))}
            />
            <p className="text-[13px] text-muted">{t(`web.reports.hints.${kind}`)}</p>
            {fields.includes('classOfferingId') && <SelectField label={t('web.common.class')} value={p.classOfferingId ?? ''} onValue={(v) => set('classOfferingId', v)} placeholder={t('common.all')} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />}
            {fields.includes('sectionId') && <SelectField label={t('web.common.section')} value={p.sectionId ?? ''} onValue={(v) => set('sectionId', v)} placeholder={spec.required.includes('sectionId') ? t('web.common.select') : t('common.all')} options={sections.options} />}
            {fields.includes('date') && <TextField label={t('common.date')} type="date" value={p.date ?? ''} onValue={(v) => set('date', v)} />}
            {fields.includes('from') && (
              <div className="grid grid-cols-2 gap-2">
                <TextField label={t('common.from')} type="date" value={p.from ?? ''} onValue={(v) => set('from', v)} />
                <TextField label={t('common.to')} type="date" value={p.to ?? ''} onValue={(v) => set('to', v)} />
              </div>
            )}
            {fields.includes('publicationId') && (
              <SelectField label={t('nav.results')} value={p.publicationId ?? ''} onValue={(v) => set('publicationId', v)} placeholder={t('web.common.select')} options={(publications.data?.items ?? []).filter((r) => kind !== 'report_card' || r.state === 'published').map((r) => ({ value: r.id, label: `${r.gradeName} · ${r.examCycleName} (${t(`web.status.${r.state}`)})` }))} />
            )}
            {fields.includes('examCycleId') && <SelectField label={t('nav.exams')} value={p.examCycleId ?? ''} onValue={(v) => setP((s) => ({ ...s, examCycleId: v, examPaperId: '' }))} placeholder={t('web.common.select')} options={(cycles.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} />}
            {fields.includes('examPaperId') && <SelectField label={t('web.exams.paper')} value={p.examPaperId ?? ''} onValue={(v) => set('examPaperId', v)} placeholder={t('web.common.select')} options={(papers.data?.items ?? []).map((x) => ({ value: x.id, label: `${x.gradeName} · ${x.subjectName}` }))} />}
            {fields.includes('blank') && <Checkbox label={t('web.reports.blank')} hint={t('web.reports.blankHint')} checked={p.blank === 'true'} onChange={(v) => set('blank', v ? 'true' : '')} />}
            {fields.includes('studentId') && <PersonPicker label={t('web.common.student')} value={student} onChange={setStudent} required />}
            <div className="grid grid-cols-2 gap-2">
              <SelectField label={t('web.reports.format')} value={format} onValue={(v) => setFormat(v as 'csv' | 'pdf')} options={spec.formats.map((f) => ({ value: f, label: f.toUpperCase() }))} />
              <SelectField label={t('common.language')} value={locale} onValue={(v) => setLocale(v as 'en' | 'ur')} options={[{ value: 'en', label: t('common.english') }, { value: 'ur', label: t('common.urdu') }]} />
            </div>
            <InlineError error={request.error} />
            <Button variant="primary" loading={request.isPending} disabled={!ready} onClick={() => request.mutate(undefined)}>{t('web.reports.generate')}</Button>
          </div>
        </Card>
        <Card title={t('web.reports.recent')} padded={false}>
          {jobs.isLoading ? (
            <LoadingBlock />
          ) : (
            <DataTable
              rows={jobs.data?.items ?? []}
              rowKey={(r) => r.id}
              empty={<EmptyState title={t('web.reports.none')} />}
              columns={[
                { key: 'k', header: t('web.reports.kind'), cell: (r) => <div><p className="font-medium">{t(`web.reports.kinds.${r.kind}`)}</p><p className="text-[12px] text-muted">{r.format.toUpperCase()} · {formatDateTime(r.createdAt, lang)}</p></div> },
                { key: 's', header: t('common.status'), cell: (r) => <div><Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge>{r.error && <p className="mt-0.5 max-w-xs text-[12px] text-danger-fg">{r.error}</p>}</div> },
                { key: 'e', header: t('web.reports.expires'), cell: (r) => (r.state === 'succeeded' ? formatDateTime(r.expiresAt, lang) : '—') },
                { key: 'd', header: '', cell: (r) => (r.state === 'succeeded' && r.fileId ? <Button size="sm" icon={<Download size={14} />} onClick={() => downloadFile(r.fileId!)}>{t('common.download')}</Button> : null) },
              ]}
            />
          )}
          <p className="border-t border-line px-5 py-3 text-[13px] text-muted">{t('web.reports.retentionHint')}</p>
        </Card>
      </div>
    </>
  );
}
