'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PromotionBatch, z } from '@edventure/contracts';
import { promotionDecision, promotionDecisionKinds, promotionExecutionResult } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Grid, PageHeader, Stat } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api, newIdempotencyKey } from '@/lib/api';
import { formatPercent, stateTone } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

type Decision = z.infer<typeof promotionDecision>;
const recTone = { promote: 'success', graduate: 'info', repeat: 'warning', review: 'danger' } as const;

export default function PromotionBatchPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const q = useApi<PromotionBatch>(['promotion-batch', id], `/promotion-batches/${id}`);
  const [edit, setEdit] = useState<Decision | null>(null);
  const [f, setF] = useState({ decision: '', destinationSectionId: '', overrideReason: '' });
  const [confirmExecute, setConfirmExecute] = useState(false);
  const [idem] = useState(newIdempotencyKey);
  const invalidate = [['promotion-batch', id], ['promotion-batches']];

  const update = useAction(
    () => api.patch(`/promotion-decisions/${edit!.id}`, { decision: f.decision, destinationSectionId: f.destinationSectionId || null, overrideReason: f.overrideReason || null, version: edit!.version }),
    { invalidate, onSuccess: () => setEdit(null) },
  );
  const approve = useAction(() => api.post(`/promotion-batches/${id}/approve`, { version: q.data!.version }), { invalidate, success: t('web.promotion.approvedToast'), toastErrors: true });
  const execute = useAction(() => api.post<z.infer<typeof promotionExecutionResult>>(`/promotion-batches/${id}/execute`, {}, { idempotencyKey: idem }), {
    invalidate,
    onSuccess: (r) => {
      setConfirmExecute(false);
      toast(t('web.promotion.executedToast', { created: r.created, graduated: r.graduated, skipped: r.skipped }));
    },
  });
  const cancel = useAction(() => api.post(`/promotion-batches/${id}/cancel`), { invalidate, success: t('web.common.updated'), toastErrors: true });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const b = q.data;
  const editable = b.state === 'draft' || b.state === 'reviewed';
  const undecided = b.decisions.filter((d) => !d.decision).length;
  const needsReview = b.decisions.filter((d) => d.recommendation === 'review' && !d.decision).length;
  const destSections = (decision: string) => (decision === 'promote' ? b.destinations.promote?.sections : decision === 'repeat' ? b.destinations.repeat?.sections : undefined) ?? [];
  const final = (d: Decision) => d.decision ?? d.recommendation;

  return (
    <>
      <PageHeader
        back={<Link href="/admin/promotion" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('web.nav.promotion')}</Link>}
        title={t('web.promotion.batchTitle', { grade: b.sourceGradeName })}
        subtitle={<Badge tone={stateTone[b.state] ?? 'info'}>{t(`web.status.${b.state}`)}</Badge>}
        actions={
          <>
            {editable && <Button onClick={() => cancel.mutate(undefined)}>{t('common.cancel')}</Button>}
            {editable && <Button variant="primary" disabled={needsReview > 0} loading={approve.isPending} onClick={() => approve.mutate(undefined)}>{t('leave.approve')}</Button>}
            {b.state === 'approved' && <Button variant="primary" onClick={() => setConfirmExecute(true)}>{t('web.promotion.execute')}</Button>}
          </>
        }
      />
      <Grid cols={4} className="mb-4">
        <Stat label={t('web.promotion.toPromote')} value={b.decisions.filter((d) => final(d) === 'promote').length} hint={b.destinations.promote ? `→ ${b.destinations.promote.gradeName}` : t('web.promotion.noDestination')} />
        <Stat label={t('web.promotion.toRepeat')} value={b.decisions.filter((d) => final(d) === 'repeat').length} />
        <Stat label={t('web.promotion.toGraduate')} value={b.decisions.filter((d) => final(d) === 'graduate').length} />
        <Stat label={t('web.promotion.needsReview')} value={needsReview} tone={needsReview ? 'danger' : undefined} hint={undecided ? t('web.promotion.usingRecommendation', { count: undecided }) : undefined} />
      </Grid>
      {needsReview > 0 && <p className="mb-4 rounded-lg bg-warning-bg px-4 py-2 text-[13px] text-warning-fg">{t('web.promotion.reviewFirst')}</p>}
      <div className="rounded-[var(--radius-card)] border border-line bg-surface">
        <DataTable
          rows={b.decisions}
          rowKey={(r) => r.id}
          onRowClick={editable ? (r) => { setF({ decision: r.decision ?? (r.recommendation === 'review' ? '' : r.recommendation), destinationSectionId: r.destinationSectionId ?? '', overrideReason: r.overrideReason ?? '' }); setEdit(r); } : undefined}
          columns={[
            { key: 'n', header: t('web.common.student'), cell: (r) => <div><p className="font-medium">{r.displayName}</p><p className="text-[12px] text-muted">{r.admissionNumber}{r.sourceSectionName ? ` · ${r.sourceSectionName}` : ''}</p></div> },
            { key: 'r', header: t('web.results.outcome'), cell: (r) => (r.resultOutcome ? <span>{t(`exams.${r.resultOutcome}`)} · <span className="tabular">{formatPercent(r.percentage)}</span></span> : '—') },
            { key: 'rec', header: t('web.promotion.recommendation'), cell: (r) => <Badge tone={recTone[r.recommendation]}>{t(`web.promotion.kinds.${r.recommendation}`)}</Badge> },
            { key: 'd', header: t('web.promotion.decision'), cell: (r) => (r.decision ? <span className="font-medium">{t(`web.promotion.kinds.${r.decision}`)}{r.overrideReason && <span className="block text-[12px] font-normal text-muted">{r.overrideReason}</span>}</span> : <span className="text-muted">{t('web.promotion.asRecommended')}</span>) },
            { key: 'to', header: t('web.promotion.destination'), cell: (r) => r.destinationSectionName ?? '—' },
            { key: 'x', header: '', cell: (r) => (r.executedAt ? <Badge tone="success">{t('web.status.executed')}</Badge> : null) },
          ]}
        />
      </div>

      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.displayName ?? ''} footer={<Button variant="primary" loading={update.isPending} disabled={!f.decision} onClick={() => update.mutate(undefined)}>{t('common.save')}</Button>}>
        {edit && (
          <div className="grid gap-3">
            <p className="text-[13px] text-muted">{t('web.promotion.recommendedAs', { kind: t(`web.promotion.kinds.${edit.recommendation}`) })}</p>
            <SelectField label={t('web.promotion.decision')} value={f.decision} onValue={(v) => setF({ ...f, decision: v, destinationSectionId: '' })} placeholder={t('web.common.select')} options={promotionDecisionKinds.map((k) => ({ value: k, label: t(`web.promotion.kinds.${k}`) }))} />
            {destSections(f.decision).length > 0 && (
              <SelectField label={t('web.promotion.destination')} value={f.destinationSectionId} onValue={(v) => setF({ ...f, destinationSectionId: v })} placeholder={t('web.promotion.autoSection')} options={destSections(f.decision).map((s) => ({ value: s.id, label: s.name }))} />
            )}
            {f.decision && f.decision !== edit.recommendation && <TextField label={t('web.promotion.overrideReason')} value={f.overrideReason} onValue={(v) => setF({ ...f, overrideReason: v })} required />}
            <InlineError error={update.error} />
          </div>
        )}
      </Dialog>
      <Dialog open={confirmExecute} onClose={() => setConfirmExecute(false)} title={t('web.promotion.executeTitle')} footer={<Button variant="primary" loading={execute.isPending} onClick={() => execute.mutate(undefined)}>{t('web.promotion.execute')}</Button>}>
        <p className="mb-2">{t('web.promotion.executeQuestion', { count: b.decisions.length })}</p>
        <p className="text-[13px] text-muted">{t('web.promotion.executeHint')}</p>
        <InlineError error={execute.error} />
      </Dialog>
    </>
  );
}
