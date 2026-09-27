'use client';

import { BellRing, FilePlus2, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeePlan, z } from '@edventure/contracts';
import { feeFrequencies, feeKinds, feeSummary, feeType, reminderCandidate } from '@edventure/contracts';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Select, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, Grid, PageHeader, Stat } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { addDays, formatDate, formatMoney, stateTone, todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang } from '@/lib/hooks';

type FeeType = z.infer<typeof feeType>;

export default function FeesOverviewPage() {
  const { t } = useTranslation();
  const { year } = useActiveYear();
  const summary = useApi<z.infer<typeof feeSummary>>(['fee-summary', year?.id], '/fees/summary', year ? { academicYearId: year.id } : undefined);
  const [reminders, setReminders] = useState(false);
  const s = summary.data;
  return (
    <>
      <PageHeader
        title={t('web.nav.feeOverview')}
        subtitle={year?.name}
        actions={
          <>
            <Button icon={<BellRing size={16} />} onClick={() => setReminders(true)}>{t('web.fees.reminders')}</Button>
            <LinkButton href="/admin/fees/payments" variant="primary">{t('web.fees.recordPayment')}</LinkButton>
          </>
        }
      />
      {summary.isLoading || !s ? (
        <LoadingBlock />
      ) : (
        <>
          <Grid cols={4} className="mb-4">
            <Stat label={t('web.fees.billed')} value={formatMoney(s.billed, s.currency)} />
            <Stat label={t('web.fees.collected')} value={formatMoney(s.collected, s.currency)} hint={Number(s.adjusted) ? `${t('web.fees.adjusted')}: ${formatMoney(s.adjusted, s.currency)}` : undefined} />
            <Stat label={t('web.fees.outstanding')} value={formatMoney(s.outstanding, s.currency)} hint={t('web.fees.studentsWithBalance', { count: s.studentsWithBalance })} />
            <Stat label={t('fees.overdue')} value={formatMoney(s.overdue, s.currency)} tone={Number(s.overdue) ? 'danger' : undefined} hint={t('web.dashboard.overdueStudents', { count: s.studentsOverdue })} />
          </Grid>
          {Number(s.unallocatedReceipts) > 0 && (
            <p className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning-bg px-4 py-2 text-[13px] text-warning-fg">
              {t('web.fees.unallocatedBanner', { amount: formatMoney(s.unallocatedReceipts, s.currency) })}
              <LinkButton size="sm" href="/admin/fees/payments?unallocated=true">{t('web.common.view')}</LinkButton>
            </p>
          )}
          <Card title={t('web.fees.byClass')} padded={false} className="mb-4">
            <DataTable
              rows={s.byClass}
              rowKey={(r) => r.classOfferingId}
              columns={[
                { key: 'c', header: t('web.common.class'), cell: (r) => <span className="font-medium">{r.gradeName}</span> },
                { key: 'b', header: t('web.fees.billed'), numeric: true, cell: (r) => formatMoney(r.billed, s.currency) },
                { key: 'o', header: t('web.fees.outstanding'), numeric: true, cell: (r) => formatMoney(r.outstanding, s.currency) },
                { key: 'd', header: t('fees.overdue'), numeric: true, cell: (r) => <span className={Number(r.overdue) ? 'text-danger-fg' : ''}>{formatMoney(r.overdue, s.currency)}</span> },
              ]}
            />
          </Card>
        </>
      )}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Plans currency={s?.currency ?? 'PKR'} />
        <FeeTypes />
      </div>
      {reminders && <RemindersDialog currency={s?.currency ?? 'PKR'} onClose={() => setReminders(false)} />}
    </>
  );
}

type PlanForm = { name: string; frequency: string; dueDay: string; items: Array<{ feeTypeId: string; amount: string; description: string }> };

function Plans({ currency }: { currency: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const plans = useApi<{ items: FeePlan[] }>(['fee-plans', year?.id], year ? '/fee-plans' : null, year ? { academicYearId: year.id } : undefined);
  const types = useApi<{ items: FeeType[] }>(['fee-types'], '/fee-types');
  const [form, setForm] = useState<PlanForm | null>(null);
  const [assign, setAssign] = useState<FeePlan | null>(null);
  const [a, setA] = useState({ classOfferingId: '', sectionId: '', startDate: todayLocal(), discountPercentage: '' });
  const [generate, setGenerate] = useState<FeePlan | null>(null);
  const [g, setG] = useState({ periodLabel: todayLocal().slice(0, 7), issueDate: todayLocal(), dueDate: addDays(todayLocal(), 10) });
  const invalidate = [['fee-plans'], ['fee-summary']];

  const create = useAction(
    () => api.post('/fee-plans', { academicYearId: year!.id, name: form!.name, frequency: form!.frequency, dueDay: Number(form!.dueDay), items: form!.items.map((i) => ({ feeTypeId: i.feeTypeId, amount: i.amount, description: i.description || null })) }),
    { invalidate, success: t('web.common.created'), onSuccess: () => setForm(null) },
  );
  const setState = useAction((p: { plan: FeePlan; state: string }) => api.patch(`/fee-plans/${p.plan.id}`, { state: p.state, version: p.plan.version }), { invalidate, toastErrors: true });
  const doAssign = useAction(
    () => api.post<{ assigned: number; alreadyAssigned: number }>(`/fee-plans/${assign!.id}/assignments`, { classOfferingId: a.sectionId ? undefined : a.classOfferingId || undefined, sectionId: a.sectionId || undefined, startDate: a.startDate, discountPercentage: a.discountPercentage || null }),
    { invalidate, onSuccess: (r) => { setAssign(null); toast(t('web.fees.assignedToast', { assigned: r.assigned, already: r.alreadyAssigned })); } },
  );
  const doGenerate = useAction(() => api.post<{ created: number; skipped: number }>(`/fee-plans/${generate!.id}/invoices`, g), {
    invalidate: [...invalidate, ['invoices']],
    onSuccess: (r) => { setGenerate(null); toast(t('web.fees.generatedToast', { created: r.created, skipped: r.skipped })); },
  });
  const cls = classes.data?.items.find((c) => c.id === a.classOfferingId);
  const total = form?.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) ?? 0;

  return (
    <Card title={t('web.fees.plans')} padded={false} actions={<Button size="sm" variant="primary" icon={<Plus size={14} />} disabled={!year} onClick={() => setForm({ name: '', frequency: 'monthly', dueDay: '10', items: [{ feeTypeId: '', amount: '', description: '' }] })}>{t('web.fees.newPlan')}</Button>}>
      {plans.isLoading ? (
        <LoadingBlock />
      ) : (
        <DataTable
          rows={plans.data?.items ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t('web.fees.noPlans')} hint={t('web.fees.noPlansHint')} />}
          columns={[
            { key: 'n', header: t('web.common.name'), cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-[12px] text-muted">{t(`web.fees.frequency.${r.frequency}`)} · {t('web.fees.dueDayN', { day: r.dueDay })}</p></div> },
            { key: 't', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.total, currency) },
            { key: 'a', header: t('web.fees.assigned'), numeric: true, cell: (r) => r.assignedCount },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge> },
            {
              key: 'x',
              header: '',
              cell: (r) => (
                <div className="flex justify-end gap-1">
                  {r.state === 'draft' && <Button size="sm" onClick={() => setState.mutate({ plan: r, state: 'active' })}>{t('web.fees.activate')}</Button>}
                  {r.state === 'active' && (
                    <>
                      <Button size="sm" variant="ghost" icon={<UserPlus size={14} />} onClick={() => { setA({ classOfferingId: '', sectionId: '', startDate: todayLocal(), discountPercentage: '' }); setAssign(r); }}>{t('web.teaching.assign')}</Button>
                      <Button size="sm" variant="ghost" icon={<FilePlus2 size={14} />} onClick={() => setGenerate(r)}>{t('web.fees.generate')}</Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Dialog open={!!form} onClose={() => setForm(null)} title={t('web.fees.newPlan')} wide footer={<Button variant="primary" loading={create.isPending} disabled={!form?.name || !form.items.every((i) => i.feeTypeId && Number(i.amount) > 0)} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        {form && (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField className="sm:col-span-3" label={t('web.common.name')} value={form.name} onValue={(v) => setForm({ ...form, name: v })} placeholder="Class 9 monthly tuition" required />
              <SelectField label={t('web.fees.frequencyLabel')} value={form.frequency} onValue={(v) => setForm({ ...form, frequency: v })} options={feeFrequencies.map((f) => ({ value: f, label: t(`web.fees.frequency.${f}`) }))} />
              <TextField label={t('web.fees.dueDay')} value={form.dueDay} onValue={(v) => setForm({ ...form, dueDay: v.replace(/\D/g, '').slice(0, 2) })} hint={t('web.fees.dueDayHint')} dir="ltr" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('web.fees.items')}</h3>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm({ ...form, items: [...form.items, { feeTypeId: '', amount: '', description: '' }] })}>{t('common.add')}</Button>
              </div>
              {form.items.map((i, idx) => (
                <div key={idx} className="mb-2 grid grid-cols-[1fr_130px_1fr_auto] items-center gap-2">
                  <Select compact ariaLabel={t('web.common.type')} value={i.feeTypeId} onValue={(value) => setForm({ ...form, items: form.items.map((x, j) => (j === idx ? { ...x, feeTypeId: value } : x)) })} placeholder={t('web.common.select')} options={(types.data?.items ?? []).filter((x) => !x.archived).map((x) => ({ value: x.id, label: x.name }))} />
                  <input aria-label={t('fees.amount')} dir="ltr" inputMode="decimal" placeholder="0" className="tabular h-9 rounded-lg border border-line-strong px-2 text-end text-sm" value={i.amount} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === idx ? { ...x, amount: e.target.value.trim() } : x)) })} />
                  <input aria-label={t('web.common.description')} placeholder={t('web.common.description')} className="h-9 rounded-lg border border-line-strong px-2 text-sm" value={i.description} onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x)) })} />
                  <button aria-label={t('common.delete')} disabled={form.items.length === 1} className="p-1 text-muted hover:text-danger-fg disabled:opacity-30" onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== idx) })}><Trash2 size={15} /></button>
                </div>
              ))}
              <p className="tabular text-end text-sm font-semibold">{t('web.common.total')}: {formatMoney(String(total), currency)}</p>
            </div>
            <InlineError error={create.error} />
          </div>
        )}
      </Dialog>
      <Dialog open={!!assign} onClose={() => setAssign(null)} title={t('web.fees.assignPlan', { name: assign?.name ?? '' })} footer={<Button variant="primary" loading={doAssign.isPending} disabled={!a.classOfferingId} onClick={() => doAssign.mutate(undefined)}>{t('web.teaching.assign')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.common.class')} value={a.classOfferingId} onValue={(v) => setA({ ...a, classOfferingId: v, sectionId: '' })} placeholder={t('web.common.select')} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />
          <SelectField label={t('web.common.section')} value={a.sectionId} onValue={(v) => setA({ ...a, sectionId: v })} placeholder={t('web.fees.wholeClass')} options={(cls?.sections ?? []).map((s) => ({ value: s.id, label: `${cls!.gradeName} ${s.name}` }))} />
          <TextField label={t('web.common.startDate')} type="date" value={a.startDate} onValue={(v) => setA({ ...a, startDate: v })} />
          <TextField label={t('web.fees.discount')} value={a.discountPercentage} onValue={(v) => setA({ ...a, discountPercentage: v })} hint={t('web.fees.discountHint')} dir="ltr" />
          <InlineError error={doAssign.error} />
        </div>
      </Dialog>
      <Dialog open={!!generate} onClose={() => setGenerate(null)} title={t('web.fees.generateFor', { name: generate?.name ?? '' })} footer={<Button variant="primary" loading={doGenerate.isPending} onClick={() => doGenerate.mutate(undefined)}>{t('web.fees.generate')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.fees.period')} value={g.periodLabel} onValue={(v) => setG({ ...g, periodLabel: v })} hint={t('web.fees.periodHint')} dir="ltr" />
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('web.fees.issueDate')} type="date" value={g.issueDate} onValue={(v) => setG({ ...g, issueDate: v })} />
            <TextField label={t('fees.dueDate')} type="date" value={g.dueDate} onValue={(v) => setG({ ...g, dueDate: v })} />
          </div>
          <p className="text-[13px] text-muted">{t('web.fees.generateHint')}</p>
          <InlineError error={doGenerate.error} />
        </div>
      </Dialog>
    </Card>
  );
}

function FeeTypes() {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: FeeType[] }>(['fee-types'], '/fee-types');
  const [f, setF] = useState({ code: '', name: '', nameUr: '', kind: 'tuition' });
  const create = useAction(() => api.post('/fee-types', { ...f, nameUr: f.nameUr || null }), { invalidate: [['fee-types']], success: t('web.common.created'), onSuccess: () => setF({ code: '', name: '', nameUr: '', kind: 'tuition' }) });
  return (
    <Card title={t('web.fees.types')}>
      <ul className="mb-4 flex flex-wrap gap-1.5">
        {(q.data?.items ?? []).map((x) => (
          <li key={x.id} className="rounded-full border border-line px-2.5 py-0.5 text-[13px]">
            <code className="text-muted">{x.code}</code> {lang === 'ur' && x.nameUr ? x.nameUr : x.name}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" />
        <SelectField label={t('web.common.type')} value={f.kind} onValue={(v) => setF({ ...f, kind: v })} options={feeKinds.map((k) => ({ value: k, label: t(`web.fees.kinds.${k}`) }))} />
        <TextField className="col-span-2" label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
        <TextField className="col-span-2" label={t('web.common.nameUr')} value={f.nameUr} onValue={(v) => setF({ ...f, nameUr: v })} dir="rtl" />
        <Button className="col-span-2" loading={create.isPending} disabled={!f.code || !f.name} onClick={() => create.mutate(undefined)}>{t('common.add')}</Button>
      </div>
      <InlineError error={create.error} />
    </Card>
  );
}

function RemindersDialog({ currency, onClose }: { currency: string; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const toast = useToast();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const [filters, setFilters] = useState({ overdueOnly: true, classOfferingId: '', minimumBalance: '' });
  const [candidates, setCandidates] = useState<z.infer<typeof reminderCandidate>[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const preview = useAction(
    () => api.post<{ items: z.infer<typeof reminderCandidate>[] }>('/fees/reminders/preview', { overdueOnly: filters.overdueOnly, classOfferingId: filters.classOfferingId || undefined, minimumBalance: filters.minimumBalance || undefined }),
    { onSuccess: (r) => { setCandidates(r.items); setSelected(new Set(r.items.map((c) => c.studentId))); } },
  );
  const send = useAction(() => api.post<{ sent: number }>('/fees/reminders/send', { studentIds: [...selected] }), {
    onSuccess: (r) => { toast(t('web.fees.remindersSent', { count: r.sent })); onClose(); },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('web.fees.reminders')}
      wide
      footer={candidates ? <Button variant="primary" loading={send.isPending} disabled={!selected.size} onClick={() => send.mutate(undefined)}>{t('web.fees.sendTo', { count: selected.size })}</Button> : <Button variant="primary" loading={preview.isPending} onClick={() => preview.mutate(undefined)}>{t('web.fees.preview')}</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">{t('web.fees.remindersHint')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label={t('web.common.class')} value={filters.classOfferingId} onValue={(v) => { setFilters({ ...filters, classOfferingId: v }); setCandidates(null); }} placeholder={t('common.all')} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />
          <TextField label={t('web.fees.minimumBalance')} value={filters.minimumBalance} onValue={(v) => { setFilters({ ...filters, minimumBalance: v }); setCandidates(null); }} dir="ltr" />
          <div className="flex items-end pb-2">
            <Checkbox label={t('web.fees.overdueOnly')} checked={filters.overdueOnly} onChange={(v) => { setFilters({ ...filters, overdueOnly: v }); setCandidates(null); }} />
          </div>
        </div>
        {candidates && (
          <DataTable
            rows={candidates}
            rowKey={(r) => r.studentId}
            empty={<EmptyState title={t('web.fees.noCandidates')} />}
            columns={[
              { key: 'c', header: '', cell: (r) => <input type="checkbox" aria-label={r.displayName} className="accent-accent-600" checked={selected.has(r.studentId)} onChange={(e) => { const s = new Set(selected); if (e.target.checked) s.add(r.studentId); else s.delete(r.studentId); setSelected(s); }} /> },
              { key: 'n', header: t('web.common.student'), cell: (r) => <div><p className="font-medium">{r.displayName}</p><p className="text-[12px] text-muted">{r.admissionNumber}</p></div> },
              { key: 'b', header: t('fees.balance'), numeric: true, cell: (r) => formatMoney(r.balance, currency) },
              { key: 'o', header: t('fees.overdue'), numeric: true, cell: (r) => formatMoney(r.overdue, currency) },
              { key: 'd', header: t('web.fees.oldestDue'), cell: (r) => formatDate(r.oldestDueDate, lang) },
            ]}
          />
        )}
        <InlineError error={preview.error ?? send.error} />
      </div>
    </Dialog>
  );
}
