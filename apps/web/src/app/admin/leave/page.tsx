'use client';

import { Check, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LeaveRequest, Page, z } from '@edventure/contracts';
import { leaveAudiences, leaveDecisionResult, leaveStates, leaveType } from '@edventure/contracts';
import { PersonPicker, type PickedPerson } from '@/components/people/person-picker';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Tabs, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, stateTone, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

type Tab = 'requests' | 'types';
type LeaveType = z.infer<typeof leaveType>;

export default function LeavePage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('requests');
  return (
    <>
      <PageHeader title={t('nav.leave')} subtitle={t('web.leave.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'requests', label: t('web.leave.requests') },
          { value: 'types', label: t('web.leave.types') },
        ]}
      />
      {tab === 'requests' ? <Requests /> : <Types />}
    </>
  );
}

function Requests() {
  const { t } = useTranslation();
  const lang = useLang();
  const toast = useToast();
  const [state, setState] = useState('pending');
  const [audience, setAudience] = useState('');
  const [limit, setLimit] = useState(50);
  const q = useApi<Page<LeaveRequest>>(['leave-requests', state, audience, limit], '/leave-requests', { state: state || undefined, audience: audience || undefined, limit });
  const types = useApi<{ items: LeaveType[] }>(['leave-types'], '/leave-types');
  const [deciding, setDeciding] = useState<{ request: LeaveRequest; decision: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<z.infer<typeof leaveDecisionResult> | null>(null);
  const [filing, setFiling] = useState(false);
  const [f, setF] = useState<{ person: PickedPerson | null; leaveTypeId: string; startDate: string; endDate: string; reason: string }>({ person: null, leaveTypeId: '', startDate: todayLocal(), endDate: todayLocal(), reason: '' });

  const decide = useAction(
    () => api.post<z.infer<typeof leaveDecisionResult>>(`/leave-requests/${deciding!.request.id}/decision`, { decision: deciding!.decision, note: note || null, version: deciding!.request.version }),
    {
      invalidate: [['leave-requests'], ['admin-dashboard']],
      onSuccess: (r) => {
        setDeciding(null);
        toast(r.request.state === 'approved' ? t('web.leave.approvedToast', { count: r.excusedDaysCreated }) : t('web.leave.rejectedToast'));
        if (r.conflicts.length) setResult(r);
      },
    },
  );
  const cancel = useAction((id: string) => api.post(`/leave-requests/${id}/cancel`), { invalidate: [['leave-requests']], toastErrors: true, success: t('web.leave.cancelledToast') });
  const file = useAction(
    () =>
      api.post('/leave-requests', {
        leaveTypeId: f.leaveTypeId,
        startDate: f.startDate,
        endDate: f.endDate,
        reason: f.reason,
        studentId: f.person?.kind === 'student' ? f.person.id : null,
        teacherId: f.person?.kind === 'teacher' ? f.person.id : null,
      }),
    { invalidate: [['leave-requests']], success: t('web.common.created'), onSuccess: () => setFiling(false) },
  );
  const personKind = f.person?.kind;
  const typeOptions = (types.data?.items ?? []).filter((x) => !x.archived && (!personKind || x.audience === 'both' || x.audience === personKind));

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SelectField className="w-44" label={t('common.status')} value={state} onValue={setState} placeholder={t('common.all')} options={leaveStates.map((s) => ({ value: s, label: t(`leave.${s}`) }))} />
        <SelectField className="w-44" label={t('web.leave.who')} value={audience} onValue={setAudience} placeholder={t('common.all')} options={[{ value: 'student', label: t('nav.students') }, { value: 'teacher', label: t('nav.teachers') }]} />
        <div className="ms-auto">
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setF({ person: null, leaveTypeId: '', startDate: todayLocal(), endDate: todayLocal(), reason: '' }); setFiling(true); }}>{t('web.leave.recordLeave')}</Button>
        </div>
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title={state === 'pending' ? t('web.leave.nonePending') : t('common.noResults')} />}
            footer={q.data?.nextCursor ? <Button size="sm" onClick={() => setLimit((l) => Math.min(100, l + 50))}>{t('common.loadMore')}</Button> : undefined}
            columns={[
              { key: 'w', header: t('web.leave.who'), cell: (r) => <div><p className="font-medium">{r.subject.displayName}</p><p className="text-[12px] text-muted">{t(`web.common.${r.subject.kind}`)}{r.subject.detail ? ` · ${r.subject.detail}` : ''}</p></div> },
              { key: 't', header: t('leave.type'), cell: (r) => r.leaveTypeName },
              { key: 'd', header: t('common.date'), cell: (r) => (r.startDate === r.endDate ? formatDate(r.startDate, lang) : `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}`) },
              { key: 'r', header: t('leave.reason'), cell: (r) => <p className="line-clamp-2 max-w-xs text-[13px]">{r.reason}</p> },
              { key: 's', header: t('common.status'), cell: (r) => <div><Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`leave.${r.state}`)}</Badge>{r.decidedBy && <p className="mt-0.5 text-[11px] text-muted">{r.decidedBy} · {formatDateTime(r.decidedAt, lang)}</p>}</div> },
              {
                key: 'a',
                header: '',
                cell: (r) =>
                  r.state === 'pending' ? (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={() => { setNote(''); setDeciding({ request: r, decision: 'approve' }); }}>{t('leave.approve')}</Button>
                      <Button size="sm" icon={<X size={14} />} onClick={() => { setNote(''); setDeciding({ request: r, decision: 'reject' }); }}>{t('leave.reject')}</Button>
                    </div>
                  ) : r.state === 'approved' ? (
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}>{t('common.cancel')}</Button>
                    </div>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>

      <Dialog
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={deciding ? t(deciding.decision === 'approve' ? 'web.leave.approveTitle' : 'web.leave.rejectTitle', { name: deciding.request.subject.displayName }) : ''}
        footer={<Button variant={deciding?.decision === 'reject' ? 'danger' : 'primary'} loading={decide.isPending} onClick={() => decide.mutate(undefined)}>{deciding?.decision === 'reject' ? t('leave.reject') : t('leave.approve')}</Button>}
      >
        {deciding && (
          <div className="grid gap-3">
            <p className="rounded-lg bg-sunken px-3 py-2 text-[13px]">
              {deciding.request.leaveTypeName} · {formatDate(deciding.request.startDate, lang)} – {formatDate(deciding.request.endDate, lang)}
              <span className="mt-1 block text-muted">{deciding.request.reason}</span>
            </p>
            {deciding.decision === 'approve' && <p className="text-[13px] text-muted">{t('web.leave.approveHint')}</p>}
            <TextField label={t('leave.decisionNote')} value={note} onValue={setNote} />
            <InlineError error={decide.error} />
          </div>
        )}
      </Dialog>
      <Dialog open={!!result} onClose={() => setResult(null)} title={t('web.leave.conflictsTitle')} footer={<Button onClick={() => setResult(null)}>{t('common.close')}</Button>}>
        <p className="mb-2 text-[13px] text-muted">{t('web.leave.conflictsHint')}</p>
        <ul className="list-disc ps-5 text-sm">
          {result?.conflicts.map((c) => (
            <li key={c.date}>{formatDate(c.date, lang)} — {t(`attendance.${c.status}`)}</li>
          ))}
        </ul>
      </Dialog>
      <Dialog open={filing} onClose={() => setFiling(false)} title={t('web.leave.recordLeave')} footer={<Button variant="primary" loading={file.isPending} disabled={!f.person || !f.leaveTypeId} onClick={() => file.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          <PersonPicker label={t('web.leave.who')} kinds={['student', 'teacher']} value={f.person} onChange={(p) => setF({ ...f, person: p, leaveTypeId: '' })} required />
          <SelectField label={t('leave.type')} value={f.leaveTypeId} onValue={(v) => setF({ ...f, leaveTypeId: v })} placeholder={t('web.common.select')} options={typeOptions.map((x) => ({ value: x.id, label: lang === 'ur' && x.nameUr ? x.nameUr : x.name }))} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('leave.startDate')} type="date" value={f.startDate} onValue={(v) => setF({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate })} />
            <TextField label={t('leave.endDate')} type="date" value={f.endDate} onValue={(v) => setF({ ...f, endDate: v })} />
          </div>
          <TextField label={t('leave.reason')} value={f.reason} onValue={(v) => setF({ ...f, reason: v })} required />
          <p className="text-[13px] text-muted">{t('web.leave.recordHint')}</p>
          <InlineError error={file.error} />
        </div>
      </Dialog>
    </div>
  );
}

function Types() {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: LeaveType[] }>(['leave-types'], '/leave-types');
  const [f, setF] = useState({ code: '', name: '', nameUr: '', audience: 'both' });
  const create = useAction(() => api.post('/leave-types', { ...f, nameUr: f.nameUr || null }), {
    invalidate: [['leave-types']],
    success: t('web.common.created'),
    onSuccess: () => setF({ code: '', name: '', nameUr: '', audience: 'both' }),
  });
  const archive = useAction((id: string) => api.post(`/leave-types/${id}/archive`), { invalidate: [['leave-types']], toastErrors: true });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card padded={false}>
        <DataTable
          rows={q.data?.items ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'c', header: t('web.common.code'), cell: (r) => <code>{r.code}</code> },
            { key: 'n', header: t('web.common.name'), cell: (r) => (lang === 'ur' && r.nameUr ? r.nameUr : r.name) },
            { key: 'a', header: t('web.leave.appliesTo'), cell: (r) => t(`web.leave.audience.${r.audience}`) },
            { key: 's', header: '', cell: (r) => (r.archived ? <Badge>{t('common.archived')}</Badge> : <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)}>{t('web.common.archive')}</Button>) },
          ]}
        />
      </Card>
      <Card title={t('web.leave.newType')}>
        <div className="grid gap-3">
          <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" required />
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} required />
          <TextField label={t('web.common.nameUr')} value={f.nameUr} onValue={(v) => setF({ ...f, nameUr: v })} dir="rtl" />
          <SelectField label={t('web.leave.appliesTo')} value={f.audience} onValue={(v) => setF({ ...f, audience: v })} options={leaveAudiences.map((a) => ({ value: a, label: t(`web.leave.audience.${a}`) }))} />
          <InlineError error={create.error} />
          <Button variant="primary" loading={create.isPending} disabled={!f.code || !f.name} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>
        </div>
      </Card>
    </div>
  );
}
