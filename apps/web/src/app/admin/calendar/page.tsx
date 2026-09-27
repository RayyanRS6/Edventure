'use client';

import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CalendarDay } from '@edventure/contracts';
import { calendarDayKinds } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { InlineError } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatDate, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

const kindTone = { instructional: 'neutral', holiday: 'success', closure: 'danger', exam: 'info', event: 'warning' } as const;
const kindCell: Record<string, string> = {
  holiday: 'bg-success-bg text-success-fg',
  closure: 'bg-danger-bg text-danger-fg',
  exam: 'bg-info-bg text-info-fg',
  event: 'bg-warning-bg text-warning-fg',
  instructional: 'bg-sunken text-ink-soft',
};

type Form = { id: string | null; date: string; kind: string; title: string; titleUr: string; note: string; notify: boolean };

export default function CalendarPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const from = `${month}-01`;
  const to = lastDayOf(month);
  const q = useApi<{ items: CalendarDay[] }>(['calendar', month], '/calendar', { from, to });
  const [form, setForm] = useState<Form | null>(null);
  const save = useAction(
    () => api.put('/calendar', { date: form!.date, kind: form!.kind, title: form!.title, titleUr: form!.titleUr || null, note: form!.note || null, notify: form!.notify }),
    { invalidate: [['calendar']], success: t('web.common.updated'), onSuccess: () => setForm(null) },
  );
  const remove = useAction((id: string) => api.delete(`/calendar/${id}`), { invalidate: [['calendar']], success: t('web.calendar.removed'), onSuccess: () => setForm(null) });

  const byDate = useMemo(() => new Map((q.data?.items ?? []).map((d) => [d.date, d])), [q.data]);
  const cells = useMemo(() => monthGrid(month), [month]);
  const today = todayLocal();
  const openFor = (date: string) => {
    const d = byDate.get(date);
    setForm(d ? { id: d.id, date, kind: d.kind, title: d.title, titleUr: d.titleUr ?? '', note: d.note ?? '', notify: false } : { id: null, date, kind: 'holiday', title: '', titleUr: '', note: '', notify: false });
  };
  const title = formatDate(from, lang, { month: 'long', year: 'numeric' });

  return (
    <>
      <PageHeader
        title={t('web.nav.calendar')}
        subtitle={t('web.calendar.subtitle')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => openFor(today)}>{t('web.calendar.addDay')}</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card
          title={title}
          actions={
            <>
              <Button size="sm" variant="ghost" aria-label={t('common.back')} onClick={() => setMonth(shiftMonth(month, -1))} icon={<ChevronLeft size={16} className="rtl:rotate-180" />} />
              <Button size="sm" variant="ghost" onClick={() => setMonth(today.slice(0, 7))}>{t('common.today')}</Button>
              <Button size="sm" variant="ghost" aria-label={t('common.next')} onClick={() => setMonth(shiftMonth(month, 1))} icon={<ChevronRight size={16} className="rtl:rotate-180" />} />
            </>
          }
        >
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-semibold uppercase tracking-wide text-muted">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="py-1">{t(`web.common.weekday.${d}`).slice(0, lang === 'ur' ? undefined : 3)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const d = byDate.get(date);
              return (
                <button
                  key={date}
                  onClick={() => openFor(date)}
                  className={clsx(
                    'flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 text-start transition-colors hover:border-accent-500',
                    date === today ? 'border-accent-600' : 'border-line',
                  )}
                >
                  <span className={clsx('tabular text-[13px]', date === today ? 'font-semibold text-accent-700' : 'text-ink-soft')}>{Number(date.slice(8))}</span>
                  {d && <span className={clsx('line-clamp-2 w-full rounded px-1 py-0.5 text-[11px] font-medium', kindCell[d.kind])}>{lang === 'ur' && d.titleUr ? d.titleUr : d.title}</span>}
                </button>
              );
            })}
          </div>
        </Card>
        <Card title={t('web.calendar.thisMonth')} padded={false}>
          {(q.data?.items ?? []).length === 0 ? (
            <p className="px-5 py-6 text-center text-muted">{t('web.calendar.nothing')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {q.data!.items.map((d) => (
                <li key={d.id}>
                  <button className="flex w-full items-start justify-between gap-3 px-5 py-3 text-start hover:bg-sunken/60" onClick={() => openFor(d.date)}>
                    <span>
                      <span className="block font-medium">{lang === 'ur' && d.titleUr ? d.titleUr : d.title}</span>
                      <span className="text-[13px] text-muted">{formatDate(d.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </span>
                    <Badge tone={kindTone[d.kind]}>{t(`web.calendar.kinds.${d.kind}`)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={!!form}
        onClose={() => setForm(null)}
        title={form ? formatDate(form.date, lang, { dateStyle: 'full' }) : ''}
        footer={
          <>
            {form?.id && <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(form.id!)}>{t('web.calendar.remove')}</Button>}
            <Button variant="primary" loading={save.isPending} disabled={!form?.title} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-3">
            <TextField label={t('common.date')} type="date" value={form.date} onValue={(v) => setForm({ ...form, date: v })} />
            <SelectField label={t('web.common.type')} value={form.kind} onValue={(v) => setForm({ ...form, kind: v })} options={calendarDayKinds.map((k) => ({ value: k, label: t(`web.calendar.kinds.${k}`) }))} />
            <p className="text-[13px] text-muted">{t(`web.calendar.kindHints.${form.kind}`)}</p>
            <TextField label={t('web.common.title')} value={form.title} onValue={(v) => setForm({ ...form, title: v })} required />
            <TextField label={t('web.calendar.titleUr')} value={form.titleUr} onValue={(v) => setForm({ ...form, titleUr: v })} dir="rtl" />
            <TextField label={t('web.common.note')} value={form.note} onValue={(v) => setForm({ ...form, note: v })} />
            {(form.kind === 'holiday' || form.kind === 'closure') && <Checkbox label={t('web.calendar.notify')} hint={t('web.calendar.notifyHint')} checked={form.notify} onChange={(v) => setForm({ ...form, notify: v })} />}
            <InlineError error={save.error ?? remove.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}

function lastDayOf(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Monday-first grid of dates for the month, padded with nulls. */
function monthGrid(month: string) {
  const first = new Date(`${month}-01T00:00:00Z`);
  const pad = (first.getUTCDay() + 6) % 7;
  const days = Number(lastDayOf(month).slice(8));
  const cells: Array<string | null> = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  return cells;
}
