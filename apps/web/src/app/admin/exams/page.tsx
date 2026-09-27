'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExamCycle, z } from '@edventure/contracts';
import { examKinds, term } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useLang, useYears } from '@/lib/hooks';

export default function ExamsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const years = useYears();
  const { year: active } = useActiveYear();
  const [yearId, setYearId] = useState('');
  const yid = yearId || active?.id;
  const q = useApi<{ items: ExamCycle[] }>(['exams', yid], yid ? '/exams' : null, yid ? { academicYearId: yid } : undefined);
  const terms = useApi<{ items: z.infer<typeof term>[] }>(['terms', yid], yid ? `/academic-years/${yid}/terms` : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', nameUr: '', kind: 'midterm', termId: '', isFinal: false });
  const create = useAction(() => api.post<ExamCycle>('/exams', { academicYearId: yid, name: f.name, nameUr: f.nameUr || null, kind: f.kind, termId: f.termId || null, isFinal: f.isFinal }), {
    invalidate: [['exams', yid]],
    onSuccess: (c) => router.push(`/admin/exams/${c.id}?year=${yid}`),
  });

  return (
    <>
      <PageHeader title={t('nav.exams')} subtitle={t('web.exams.subtitle')} actions={<Button variant="primary" icon={<Plus size={16} />} disabled={!yid} onClick={() => setOpen(true)}>{t('web.exams.newCycle')}</Button>} />
      <Toolbar>
        <SelectField className="w-56" label={t('web.common.year')} value={yid ?? ''} onValue={setYearId} options={(years.data?.items ?? []).map((y) => ({ value: y.id, label: y.name }))} />
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/exams/${r.id}?year=${yid}`)}
            empty={<EmptyState title={t('web.exams.none')} hint={t('web.exams.noneHint')} />}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <span className="font-medium">{lang === 'ur' && r.nameUr ? r.nameUr : r.name}</span> },
              { key: 'k', header: t('web.common.type'), cell: (r) => <span>{t(`web.exams.kinds.${r.kind}`)}{r.isFinal && r.kind !== 'final' && <Badge tone="info"> {t('web.exams.final')}</Badge>}</span> },
              { key: 'p', header: t('web.exams.papers'), numeric: true, cell: (r) => r.paperCount },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge> },
            ]}
          />
        )}
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.exams.newCycle')} footer={<Button variant="primary" loading={create.isPending} disabled={!f.name} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} placeholder="Midterm 2026" required />
          <TextField label={t('web.common.nameUr')} value={f.nameUr} onValue={(v) => setF({ ...f, nameUr: v })} dir="rtl" />
          <SelectField label={t('web.common.type')} value={f.kind} onValue={(v) => setF({ ...f, kind: v, isFinal: v === 'final' || f.isFinal })} options={examKinds.map((k) => ({ value: k, label: t(`web.exams.kinds.${k}`) }))} />
          <SelectField label={t('web.exams.term')} value={f.termId} onValue={(v) => setF({ ...f, termId: v })} placeholder={t('web.common.none')} options={(terms.data?.items ?? []).map((x) => ({ value: x.id, label: x.name }))} />
          <Checkbox label={t('web.exams.isFinal')} hint={t('web.exams.isFinalHint')} checked={f.isFinal} onChange={(v) => setF({ ...f, isFinal: v })} />
          <InlineError error={create.error} />
        </div>
      </Dialog>
    </>
  );
}
