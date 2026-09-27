'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from '@edventure/contracts';
import { adjustmentKinds, invoiceDetail } from '@edventure/contracts';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, Grid, PageHeader, Stat } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { feeTone, formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

type Invoice = z.infer<typeof invoiceDetail>;

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<Invoice>(['invoice', id], `/invoices/${id}`);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adj, setAdj] = useState({ kind: 'waiver', amount: '', reason: '' });
  const [reversing, setReversing] = useState<string | null>(null);
  const invalidate = [['invoice', id], ['invoices'], ['fee-summary']];
  const voidInvoice = useAction(() => api.post(`/invoices/${id}/void`, { reason, version: q.data!.version }), { invalidate, success: t('web.fees.voidedToast'), onSuccess: () => setVoiding(false) });
  const addAdjustment = useAction(() => api.post('/adjustments', { studentId: q.data!.studentId, invoiceId: id, kind: adj.kind, amount: adj.amount, reason: adj.reason }), {
    invalidate,
    success: t('web.common.created'),
    onSuccess: () => setAdjusting(false),
  });
  const reverseAdjustment = useAction(() => api.post(`/adjustments/${reversing}/reverse`, { reason }), { invalidate, success: t('web.common.updated'), onSuccess: () => setReversing(null) });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const inv = q.data;
  const open = inv.status === 'open';

  return (
    <>
      <PageHeader
        back={<Link href="/admin/fees/invoices" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('web.nav.invoices')}</Link>}
        title={`${t('fees.invoice')} ${inv.invoiceNumber}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/students/${inv.studentId}`} className="font-medium text-accent-700 hover:underline">{inv.studentName}</Link>
            <span>{inv.admissionNumber} · {inv.periodLabel}</span>
            {inv.status === 'void' ? <Badge>{t('web.fees.void')}</Badge> : <Badge tone={feeTone[inv.feeStatus]}>{t(`fees.${inv.feeStatus}`)}</Badge>}
            {inv.overdue && open && <Badge tone="danger">{t('fees.overdue')}</Badge>}
          </span>
        }
        actions={
          <>
            <Button icon={<Printer size={16} />} onClick={() => window.print()}>{t('common.print')}</Button>
            {open && Number(inv.balance) > 0 && <Button onClick={() => { setAdj({ kind: 'waiver', amount: '', reason: '' }); setAdjusting(true); }}>{t('web.fees.addAdjustment')}</Button>}
            {open && Number(inv.balance) > 0 && <LinkButton variant="primary" href={`/admin/fees/payments?studentId=${inv.studentId}&invoiceId=${inv.id}`}>{t('web.fees.recordPayment')}</LinkButton>}
            {open && <Button variant="danger" onClick={() => { setReason(''); setVoiding(true); }}>{t('web.fees.voidInvoice')}</Button>}
          </>
        }
      />
      <Grid cols={4} className="mb-4">
        <Stat label={t('fees.amount')} value={formatMoney(inv.totalAmount)} />
        <Stat label={t('fees.paidAmount')} value={formatMoney(inv.paidAmount)} />
        <Stat label={t('web.fees.adjusted')} value={formatMoney(inv.adjustedAmount)} />
        <Stat label={t('fees.balance')} value={formatMoney(inv.balance)} tone={inv.overdue && open ? 'danger' : undefined} hint={`${t('fees.dueDate')}: ${formatDate(inv.dueDate, lang)}`} />
      </Grid>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('web.fees.items')} padded={false}>
          <DataTable
            rows={inv.lines}
            rowKey={(r) => r.id}
            columns={[
              { key: 'd', header: t('web.common.description'), cell: (r) => <div><p>{r.description}</p><p className="text-[12px] text-muted">{r.feeTypeName}{r.source !== 'plan' ? ` · ${t(`web.fees.source.${r.source}`)}` : ''}</p></div> },
              { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.amount) },
            ]}
            footer={<p className="tabular text-end text-sm font-semibold">{t('web.common.total')}: {formatMoney(inv.totalAmount)}</p>}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('web.nav.payments')} padded={false}>
            <DataTable
              rows={inv.allocations}
              rowKey={(r) => r.id}
              empty={<p className="px-5 py-4 text-[13px] text-muted">{t('web.fees.noPayments')}</p>}
              columns={[
                { key: 'r', header: t('fees.receipt'), cell: (r) => <span className={r.reversed ? 'line-through' : ''}>{r.receiptNumber}</span> },
                { key: 'd', header: t('common.date'), cell: (r) => formatDate(r.receivedOn, lang) },
                { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.amount) },
                { key: 's', header: '', cell: (r) => (r.reversed ? <Badge tone="danger">{t('web.fees.reversed')}</Badge> : null) },
              ]}
            />
          </Card>
          <Card title={t('web.fees.adjustments')} padded={false}>
            <DataTable
              rows={inv.adjustments}
              rowKey={(r) => r.id}
              empty={<p className="px-5 py-4 text-[13px] text-muted">{t('web.fees.noAdjustments')}</p>}
              columns={[
                { key: 'k', header: t('web.common.type'), cell: (r) => <div><p className={r.reversed ? 'line-through' : ''}>{t(`web.fees.adjustmentKinds.${r.kind}`)}</p><p className="text-[12px] text-muted">{r.reason}</p></div> },
                { key: 'd', header: t('common.date'), cell: (r) => formatDateTime(r.createdAt, lang) },
                { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.amount) },
                { key: 'x', header: '', cell: (r) => (r.reversed ? <Badge tone="danger">{t('web.fees.reversed')}</Badge> : open ? <Button size="sm" variant="ghost" onClick={() => { setReason(''); setReversing(r.id); }}>{t('web.fees.reverse')}</Button> : null) },
              ]}
            />
          </Card>
        </div>
      </div>

      <Dialog open={voiding} onClose={() => setVoiding(false)} title={t('web.fees.voidInvoice')} footer={<Button variant="danger" loading={voidInvoice.isPending} disabled={reason.trim().length < 3} onClick={() => voidInvoice.mutate(undefined)}>{t('web.fees.voidInvoice')}</Button>}>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted">{t('web.fees.voidHint')}</p>
          <TextField label={t('web.common.reason')} value={reason} onValue={setReason} required />
          <InlineError error={voidInvoice.error} />
        </div>
      </Dialog>
      <Dialog open={adjusting} onClose={() => setAdjusting(false)} title={t('web.fees.addAdjustment')} footer={<Button variant="primary" loading={addAdjustment.isPending} disabled={!(Number(adj.amount) > 0) || adj.reason.trim().length < 3} onClick={() => addAdjustment.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.common.type')} value={adj.kind} onValue={(v) => setAdj({ ...adj, kind: v })} options={adjustmentKinds.filter((k) => k !== 'refund').map((k) => ({ value: k, label: t(`web.fees.adjustmentKinds.${k}`) }))} />
          <TextField label={t('fees.amount')} value={adj.amount} onValue={(v) => setAdj({ ...adj, amount: v.trim() })} hint={t('web.fees.upTo', { amount: formatMoney(inv.balance) })} dir="ltr" />
          <TextField label={t('web.common.reason')} value={adj.reason} onValue={(v) => setAdj({ ...adj, reason: v })} required />
          <InlineError error={addAdjustment.error} />
        </div>
      </Dialog>
      <Dialog open={!!reversing} onClose={() => setReversing(null)} title={t('web.fees.reverseAdjustment')} footer={<Button variant="danger" loading={reverseAdjustment.isPending} disabled={reason.trim().length < 3} onClick={() => reverseAdjustment.mutate(undefined)}>{t('web.fees.reverse')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.reason')} value={reason} onValue={setReason} required />
          <InlineError error={reverseAdjustment.error} />
        </div>
      </Dialog>
    </>
  );
}
