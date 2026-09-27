'use client';

import { Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceSummary, Page, Payment, StudentDetail, z } from '@edventure/contracts';
import { bankAccount, paymentMethods } from '@edventure/contracts';
import { PersonPicker, type PickedPerson } from '@/components/people/person-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, DefinitionList, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, newIdempotencyKey } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

function PaymentsList() {
  const { t } = useTranslation();
  const lang = useLang();
  const params = useSearchParams();
  const router = useRouter();
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const [unallocated, setUnallocated] = useState(params.get('unallocated') === 'true');
  const [range, setRange] = useState({ from: '', to: '' });
  const [limit, setLimit] = useState(50);
  const query = { studentId: student?.id, unallocated: unallocated ? 'true' : undefined, from: range.from || undefined, to: range.to || undefined, limit };
  const q = useApi<Page<Payment>>(['payments', query], '/payments', query);
  const [recording, setRecording] = useState<{ student: PickedPerson | null; invoiceId?: string } | null>(null);
  const [open, setOpen] = useState<Payment | null>(null);

  // Deep link from an invoice: /admin/fees/payments?studentId=…&invoiceId=…
  const linkedStudentId = params.get('studentId');
  const linked = useApi<StudentDetail>(['student', linkedStudentId], linkedStudentId ? `/students/${linkedStudentId}` : null);
  useEffect(() => {
    if (linked.data) setRecording({ student: { kind: 'student', id: linked.data.id, displayName: linked.data.displayName, detail: linked.data.admissionNumber }, invoiceId: params.get('invoiceId') ?? undefined });
  }, [linked.data, params]);

  return (
    <>
      <PageHeader title={t('web.nav.payments')} subtitle={t('web.fees.paymentsSubtitle')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setRecording({ student: null })}>{t('web.fees.recordPayment')}</Button>} />
      <Toolbar>
        <div className="w-64"><PersonPicker label={t('web.common.student')} value={student} onChange={setStudent} /></div>
        <TextField className="w-40" label={t('common.from')} type="date" value={range.from} onValue={(v) => setRange({ ...range, from: v })} />
        <TextField className="w-40" label={t('common.to')} type="date" value={range.to} onValue={(v) => setRange({ ...range, to: v })} />
        <div className="pb-2"><Checkbox label={t('web.fees.unallocatedOnly')} checked={unallocated} onChange={setUnallocated} /></div>
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={setOpen}
            empty={<EmptyState title={t('web.fees.noPaymentsFound')} />}
            footer={q.data?.nextCursor ? <Button size="sm" onClick={() => setLimit((l) => Math.min(100, l + 50))}>{t('common.loadMore')}</Button> : undefined}
            columns={[
              { key: 'r', header: t('fees.receipt'), nowrap: true, cell: (r) => <span className="font-sans text-[13px]">{r.receiptNumber}</span> },
              { key: 'd', header: t('common.date'), nowrap: true, cell: (r) => formatDate(r.receivedOn, lang) },
              { key: 's', header: t('web.common.student'), cell: (r) => r.studentName ?? <span className="text-muted">{t('web.fees.unidentified')}</span> },
              { key: 'm', header: t('web.fees.method'), cell: (r) => t(`web.fees.methods.${r.method}`) },
              { key: 'ref', header: t('web.fees.reference'), cell: (r) => <span className="text-[13px] text-muted">{r.bankTransactionId ?? r.payerReference ?? '—'}</span> },
              { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => <span className={r.status === 'reversed' ? 'line-through' : 'font-medium'}>{formatMoney(r.amount)}</span> },
              { key: 'u', header: t('web.fees.unallocated'), numeric: true, cell: (r) => (Number(r.unallocated) > 0 && r.status === 'posted' ? <Badge tone="warning">{formatMoney(r.unallocated)}</Badge> : '—') },
              { key: 'st', header: '', cell: (r) => (r.status === 'reversed' ? <Badge tone="danger">{t('web.fees.reversed')}</Badge> : null) },
            ]}
          />
        )}
      </Card>
      {recording && (
        <RecordPaymentDialog
          initial={recording}
          onClose={() => {
            setRecording(null);
            // Drop the deep-link parameters so a refresh does not reopen the dialog.
            if (linkedStudentId) router.replace('/admin/fees/payments');
          }}
        />
      )}
      {open && <PaymentDialog payment={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsList />
    </Suspense>
  );
}

/** Explicit per-invoice amounts for a student's open invoices. */
function AllocationEditor({ studentId, value, onChange, focusInvoiceId }: { studentId: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void; focusInvoiceId?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<Page<InvoiceSummary>>(['invoices', 'open', studentId], '/invoices', { studentId, feeStatus: 'outstanding', limit: 50 });
  useEffect(() => {
    if (focusInvoiceId && q.data && !Object.keys(value).length) {
      const inv = q.data.items.find((i) => i.id === focusInvoiceId);
      if (inv) onChange({ [inv.id]: inv.balance });
    }
    // Pre-fill only when the invoices arrive, not on every edit.
  }, [q.data, focusInvoiceId]);
  if (q.isLoading) return <LoadingBlock />;
  const items = q.data?.items ?? [];
  if (!items.length) return <p className="text-[13px] text-muted">{t('web.fees.noOpenInvoices')}</p>;
  return (
    <div className="rounded-lg border border-line">
      {items.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-0">
          <div className="text-[13px]">
            <p className="font-medium">{i.invoiceNumber} · {i.periodLabel}</p>
            <p className="text-muted">{t('fees.dueDate')} {formatDate(i.dueDate, lang)} · {t('fees.balance')} {formatMoney(i.balance)}</p>
          </div>
          <input
            aria-label={`${t('fees.amount')} ${i.invoiceNumber}`}
            dir="ltr"
            inputMode="decimal"
            placeholder="0"
            className="tabular h-9 w-28 rounded-lg border border-line-strong px-2 text-end text-sm"
            value={value[i.id] ?? ''}
            onChange={(e) => onChange({ ...value, [i.id]: e.target.value.trim() })}
          />
        </div>
      ))}
    </div>
  );
}

const allocationsOf = (v: Record<string, string>) =>
  Object.entries(v)
    .filter(([, a]) => Number(a) > 0)
    .map(([invoiceId, amount]) => ({ invoiceId, amount }));

function RecordPaymentDialog({ initial, onClose }: { initial: { student: PickedPerson | null; invoiceId?: string }; onClose: () => void }) {
  const { t } = useTranslation();
  const accounts = useApi<{ items: z.infer<typeof bankAccount>[] }>(['bank-accounts'], '/bank-accounts');
  const [student, setStudent] = useState(initial.student);
  const [f, setF] = useState({ method: 'bank', amount: '', receivedOn: todayLocal(), bankAccountId: '', bankTransactionId: '', payerReference: '', description: '' });
  const [explicit, setExplicit] = useState(!!initial.invoiceId);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [idem] = useState(newIdempotencyKey);
  const allocations = allocationsOf(alloc);
  const allocatedTotal = allocations.reduce((s, a) => s + Number(a.amount), 0);
  useEffect(() => {
    // Opened from an invoice: suggest paying its balance.
    if (initial.invoiceId && allocatedTotal > 0) setF((s) => (s.amount ? s : { ...s, amount: allocatedTotal.toFixed(2) }));
  }, [initial.invoiceId, allocatedTotal]);
  const save = useAction(
    () =>
      api.post<Payment>(
        '/payments',
        {
          studentId: student?.id ?? null,
          method: f.method,
          amount: f.amount,
          receivedOn: f.receivedOn,
          bankAccountId: f.bankAccountId || null,
          bankTransactionId: f.bankTransactionId || null,
          payerReference: f.payerReference || null,
          description: f.description || null,
          allocations: student && explicit ? allocations : undefined,
        },
        { idempotencyKey: idem },
      ),
    { invalidate: [['payments'], ['invoices'], ['invoice'], ['fee-summary']], success: t('web.fees.paymentRecorded'), onSuccess: onClose },
  );
  const over = explicit && allocatedTotal > Number(f.amount || 0);
  return (
    <Dialog open onClose={onClose} title={t('web.fees.recordPayment')} wide footer={<Button variant="primary" loading={save.isPending} disabled={!(Number(f.amount) > 0) || over} onClick={() => save.mutate(undefined)}>{t('common.save')}</Button>}>
      <div className="grid gap-3">
        <PersonPicker label={t('web.common.student')} value={student} onChange={(p) => { setStudent(p); setAlloc({}); }} />
        {!student && <p className="text-[13px] text-muted">{t('web.fees.unidentifiedHint')}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label={t('web.fees.method')} value={f.method} onValue={(v) => setF({ ...f, method: v })} options={paymentMethods.map((m) => ({ value: m, label: t(`web.fees.methods.${m}`) }))} />
          <TextField label={t('fees.amount')} value={f.amount} onValue={(v) => setF({ ...f, amount: v.trim() })} dir="ltr" required />
          <TextField label={t('web.fees.receivedOn')} type="date" value={f.receivedOn} onValue={(v) => setF({ ...f, receivedOn: v })} />
        </div>
        {f.method === 'bank' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={t('web.fees.bankAccount')} value={f.bankAccountId} onValue={(v) => setF({ ...f, bankAccountId: v })} placeholder={t('web.common.none')} options={(accounts.data?.items ?? []).filter((a) => !a.archived).map((a) => ({ value: a.id, label: `${a.name} (${a.bankName})` }))} />
            <TextField label={t('web.fees.transactionId')} value={f.bankTransactionId} onValue={(v) => setF({ ...f, bankTransactionId: v })} hint={t('web.fees.transactionIdHint')} dir="ltr" />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('web.fees.payerReference')} value={f.payerReference} onValue={(v) => setF({ ...f, payerReference: v })} />
          <TextField label={t('web.common.description')} value={f.description} onValue={(v) => setF({ ...f, description: v })} />
        </div>
        {student && (
          <>
            <Checkbox label={t('web.fees.chooseInvoices')} hint={t('web.fees.chooseInvoicesHint')} checked={explicit} onChange={setExplicit} />
            {explicit && <AllocationEditor studentId={student.id} value={alloc} onChange={setAlloc} focusInvoiceId={initial.invoiceId} />}
            {explicit && <p className={`tabular text-end text-[13px] ${over ? 'text-danger-fg' : 'text-muted'}`}>{t('web.fees.allocatedOf', { allocated: formatMoney(String(allocatedTotal)), amount: formatMoney(f.amount || '0') })}</p>}
          </>
        )}
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}

function PaymentDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const [mode, setMode] = useState<'view' | 'allocate' | 'reverse'>('view');
  const [student, setStudent] = useState<PickedPerson | null>(payment.studentId ? { kind: 'student', id: payment.studentId, displayName: payment.studentName ?? '', detail: '' } : null);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const invalidate = [['payments'], ['invoices'], ['invoice'], ['fee-summary']];
  const allocate = useAction(() => api.post(`/payments/${payment.id}/allocations`, { studentId: student?.id ?? null, allocations: allocationsOf(alloc) }), { invalidate, success: t('web.common.updated'), onSuccess: onClose });
  const reverse = useAction(() => api.post(`/payments/${payment.id}/reverse`, { reason }), { invalidate, success: t('web.fees.paymentReversed'), onSuccess: onClose });
  const posted = payment.status === 'posted';
  const allocatedTotal = allocationsOf(alloc).reduce((s, a) => s + Number(a.amount), 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('fees.receipt')} ${payment.receiptNumber}`}
      wide
      footer={
        mode === 'view' ? (
          posted ? (
            <>
              <Button variant="danger" onClick={() => setMode('reverse')}>{t('web.fees.reverse')}</Button>
              {Number(payment.unallocated) > 0 && <Button variant="primary" onClick={() => setMode('allocate')}>{t('web.fees.allocate')}</Button>}
            </>
          ) : undefined
        ) : mode === 'allocate' ? (
          <Button variant="primary" loading={allocate.isPending} disabled={!student || allocatedTotal <= 0 || allocatedTotal > Number(payment.unallocated)} onClick={() => allocate.mutate(undefined)}>{t('web.fees.allocate')}</Button>
        ) : (
          <Button variant="danger" loading={reverse.isPending} disabled={reason.trim().length < 3} onClick={() => reverse.mutate(undefined)}>{t('web.fees.reverse')}</Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <DefinitionList
          items={[
            [t('web.common.student'), payment.studentName ?? t('web.fees.unidentified')],
            [t('fees.amount'), formatMoney(payment.amount)],
            [t('web.fees.method'), t(`web.fees.methods.${payment.method}`)],
            [t('web.fees.receivedOn'), formatDate(payment.receivedOn, lang)],
            [t('web.fees.reference'), payment.bankTransactionId ?? payment.payerReference ?? '—'],
            [t('web.fees.unallocated'), formatMoney(payment.unallocated)],
            [t('web.fees.recordedAt'), formatDateTime(payment.createdAt, lang)],
            [t('common.status'), payment.status === 'reversed' ? `${t('web.fees.reversed')} — ${payment.reversalReason ?? ''}` : t('web.fees.posted')],
          ]}
        />
        {payment.allocations.length > 0 && (
          <DataTable
            rows={payment.allocations}
            rowKey={(r) => r.id}
            columns={[
              { key: 'i', header: t('fees.invoice'), cell: (r) => <span className={r.reversed ? 'line-through' : ''}>{r.invoiceNumber}</span> },
              { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney(r.amount) },
            ]}
          />
        )}
        {mode === 'allocate' && (
          <div className="grid gap-3 border-t border-line pt-4">
            <PersonPicker label={t('web.common.student')} value={student} onChange={(p) => { setStudent(p); setAlloc({}); }} required />
            {student && <AllocationEditor studentId={student.id} value={alloc} onChange={setAlloc} />}
            <p className="tabular text-end text-[13px] text-muted">{t('web.fees.allocatedOf', { allocated: formatMoney(String(allocatedTotal)), amount: formatMoney(payment.unallocated) })}</p>
            <InlineError error={allocate.error} />
          </div>
        )}
        {mode === 'reverse' && (
          <div className="grid gap-3 border-t border-line pt-4">
            <p className="text-[13px] text-muted">{t('web.fees.reverseHint')}</p>
            <TextField label={t('web.common.reason')} value={reason} onValue={setReason} required />
            <InlineError error={reverse.error} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
