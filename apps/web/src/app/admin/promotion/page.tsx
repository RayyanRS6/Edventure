'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PromotionBatch, ResultPublication } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useAction, useApi, useLang, useYears } from '@/lib/hooks';

export default function PromotionPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const years = useYears();
  const q = useApi<{ items: PromotionBatch[] }>(['promotion-batches'], '/promotion-batches');
  const results = useApi<{ items: ResultPublication[] }>(['results', 'published'], '/results');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ resultPublicationId: '', targetAcademicYearId: '' });
  const create = useAction(() => api.post<PromotionBatch>('/promotion-batches', f), {
    invalidate: [['promotion-batches']],
    onSuccess: (b) => router.push(`/admin/promotion/${b.id}`),
  });
  const yearName = (id: string) => years.data?.items.find((y) => y.id === id)?.name ?? '—';
  const finals = (results.data?.items ?? []).filter((r) => r.state === 'published' && r.isFinal);

  return (
    <>
      <PageHeader title={t('web.nav.promotion')} subtitle={t('web.promotion.subtitle')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => { setF({ resultPublicationId: '', targetAcademicYearId: '' }); setOpen(true); }}>{t('web.promotion.new')}</Button>} />
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/promotion/${r.id}`)}
            empty={<EmptyState title={t('web.promotion.none')} hint={t('web.promotion.noneHint')} />}
            columns={[
              { key: 'c', header: t('web.common.class'), cell: (r) => <span className="font-medium">{r.sourceGradeName}</span> },
              { key: 'y', header: t('web.promotion.years'), cell: (r) => `${yearName(r.sourceAcademicYearId)} → ${yearName(r.targetAcademicYearId)}` },
              { key: 'n', header: t('web.results.students'), numeric: true, cell: (r) => r.decisions.length },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? (r.state === 'reviewed' ? 'info' : 'neutral')}>{t(`web.status.${r.state}`)}</Badge> },
              { key: 'e', header: t('web.promotion.executed'), cell: (r) => formatDateTime(r.executedAt, lang) },
            ]}
          />
        )}
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.promotion.new')} footer={<Button variant="primary" loading={create.isPending} disabled={!f.resultPublicationId || !f.targetAcademicYearId} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.promotion.fromResults')} value={f.resultPublicationId} onValue={(v) => setF({ ...f, resultPublicationId: v })} placeholder={t('web.common.select')} options={finals.map((r) => ({ value: r.id, label: `${r.gradeName} · ${r.examCycleName}` }))} />
          {finals.length === 0 && <p className="text-[13px] text-warning-fg">{t('web.promotion.needFinal')}</p>}
          <SelectField label={t('web.promotion.targetYear')} value={f.targetAcademicYearId} onValue={(v) => setF({ ...f, targetAcademicYearId: v })} placeholder={t('web.common.select')} options={(years.data?.items ?? []).filter((y) => y.status !== 'closed').map((y) => ({ value: y.id, label: y.name }))} />
          <p className="text-[13px] text-muted">{t('web.promotion.newHint')}</p>
          <InlineError error={create.error} />
        </div>
      </Dialog>
    </>
  );
}
