'use client';

import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GradingPolicy } from '@edventure/contracts';
import { absentRules, examKinds } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Select, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatNumber, stateTone } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

type Band = { label: string; minPercentage: string; maxPercentage: string; gradePoints: string; isPassing: boolean };
type Form = {
  id: string | null;
  name: string;
  minOverallPercentage: string;
  requireAllCompulsoryPass: boolean;
  maxFailedSubjects: string;
  absentRule: string;
  displayDecimals: string;
  gpaEnabled: boolean;
  bands: Band[];
  weights: Array<{ examKind: string; weight: string }>;
};

const defaultBands: Band[] = [
  { label: 'A+', minPercentage: '80', maxPercentage: '100', gradePoints: '4', isPassing: true },
  { label: 'A', minPercentage: '70', maxPercentage: '79.99', gradePoints: '3.5', isPassing: true },
  { label: 'B', minPercentage: '60', maxPercentage: '69.99', gradePoints: '3', isPassing: true },
  { label: 'C', minPercentage: '50', maxPercentage: '59.99', gradePoints: '2.5', isPassing: true },
  { label: 'D', minPercentage: '40', maxPercentage: '49.99', gradePoints: '2', isPassing: true },
  { label: 'E', minPercentage: '33', maxPercentage: '39.99', gradePoints: '1', isPassing: true },
  { label: 'F', minPercentage: '0', maxPercentage: '32.99', gradePoints: '0', isPassing: false },
];

const emptyForm = (): Form => ({
  id: null,
  name: '',
  minOverallPercentage: '33',
  requireAllCompulsoryPass: true,
  maxFailedSubjects: '',
  absentRule: 'fail',
  displayDecimals: '2',
  gpaEnabled: false,
  bands: defaultBands.map((b) => ({ ...b })),
  weights: [],
});

const toForm = (p: GradingPolicy): Form => ({
  id: p.id,
  name: p.name,
  minOverallPercentage: p.passRequirement.minOverallPercentage,
  requireAllCompulsoryPass: p.passRequirement.requireAllCompulsoryPass,
  maxFailedSubjects: p.passRequirement.maxFailedSubjects?.toString() ?? '',
  absentRule: p.absentRule,
  displayDecimals: String(p.displayDecimals),
  gpaEnabled: p.gpaEnabled,
  bands: p.bands.map((b) => ({ label: b.label, minPercentage: b.minPercentage, maxPercentage: b.maxPercentage, gradePoints: b.gradePoints ?? '', isPassing: b.isPassing })),
  weights: p.weights.map((w) => ({ examKind: w.examKind, weight: w.weight })),
});

export default function GradingPage() {
  const { t } = useTranslation();
  const q = useApi<{ items: GradingPolicy[] }>(['grading-policies'], '/grading-policies');
  const [form, setForm] = useState<Form | null>(null);
  const body = (f: Form) => ({
    name: f.name,
    passRequirement: { minOverallPercentage: f.minOverallPercentage, requireAllCompulsoryPass: f.requireAllCompulsoryPass, maxFailedSubjects: f.maxFailedSubjects === '' ? null : Number(f.maxFailedSubjects) },
    absentRule: f.absentRule,
    displayDecimals: Number(f.displayDecimals),
    gpaEnabled: f.gpaEnabled,
    bands: f.bands.map((b) => ({ ...b, gradePoints: b.gradePoints || null })),
    weights: f.weights,
  });
  const save = useAction(() => (form!.id ? api.put(`/grading-policies/${form!.id}`, body(form!)) : api.post('/grading-policies', body(form!))), {
    invalidate: [['grading-policies']],
    success: t('web.common.updated'),
    onSuccess: () => setForm(null),
  });
  const activate = useAction((id: string) => api.post(`/grading-policies/${id}/activate`), { invalidate: [['grading-policies']], success: t('web.grading.activated'), toastErrors: true });

  return (
    <>
      <PageHeader title={t('web.nav.grading')} subtitle={t('web.grading.subtitle')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm(emptyForm())}>{t('web.grading.new')}</Button>} />
      {q.isLoading ? (
        <LoadingBlock />
      ) : (q.data?.items ?? []).length === 0 ? (
        <Card><EmptyState title={t('web.grading.none')} hint={t('web.grading.noneHint')} /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {q.data!.items.map((p) => (
            <Card
              key={p.id}
              title={
                <span className="flex items-center gap-2">
                  {p.name} <span className="text-[13px] font-normal text-muted">v{p.versionNumber}</span>
                  <Badge tone={stateTone[p.state] ?? 'neutral'}>{t(`web.status.${p.state}`)}</Badge>
                </span>
              }
              actions={
                <>
                  {p.state === 'draft' && <Button size="sm" onClick={() => setForm(toForm(p))}>{t('common.edit')}</Button>}
                  {p.state !== 'active' && <Button size="sm" variant="primary" disabled={p.problems.length > 0} loading={activate.isPending && activate.variables === p.id} onClick={() => activate.mutate(p.id)}>{t('web.grading.activate')}</Button>}
                  {p.state === 'active' && <Button size="sm" onClick={() => setForm({ ...toForm(p), id: null, name: `${p.name}` })}>{t('web.grading.newVersion')}</Button>}
                </>
              }
            >
              {p.problems.length > 0 && (
                <ul className="mb-3 flex flex-col gap-1 rounded-lg bg-danger-bg px-3 py-2 text-[13px] text-danger-fg">
                  {p.problems.map((x) => <li key={x} className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {x}</li>)}
                </ul>
              )}
              <p className="mb-3 text-[13px] text-muted">
                {t('web.grading.summary', { min: p.passRequirement.minOverallPercentage })}
                {p.passRequirement.requireAllCompulsoryPass && ` · ${t('web.grading.allCompulsory')}`}
                {p.passRequirement.maxFailedSubjects !== null && ` · ${t('web.grading.maxFailed', { count: p.passRequirement.maxFailedSubjects })}`}
                {` · ${t(`web.grading.absent.${p.absentRule}`)}`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.bands.map((b) => (
                  <span key={b.label} className={`rounded-lg border px-2.5 py-1 text-[13px] ${b.isPassing ? 'border-line' : 'border-danger-fg/30 bg-danger-bg text-danger-fg'}`}>
                    <bdi dir="ltr" className="font-semibold">{b.label}</bdi> <span className="tabular text-muted" dir="ltr">{formatNumber(b.minPercentage)}–{formatNumber(b.maxPercentage)}%</span>
                    {p.gpaEnabled && b.gradePoints && <span className="tabular text-muted"> · {b.gradePoints}</span>}
                  </span>
                ))}
              </div>
              {p.weights.length > 0 && <p className="mt-3 text-[13px] text-muted">{t('web.grading.weights')}: {p.weights.map((w) => `${t(`web.exams.kinds.${w.examKind}`)} ${w.weight}%`).join(' + ')}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} title={form?.id ? t('web.grading.edit') : t('web.grading.new')} wide footer={<Button variant="primary" loading={save.isPending} disabled={!form?.name} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>}>
        {form && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label={t('web.common.name')} value={form.name} onValue={(v) => setForm({ ...form, name: v })} required />
              <TextField label={t('web.grading.minOverall')} value={form.minOverallPercentage} onValue={(v) => setForm({ ...form, minOverallPercentage: v })} dir="ltr" />
              <SelectField label={t('web.grading.absentRule')} value={form.absentRule} onValue={(v) => setForm({ ...form, absentRule: v })} options={absentRules.map((r) => ({ value: r, label: t(`web.grading.absent.${r}`) }))} />
              <TextField label={t('web.grading.maxFailedLabel')} value={form.maxFailedSubjects} onValue={(v) => setForm({ ...form, maxFailedSubjects: v.replace(/\D/g, '') })} hint={t('web.grading.maxFailedHint')} dir="ltr" />
              <TextField label={t('web.grading.decimals')} value={form.displayDecimals} onValue={(v) => setForm({ ...form, displayDecimals: v.replace(/\D/g, '').slice(0, 1) })} dir="ltr" />
              <div className="flex flex-col justify-end gap-2">
                <Checkbox label={t('web.grading.allCompulsory')} checked={form.requireAllCompulsoryPass} onChange={(v) => setForm({ ...form, requireAllCompulsoryPass: v })} />
                <Checkbox label={t('web.grading.gpa')} checked={form.gpaEnabled} onChange={(v) => setForm({ ...form, gpaEnabled: v })} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('web.grading.bands')}</h3>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm({ ...form, bands: [...form.bands, { label: '', minPercentage: '', maxPercentage: '', gradePoints: '', isPassing: true }] })}>{t('common.add')}</Button>
              </div>
              <div className="grid gap-2">
                {form.bands.map((b, i) => {
                  const setBand = (patch: Partial<Band>) => setForm({ ...form, bands: form.bands.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  return (
                    <div key={i} className="grid grid-cols-[70px_1fr_1fr_1fr_auto_auto] items-center gap-2">
                      <input aria-label={t('exams.grade')} className="h-9 rounded-lg border border-line-strong px-2 text-sm" value={b.label} onChange={(e) => setBand({ label: e.target.value })} />
                      <input aria-label={t('web.grading.min')} dir="ltr" placeholder={t('web.grading.min')} className="tabular h-9 rounded-lg border border-line-strong px-2 text-sm" value={b.minPercentage} onChange={(e) => setBand({ minPercentage: e.target.value })} />
                      <input aria-label={t('web.grading.max')} dir="ltr" placeholder={t('web.grading.max')} className="tabular h-9 rounded-lg border border-line-strong px-2 text-sm" value={b.maxPercentage} onChange={(e) => setBand({ maxPercentage: e.target.value })} />
                      <input aria-label={t('web.grading.points')} dir="ltr" placeholder={t('web.grading.points')} disabled={!form.gpaEnabled} className="tabular h-9 rounded-lg border border-line-strong px-2 text-sm disabled:bg-sunken" value={b.gradePoints} onChange={(e) => setBand({ gradePoints: e.target.value })} />
                      <label className="flex items-center gap-1 text-[13px]"><input type="checkbox" checked={b.isPassing} onChange={(e) => setBand({ isPassing: e.target.checked })} className="accent-accent-600" /> {t('exams.pass')}</label>
                      <button aria-label={t('common.delete')} className="rounded p-1 text-muted hover:text-danger-fg" onClick={() => setForm({ ...form, bands: form.bands.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('web.grading.weights')}</h3>
                <Button size="sm" icon={<Plus size={14} />} disabled={form.weights.length >= 4} onClick={() => setForm({ ...form, weights: [...form.weights, { examKind: 'final', weight: '' }] })}>{t('common.add')}</Button>
              </div>
              <p className="mb-2 text-[13px] text-muted">{t('web.grading.weightsHint')}</p>
              {form.weights.map((w, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <Select compact ariaLabel={t('web.common.type')} value={w.examKind} onValue={(value) => setForm({ ...form, weights: form.weights.map((x, j) => (j === i ? { ...x, examKind: value } : x)) })} options={examKinds.map((k) => ({ value: k, label: t(`web.exams.kinds.${k}`) }))} />
                  <input aria-label="%" dir="ltr" placeholder="%" className="tabular h-9 rounded-lg border border-line-strong px-2 text-sm" value={w.weight} onChange={(e) => setForm({ ...form, weights: form.weights.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)) })} />
                  <button aria-label={t('common.delete')} className="rounded p-1 text-muted hover:text-danger-fg" onClick={() => setForm({ ...form, weights: form.weights.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <InlineError error={save.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}
