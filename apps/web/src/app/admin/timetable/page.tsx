'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PeriodDefinition, TimetableVersion } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { EmptyState, InlineError } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useLang } from '@/lib/hooks';

export default function TimetablesPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { year } = useActiveYear();
  const periods = useApi<{ items: PeriodDefinition[] }>(['periods', year?.id], year ? '/periods' : null, year ? { academicYearId: year.id } : undefined);
  const versions = useApi<{ items: TimetableVersion[] }>(['timetables', year?.id], year ? '/timetables' : null, year ? { academicYearId: year.id } : undefined);
  const [p, setP] = useState({ name: '', startTime: '08:00', endTime: '08:40', kind: 'lesson' });
  const [newVersion, setNewVersion] = useState(false);
  const [v, setV] = useState({ name: '', copyFromVersionId: '' });
  const addPeriod = useAction(
    () => api.post('/periods', { academicYearId: year!.id, sequence: (periods.data?.items.length ?? 0) + 1, name: p.name || `Period ${(periods.data?.items.filter((x) => x.kind === 'lesson').length ?? 0) + 1}`, startTime: p.startTime, endTime: p.endTime, kind: p.kind }),
    { invalidate: [['periods', year?.id]], success: t('web.common.created') },
  );
  const removePeriod = useAction((id: string) => api.delete(`/periods/${id}`), { invalidate: [['periods', year?.id]], toastErrors: true });
  const createVersion = useAction(
    () => api.post<{ id: string }>('/timetables', { academicYearId: year!.id, name: v.name, copyFromVersionId: v.copyFromVersionId || null }),
    { invalidate: [['timetables', year?.id]], onSuccess: (r) => router.push(`/admin/timetable/${r.id}`) },
  );

  return (
    <>
      <PageHeader title={t('nav.timetable')} subtitle={year?.name} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewVersion(true)} disabled={!year}>{t('web.timetable.newVersion')}</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title={t('web.timetable.versions')} padded={false}>
          <DataTable
            rows={versions.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/timetable/${r.id}`)}
            empty={<EmptyState title={t('web.timetable.noVersions')} />}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'l', header: t('web.timetable.lessons'), numeric: true, cell: (r) => r.lessonCount },
              { key: 'e', header: t('web.common.effectiveDate'), cell: (r) => (r.effectiveFrom ? `${formatDate(r.effectiveFrom, lang)}${r.effectiveTo ? ` – ${formatDate(r.effectiveTo, lang)}` : ''}` : '—') },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.status] ?? 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
            ]}
          />
        </Card>
        <Card title={t('web.timetable.bellSchedule')}>
          <ul className="mb-4 flex flex-col gap-1.5">
            {(periods.data?.items ?? []).map((x) => (
              <li key={x.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${x.kind === 'lesson' ? 'border border-line' : 'bg-sunken text-muted'}`}>
                <span>{x.name}</span>
                <span className="tabular flex items-center gap-2 text-[13px] text-muted">
                  {x.startTime}–{x.endTime}
                  <button className="text-subtle hover:text-danger-fg" aria-label={t('common.delete')} onClick={() => removePeriod.mutate(x.id)}>×</button>
                </span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('web.common.name')} value={p.name} onValue={(val) => setP({ ...p, name: val })} placeholder="Period 1" />
            <SelectField label={t('web.common.type')} value={p.kind} onValue={(val) => setP({ ...p, kind: val })} options={[{ value: 'lesson', label: t('web.timetable.lesson') }, { value: 'break', label: t('web.timetable.break') }, { value: 'assembly', label: t('web.timetable.assembly') }]} />
            <TextField label={t('web.common.fromDate')} type="time" value={p.startTime} onValue={(val) => setP({ ...p, startTime: val })} />
            <TextField label={t('web.common.toDate')} type="time" value={p.endTime} onValue={(val) => setP({ ...p, endTime: val })} />
            <Button className="col-span-2" loading={addPeriod.isPending} onClick={() => addPeriod.mutate(undefined)}>{t('web.timetable.addPeriod')}</Button>
          </div>
          <InlineError error={addPeriod.error} />
        </Card>
      </div>
      <Dialog open={newVersion} onClose={() => setNewVersion(false)} title={t('web.timetable.newVersion')} footer={<Button variant="primary" loading={createVersion.isPending} disabled={!v.name} onClick={() => createVersion.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.name')} value={v.name} onValue={(val) => setV({ ...v, name: val })} />
          <SelectField label={t('web.timetable.copyFrom')} value={v.copyFromVersionId} onValue={(val) => setV({ ...v, copyFromVersionId: val })} placeholder={t('web.timetable.startEmpty')} options={(versions.data?.items ?? []).map((x) => ({ value: x.id, label: x.name }))} />
          <InlineError error={createVersion.error} />
        </div>
      </Dialog>
    </>
  );
}
