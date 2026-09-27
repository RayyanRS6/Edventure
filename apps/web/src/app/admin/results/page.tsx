'use client';

import { Calculator, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExamCycle, ResultPublication } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, SelectField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang } from '@/lib/hooks';

function ResultsList() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const { year } = useActiveYear();
  const cycles = useApi<{ items: ExamCycle[] }>(['exams', year?.id], year ? '/exams' : null, year ? { academicYearId: year.id } : undefined);
  const classes = useClasses(year?.id);
  const [examCycleId, setExamCycleId] = useState(params.get('examCycleId') ?? '');
  const [classOfferingId, setClassOfferingId] = useState('');
  const q = useApi<{ items: ResultPublication[] }>(['results', examCycleId, classOfferingId], '/results', { examCycleId: examCycleId || undefined, classOfferingId: classOfferingId || undefined });
  const [calc, setCalc] = useState(false);
  const [f, setF] = useState<{ examCycleId: string; classOfferingId: string; combine: Array<{ examCycleId: string; weight: string }> }>({ examCycleId: '', classOfferingId: '', combine: [] });
  const calculate = useAction(
    () => api.post<ResultPublication>('/results/calculate', { examCycleId: f.examCycleId, classOfferingId: f.classOfferingId, combine: f.combine.length ? f.combine : undefined }),
    { invalidate: [['results']], onSuccess: (p) => router.push(`/admin/results/${p.id}`) },
  );
  const cycleOptions = (cycles.data?.items ?? []).map((c) => ({ value: c.id, label: lang === 'ur' && c.nameUr ? c.nameUr : c.name }));
  const classOptions = (classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }));

  return (
    <>
      <PageHeader
        title={t('nav.results')}
        subtitle={t('web.results.subtitle')}
        actions={<Button variant="primary" icon={<Calculator size={16} />} onClick={() => { setF({ examCycleId: examCycleId, classOfferingId: '', combine: [] }); setCalc(true); }}>{t('web.results.calculate')}</Button>}
      />
      <Toolbar>
        <SelectField className="w-56" label={t('nav.exams')} value={examCycleId} onValue={setExamCycleId} placeholder={t('common.all')} options={cycleOptions} />
        <SelectField className="w-44" label={t('web.common.class')} value={classOfferingId} onValue={setClassOfferingId} placeholder={t('common.all')} options={classOptions} />
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/results/${r.id}`)}
            empty={<EmptyState title={t('web.results.none')} hint={t('web.results.noneHint')} />}
            columns={[
              { key: 'e', header: t('nav.exams'), cell: (r) => <span className="font-medium">{r.examCycleName}</span> },
              { key: 'c', header: t('web.common.class'), cell: (r) => r.gradeName },
              { key: 'rv', header: t('web.results.revision'), numeric: true, cell: (r) => r.revision },
              { key: 'p', header: t('exams.pass'), numeric: true, cell: (r) => r.counts.pass },
              { key: 'f', header: t('exams.fail'), numeric: true, cell: (r) => r.counts.fail },
              { key: 'i', header: t('exams.incomplete'), numeric: true, cell: (r) => r.counts.incomplete },
              { key: 's', header: t('common.status'), cell: (r) => <div><Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge>{r.publishedAt && <p className="mt-0.5 text-[11px] text-muted">{formatDateTime(r.publishedAt, lang)}</p>}</div> },
            ]}
          />
        )}
      </Card>
      <Dialog open={calc} onClose={() => setCalc(false)} title={t('web.results.calculate')} footer={<Button variant="primary" loading={calculate.isPending} disabled={!f.examCycleId || !f.classOfferingId} onClick={() => calculate.mutate(undefined)}>{t('web.results.calculateNow')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('nav.exams')} value={f.examCycleId} onValue={(v) => setF({ ...f, examCycleId: v })} placeholder={t('web.common.select')} options={cycleOptions} />
          <SelectField label={t('web.common.class')} value={f.classOfferingId} onValue={(v) => setF({ ...f, classOfferingId: v })} placeholder={t('web.common.select')} options={classOptions} />
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[13px] font-medium text-ink-soft">{t('web.results.combine')}</p>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} disabled={f.combine.length >= 4} onClick={() => setF({ ...f, combine: [...f.combine, { examCycleId: '', weight: '' }] })}>{t('common.add')}</Button>
            </div>
            <p className="mb-2 text-[12px] text-muted">{t('web.results.combineHint')}</p>
            {f.combine.map((c, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_90px_auto] gap-2">
                <Select compact ariaLabel={t('nav.exams')} value={c.examCycleId} onValue={(value) => setF({ ...f, combine: f.combine.map((x, j) => (j === i ? { ...x, examCycleId: value } : x)) })} placeholder={t('web.common.select')} options={cycleOptions} />
                <input aria-label="%" dir="ltr" placeholder="%" className="tabular h-9 rounded-lg border border-line-strong px-2 text-sm" value={c.weight} onChange={(e) => setF({ ...f, combine: f.combine.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
                <button aria-label={t('common.delete')} className="p-1 text-muted hover:text-danger-fg" onClick={() => setF({ ...f, combine: f.combine.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-muted">{t('web.results.calculateHint')}</p>
          <InlineError error={calculate.error} />
        </div>
      </Dialog>
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsList />
    </Suspense>
  );
}
