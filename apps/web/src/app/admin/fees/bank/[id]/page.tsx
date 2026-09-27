'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportBatch, ImportRow, InvoiceSummary, Page } from '@edventure/contracts';
import { importRowStatuses } from '@edventure/contracts';
import { PersonPicker, type PickedPerson } from '@/components/people/person-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { Badge, Card, Grid, PageHeader, Stat, Toolbar } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, newIdempotencyKey } from '@/lib/api';
import { formatDate, formatMoney, stateTone } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

type Detail = ImportBatch & { rows: ImportRow[]; nextCursor: string | null };
type Normalized = { date: string; amount: string; reference: string | null; transactionId: string | null; description: string | null };
type Evidence = { match?: { by: string; studentId: string; invoiceId?: string; reference: string }; possibleDuplicate?: { receipt?: string; rowNumber?: number }; existingPayment?: { receipt: string }; reason?: string };

const rowTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { matched: 'success', unmatched: 'warning', review: 'danger', duplicate: 'neutral', skipped: 'neutral', invalid: 'danger', committed: 'success' };

export default function BankImportPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const [status, setStatus] = useState('');
  const q = useApi<Detail>(['bank-import', id, status], `/bank-imports/${id}`, { status: status || undefined, limit: 100 });
  const [resolving, setResolving] = useState<ImportRow | null>(null);
  const [student, setStudent] = useState<PickedPerson | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [idem] = useState(newIdempotencyKey);
  const invoices = useApi<Page<InvoiceSummary>>(['invoices', 'open', student?.id], student ? '/invoices' : null, student ? { studentId: student.id, feeStatus: 'outstanding' } : undefined);
  const invalidate = [['bank-import', id], ['bank-imports']];
  const resolve = useAction((body: object) => api.patch(`/bank-imports/${id}/rows/${resolving!.id}`, body), { invalidate, onSuccess: () => setResolving(null) });
  const commit = useAction(() => api.post(`/bank-imports/${id}/commit`, {}, { idempotencyKey: idem }), { invalidate: [...invalidate, ['payments'], ['fee-summary']], success: t('web.bank.committed') });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const b = q.data;
  const count = (k: string) => Number(b.summary[k] ?? 0);
  const openResolve = (r: ImportRow) => {
    setStudent(null);
    setInvoiceId('');
    setResolving(r);
  };

  return (
    <>
      <PageHeader
        back={<Link href="/admin/fees/bank" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('web.nav.bank')}</Link>}
        title={b.fileName}
        subtitle={<Badge tone={stateTone[b.state] ?? 'neutral'}>{t(`web.status.${b.state}`)}</Badge>}
        actions={b.state === 'validated' && <Button variant="primary" loading={commit.isPending} onClick={() => commit.mutate(undefined)}>{t('web.bank.commit')}</Button>}
      />
      <Grid cols={4} className="mb-4">
        <Stat label={t('web.bank.matched')} value={count('matched')} />
        <Stat label={t('web.bank.unmatched')} value={count('unmatched')} hint={t('web.bank.unmatchedHint')} />
        <Stat label={t('web.bank.review')} value={count('review')} tone={count('review') ? 'danger' : undefined} />
        <Stat label={t('web.bank.duplicates')} value={count('duplicate')} hint={t('web.bank.duplicatesHint')} />
      </Grid>
      {b.state === 'validated' && <p className="mb-4 rounded-lg bg-info-bg px-4 py-2 text-[13px] text-info-fg">{t('web.bank.commitHint')}</p>}
      <InlineError error={commit.error} />
      <Toolbar>
        <SelectField className="w-44" label={t('common.status')} value={status} onValue={setStatus} placeholder={t('common.all')} options={importRowStatuses.filter((s) => s !== 'valid').map((s) => ({ value: s, label: t(`web.status.${s}`) }))} />
      </Toolbar>
      <Card padded={false}>
        <DataTable
          rows={b.rows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'n', header: '#', numeric: true, cell: (r) => r.rowNumber },
            { key: 'd', header: t('common.date'), cell: (r) => formatDate((r.normalized as Normalized | null)?.date, lang) },
            { key: 'a', header: t('fees.amount'), numeric: true, cell: (r) => formatMoney((r.normalized as Normalized | null)?.amount) },
            { key: 'r', header: t('web.fees.reference'), cell: (r) => { const n = r.normalized as Normalized | null; return <div className="max-w-xs text-[13px]"><p dir="ltr" className="text-start">{n?.reference ?? '—'}</p><p className="truncate text-muted">{n?.description}</p></div>; } },
            {
              key: 'm',
              header: t('web.bank.matchedTo'),
              cell: (r) => {
                const e = (r.evidence ?? {}) as Evidence;
                const res = r.resolution as { action?: string } | null;
                if (r.outcome) return <span className="text-[13px]">{t('fees.receipt')} {(r.outcome as { receiptNumber?: string }).receiptNumber}</span>;
                if (res?.action === 'allocate') return <span className="text-[13px]">{t('web.bank.manuallyMatched')}</span>;
                if (res?.action === 'unallocated') return <span className="text-[13px] text-muted">{t('web.bank.keepUnallocated')}</span>;
                if (e.match) return <span className="text-[13px]">{t(`web.bank.by.${e.match.by}`, { ref: e.match.reference })}</span>;
                if (e.existingPayment) return <span className="text-[13px] text-muted">{t('web.bank.alreadyRecorded', { receipt: e.existingPayment.receipt })}</span>;
                if (e.possibleDuplicate) return <span className="text-[13px] text-danger-fg">{t('web.bank.possibleDuplicate')}</span>;
                if (r.errors.length) return <span className="text-[13px] text-danger-fg">{r.errors.map((x) => x.message).join('; ')}</span>;
                return e.reason ? <span className="text-[13px] text-muted">{e.reason}</span> : '—';
              },
            },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={rowTone[r.status] ?? 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
            { key: 'x', header: '', cell: (r) => (b.state === 'validated' && ['matched', 'unmatched', 'review', 'skipped'].includes(r.status) ? <Button size="sm" variant="ghost" onClick={() => openResolve(r)}>{t('web.bank.resolve')}</Button> : null) },
          ]}
        />
      </Card>

      <Dialog open={!!resolving} onClose={() => setResolving(null)} title={t('web.bank.resolveRow', { n: resolving?.rowNumber ?? '' })} wide>
        {resolving && (
          <div className="grid gap-4">
            <p className="rounded-lg bg-sunken px-3 py-2 text-[13px]">
              {formatDate((resolving.normalized as Normalized).date, lang)} · <span className="font-semibold">{formatMoney((resolving.normalized as Normalized).amount)}</span> · <span dir="ltr">{(resolving.normalized as Normalized).reference ?? '—'}</span>
              <span className="block text-muted">{(resolving.normalized as Normalized).description}</span>
            </p>
            <div className="grid gap-3 rounded-lg border border-line p-3">
              <p className="font-medium">{t('web.bank.allocateTo')}</p>
              <PersonPicker label={t('web.common.student')} value={student} onChange={(p) => { setStudent(p); setInvoiceId(''); }} />
              {student && <SelectField label={t('fees.invoice')} value={invoiceId} onValue={setInvoiceId} placeholder={t('web.bank.oldestFirst')} options={(invoices.data?.items ?? []).map((i) => ({ value: i.id, label: `${i.invoiceNumber} · ${i.periodLabel} · ${formatMoney(i.balance)}` }))} />}
              <div className="flex justify-end">
                <Button variant="primary" disabled={!student} loading={resolve.isPending} onClick={() => resolve.mutate({ action: 'allocate', studentId: student!.id, invoiceId: invoiceId || null })}>{t('web.fees.allocate')}</Button>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => resolve.mutate({ action: 'unallocated' })}>{t('web.bank.keepUnallocated')}</Button>
              <Button variant="danger" onClick={() => resolve.mutate({ action: 'skip' })}>{t('web.bank.skipRow')}</Button>
            </div>
            <InlineError error={resolve.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}
