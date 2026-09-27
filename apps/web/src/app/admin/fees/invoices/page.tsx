'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceSummary, Page, z } from '@edventure/contracts';
import { feeType } from '@edventure/contracts';
import { PersonPicker, type PickedPerson } from '@/components/people/person-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, Select, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { addDays, feeTone, formatDate, formatMoney, todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useApi, useLang, useSectionOptions } from '@/lib/hooks';

type ChargeForm = { student: PickedPerson | null; periodLabel: string; issueDate: string; dueDate: string; lines: Array<{ feeTypeId: string; description: string; amount: string }> };

export default function InvoicesPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [feeStatus, setFeeStatus] = useState('outstanding');
  const [includeVoid, setIncludeVoid] = useState(false);
  const [limit, setLimit] = useState(50);
  const query = { studentId: student?.id, sectionId: sectionId || undefined, periodLabel: periodLabel || undefined, feeStatus: feeStatus || undefined, includeVoid: includeVoid ? 'true' : undefined, limit };
  const q = useApi<Page<InvoiceSummary>>(['invoices', query], '/invoices', query);
  const types = useApi<{ items: z.infer<typeof feeType>[] }>(['fee-types'], '/fee-types');
  const [charge, setCharge] = useState<ChargeForm | null>(null);
  const create = useAction(
    () =>
      api.post<{ id: string }>('/invoices', {
        studentId: charge!.student!.id,
        periodLabel: charge!.periodLabel || 'MISC',
        issueDate: charge!.issueDate,
        dueDate: charge!.dueDate,
        lines: charge!.lines.map((l) => ({ feeTypeId: l.feeTypeId, description: l.description, amount: l.amount })),
      }),
    { invalidate: [['invoices'], ['fee-summary']], onSuccess: (inv) => router.push(`/admin/fees/invoices/${inv.id}`) },
  );

  return (
    <>
      <PageHeader
        title={t('web.nav.invoices')}
        subtitle={t('web.fees.invoicesSubtitle')}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCharge({ student: null, periodLabel: 'MISC', issueDate: todayLocal(), dueDate: addDays(todayLocal(), 10), lines: [{ feeTypeId: '', description: '', amount: '' }] })}>{t('web.fees.newCharge')}</Button>}
      />
      <Toolbar>
        <div className="w-64"><PersonPicker label={t('web.common.student')} value={student} onChange={setStudent} /></div>
        <SelectField className="w-44" label={t('web.common.section')} value={sectionId} onValue={setSectionId} placeholder={t('common.all')} options={sections.options} />
        <TextField className="w-32" label={t('web.fees.period')} value={periodLabel} onValue={setPeriodLabel} placeholder="2026-10" dir="ltr" />
        <SelectField
          className="w-44"
          label={t('common.status')}
          value={feeStatus}
          onValue={setFeeStatus}
          placeholder={t('common.all')}
          options={[
            { value: 'outstanding', label: t('web.fees.outstanding') },
            { value: 'overdue', label: t('fees.overdue') },
            { value: 'unpaid', label: t('fees.unpaid') },
            { value: 'partially_paid', label: t('fees.partially_paid') },
            { value: 'paid', label: t('fees.paid') },
          ]}
        />
        <div className="pb-2"><Checkbox label={t('web.fees.includeVoid')} checked={includeVoid} onChange={setIncludeVoid} /></div>
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/fees/invoices/${r.id}`)}
            empty={<EmptyState title={t('web.fees.noInvoices')} />}
            footer={q.data?.nextCursor ? <Button size="sm" onClick={() => setLimit((l) => Math.min(100, l + 50))}>{t('common.loadMore')}</Button> : undefined}
            columns={[
              { key: 'no', header: t('fees.invoice'), nowrap: true, cell: (r) => <span className="font-sans text-[13px]">{r.invoiceNumber}</span> },
              { key: 's', header: t('web.common.student'), cell: (r) => <div><p className="font-medium">{r.studentName}</p><p className="text-[12px] text-muted">{r.admissionNumber}</p></div> },
              { key: 'p', header: t('web.fees.period'), cell: (r) => r.periodLabel },
              { key: 'd', header: t('fees.dueDate'), nowrap: true, cell: (r) => <span className={r.overdue ? 'text-danger-fg' : ''}>{formatDate(r.dueDate, lang)}</span> },
              { key: 't', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.totalAmount) },
              { key: 'b', header: t('fees.balance'), numeric: true, cell: (r) => <span className="font-medium">{formatMoney(r.balance)}</span> },
              { key: 'st', header: t('common.status'), cell: (r) => (r.status === 'void' ? <Badge>{t('web.fees.void')}</Badge> : <span className="flex gap-1"><Badge tone={feeTone[r.feeStatus]}>{t(`fees.${r.feeStatus}`)}</Badge>{r.overdue && <Badge tone="danger">{t('fees.overdue')}</Badge>}</span>) },
            ]}
          />
        )}
      </Card>
      <Dialog open={!!charge} onClose={() => setCharge(null)} title={t('web.fees.newCharge')} wide footer={<Button variant="primary" loading={create.isPending} disabled={!charge?.student || !charge.lines.every((l) => l.feeTypeId && l.description && Number(l.amount) > 0)} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        {charge && (
          <div className="grid gap-3">
            <PersonPicker label={t('web.common.student')} value={charge.student} onChange={(p) => setCharge({ ...charge, student: p })} required />
            <div className="grid gap-2 sm:grid-cols-3">
              <TextField label={t('web.fees.period')} value={charge.periodLabel} onValue={(v) => setCharge({ ...charge, periodLabel: v })} dir="ltr" />
              <TextField label={t('web.fees.issueDate')} type="date" value={charge.issueDate} onValue={(v) => setCharge({ ...charge, issueDate: v })} />
              <TextField label={t('fees.dueDate')} type="date" value={charge.dueDate} onValue={(v) => setCharge({ ...charge, dueDate: v })} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{t('web.fees.items')}</h3>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setCharge({ ...charge, lines: [...charge.lines, { feeTypeId: '', description: '', amount: '' }] })}>{t('common.add')}</Button>
              </div>
              {charge.lines.map((l, i) => (
                <div key={i} className="mb-2 grid grid-cols-[1fr_1.4fr_120px_auto] items-center gap-2">
                  <Select compact ariaLabel={t('web.common.type')} value={l.feeTypeId} onValue={(value) => { const ft = types.data?.items.find((x) => x.id === value); setCharge({ ...charge, lines: charge.lines.map((x, j) => (j === i ? { ...x, feeTypeId: value, description: x.description || ft?.name || '' } : x)) }); }} placeholder={t('web.common.select')} options={(types.data?.items ?? []).filter((x) => !x.archived).map((x) => ({ value: x.id, label: x.name }))} />
                  <input aria-label={t('web.common.description')} placeholder={t('web.common.description')} className="h-9 rounded-lg border border-line-strong px-2 text-sm" value={l.description} onChange={(e) => setCharge({ ...charge, lines: charge.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                  <input aria-label={t('fees.amount')} dir="ltr" inputMode="decimal" className="tabular h-9 rounded-lg border border-line-strong px-2 text-end text-sm" value={l.amount} onChange={(e) => setCharge({ ...charge, lines: charge.lines.map((x, j) => (j === i ? { ...x, amount: e.target.value.trim() } : x)) })} />
                  <button aria-label={t('common.delete')} disabled={charge.lines.length === 1} className="p-1 text-muted hover:text-danger-fg disabled:opacity-30" onClick={() => setCharge({ ...charge, lines: charge.lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted">{t('web.fees.chargeHint')}</p>
            <InlineError error={create.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}
