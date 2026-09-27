'use client';

import { ArrowLeft, CalendarPlus, ClipboardList, Lock, Plus, Printer, RefreshCw, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExamCycle, ExamPaper, z } from '@edventure/contracts';
import { dateSheetRow, room } from '@edventure/contracts';
import { MarkSheet } from '@/components/exams/mark-sheet';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Tabs, Toolbar } from '@/components/ui/layout';
import { EmptyState, ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatNumber, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang } from '@/lib/hooks';

const nextStates: Record<string, Array<'scheduled' | 'marking' | 'review' | 'draft' | 'closed'>> = {
  draft: ['scheduled'],
  scheduled: ['marking', 'draft'],
  marking: ['review', 'scheduled'],
  review: ['marking'],
  published: ['closed'],
};
const forward: Record<string, string> = { draft: 'scheduled', scheduled: 'marking', marking: 'review', published: 'closed' };
type Tab = 'papers' | 'dateSheet';

export default function ExamCyclePage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { t } = useTranslation();
  const lang = useLang();
  const { year } = useActiveYear();
  const yearId = params.get('year') ?? year?.id;
  const cycles = useApi<{ items: ExamCycle[] }>(['exams', yearId], yearId ? '/exams' : null, yearId ? { academicYearId: yearId } : undefined);
  const cycle = cycles.data?.items.find((c) => c.id === id);
  const [tab, setTab] = useState<Tab>('papers');
  const transition = useAction((state: string) => api.post(`/exams/${id}/state`, { state, version: cycle!.version }), { invalidate: [['exams']], success: t('web.common.updated'), toastErrors: true });

  if (cycles.isLoading || !yearId) return <LoadingBlock />;
  if (cycles.error || !cycle) return <ErrorState error={cycles.error ?? new Error(t('errors.notFound'))} />;

  return (
    <>
      <PageHeader
        back={<Link href="/admin/exams" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.exams')}</Link>}
        title={lang === 'ur' && cycle.nameUr ? cycle.nameUr : cycle.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge tone={stateTone[cycle.state] ?? 'neutral'}>{t(`web.status.${cycle.state}`)}</Badge>
            <span>{t(`web.exams.kinds.${cycle.kind}`)}{cycle.isFinal && cycle.kind !== 'final' ? ` · ${t('web.exams.final')}` : ''}</span>
          </span>
        }
        actions={
          <>
            {(nextStates[cycle.state] ?? []).map((s) => (
              <Button key={s} variant={s === forward[cycle.state] ? 'primary' : 'secondary'} loading={transition.isPending && transition.variables === s} onClick={() => transition.mutate(s)}>
                {s === 'scheduled' && cycle.state !== 'draft' ? t('web.exams.backToScheduled') : s === 'marking' && cycle.state === 'review' ? t('web.exams.reopenMarking') : t(`web.exams.moveTo.${s}`)}
              </Button>
            ))}
            {cycle.state === 'review' && <LinkButton href={`/admin/results?examCycleId=${cycle.id}`} variant="primary">{t('web.exams.goToResults')}</LinkButton>}
          </>
        }
      />
      <p className="mb-4 max-w-3xl text-[13px] text-muted">{t(`web.exams.stateHint.${cycle.state}`)}</p>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'papers', label: t('web.exams.papers') }, { value: 'dateSheet', label: t('exams.dateSheet') }]} />
      {tab === 'papers' ? <Papers cycle={cycle} yearId={yearId} /> : <DateSheet cycle={cycle} />}
    </>
  );
}

function Papers({ cycle, yearId }: { cycle: ExamCycle; yearId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const classes = useClasses(yearId);
  const [classId, setClassId] = useState('');
  const cls = classes.data?.items.find((c) => c.id === classId) ?? classes.data?.items[0];
  const papers = useApi<{ items: ExamPaper[] }>(['exam-papers', cycle.id, cls?.id], cls ? `/exams/${cycle.id}/papers` : null, cls ? { classOfferingId: cls.id } : undefined);
  const rooms = useApi<{ items: z.infer<typeof room>[] }>(['rooms'], '/rooms');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<string, { on: boolean; maxMarks: string; passMarks: string }>>({});
  const [sitting, setSitting] = useState<{ paper: ExamPaper; sittingId?: string } | null>(null);
  const [s, setS] = useState({ sectionId: '', date: '', startTime: '09:00', endTime: '12:00', roomId: '', note: '' });
  const [marks, setMarks] = useState<ExamPaper | null>(null);
  const [marksSection, setMarksSection] = useState('');
  const invalidate = [['exam-papers', cycle.id], ['exams']];
  const editable = ['draft', 'scheduled'].includes(cycle.state);

  const existing = new Set((papers.data?.items ?? []).map((p) => p.courseOfferingId));
  const available = (cls?.courses ?? []).filter((c) => !c.archived && !existing.has(c.id));
  const openAdd = () => {
    setDraft(Object.fromEntries(available.map((c) => [c.id, { on: true, maxMarks: '100', passMarks: '33' }])));
    setAdding(true);
  };
  const addPapers = useAction(
    () =>
      api.post(`/exams/${cycle.id}/papers`, {
        classOfferingId: cls!.id,
        papers: Object.entries(draft)
          .filter(([, d]) => d.on)
          .map(([courseOfferingId, d]) => ({ courseOfferingId, maxMarks: d.maxMarks, passMarks: d.passMarks })),
      }),
    { invalidate, success: t('web.common.created'), onSuccess: () => setAdding(false) },
  );
  const schedule = useAction(
    () =>
      sitting!.sittingId
        ? api.post(`/exam-sittings/${sitting!.sittingId}/reschedule`, { date: s.date, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId || null, note: s.note || null })
        : api.post('/exam-sittings', { examPaperId: sitting!.paper.id, sectionId: s.sectionId || null, date: s.date, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId || null, note: s.note || null }),
    { invalidate: [...invalidate, ['date-sheet', cycle.id]], success: t('web.common.updated'), onSuccess: () => setSitting(null) },
  );
  const cancelSitting = useAction((sid: string) => api.post(`/exam-sittings/${sid}/cancel`), { invalidate: [...invalidate, ['date-sheet', cycle.id]], toastErrors: true, success: t('web.exams.sittingCancelled') });
  const lock = useAction((p: ExamPaper) => api.patch(`/exam-papers/${p.id}`, { locked: !p.locked, version: p.version }), { invalidate, toastErrors: true });
  const sync = useAction((p: ExamPaper) => api.post<{ added: number; removed: number }>(`/exam-papers/${p.id}/registrations/sync`), { invalidate, toastErrors: true, success: t('web.exams.synced') });

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <SelectField className="w-52" label={t('web.common.class')} value={cls?.id ?? ''} onValue={setClassId} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />
        {editable && (
          <Button variant="primary" icon={<Plus size={16} />} disabled={!cls || available.length === 0} onClick={openAdd}>
            {t('web.exams.addPapers')}
          </Button>
        )}
      </Toolbar>
      {papers.isLoading ? (
        <LoadingBlock />
      ) : (papers.data?.items ?? []).length === 0 ? (
        <Card><EmptyState title={t('web.exams.noPapers')} hint={editable ? t('web.exams.noPapersHint') : undefined} /></Card>
      ) : (
        <div className="grid gap-3">
          {papers.data!.items.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{lang === 'ur' && p.subjectNameUr ? p.subjectNameUr : p.subjectName}</p>
                  <p className="tabular text-[13px] text-muted">
                    {t('exams.maxMarks')} {formatNumber(p.maxMarks)} · {t('exams.passMarks')} {formatNumber(p.passMarks)} ·{t('web.exams.registered', { count: p.registrationCount })} · {t('web.exams.marked', { done: p.markedCount, total: p.registrationCount })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.locked && <Badge tone="warning">{t('web.exams.locked')}</Badge>}
                  {editable && <Button size="sm" variant="ghost" icon={<CalendarPlus size={14} />} onClick={() => { setS({ sectionId: '', date: '', startTime: '09:00', endTime: '12:00', roomId: '', note: '' }); setSitting({ paper: p }); }}>{t('web.exams.schedule')}</Button>}
                  <Button size="sm" variant="ghost" icon={<ClipboardList size={14} />} onClick={() => { setMarksSection(''); setMarks(p); }}>{t('exams.marks')}</Button>
                  <Button size="sm" variant="ghost" icon={p.locked ? <Unlock size={14} /> : <Lock size={14} />} onClick={() => lock.mutate(p)}>{p.locked ? t('web.exams.unlock') : t('web.exams.lock')}</Button>
                  <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} loading={sync.isPending && sync.variables?.id === p.id} onClick={() => sync.mutate(p)}>{t('web.exams.syncRegistrations')}</Button>
                </div>
              </div>
              {p.sittings.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
                  {p.sittings.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className={x.status === 'cancelled' ? 'text-subtle line-through' : ''}>
                        <span className="font-medium">{formatDate(x.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span> · <span className="tabular">{x.startTime}–{x.endTime}</span>
                        {x.sectionName && ` · ${x.sectionName}`}
                        {x.roomName && ` · ${x.roomName}`}
                        {x.status === 'rescheduled' && <Badge tone="warning"> {t('web.exams.rescheduled')}</Badge>}
                      </span>
                      {x.status !== 'cancelled' && cycle.state !== 'closed' && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setS({ sectionId: x.sectionId ?? '', date: x.date, startTime: x.startTime, endTime: x.endTime, roomId: x.roomId ?? '', note: x.note ?? '' }); setSitting({ paper: p, sittingId: x.id }); }}>{t('web.exams.reschedule')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelSitting.mutate(x.id)}>{t('common.cancel')}</Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title={t('web.exams.addPapersFor', { name: cls?.gradeName ?? '' })} wide footer={<Button variant="primary" loading={addPapers.isPending} disabled={!Object.values(draft).some((d) => d.on)} onClick={() => addPapers.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_96px_96px] gap-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span>{t('web.common.subject')}</span>
            <span className="text-end">{t('exams.maxMarks')}</span>
            <span className="text-end">{t('exams.passMarks')}</span>
          </div>
          {available.map((c) => {
            const d = draft[c.id];
            if (!d) return null;
            const set = (patch: Partial<typeof d>) => setDraft({ ...draft, [c.id]: { ...d, ...patch } });
            return (
              <div key={c.id} className="grid grid-cols-[1fr_96px_96px] items-center gap-2 border-t border-line pt-2">
                <Checkbox label={c.subjectName} hint={c.requirement === 'elective' ? t('web.academics.elective') : undefined} checked={d.on} onChange={(v) => set({ on: v })} />
                <input aria-label={`${c.subjectName} ${t('exams.maxMarks')}`} dir="ltr" inputMode="decimal" disabled={!d.on} className="tabular h-9 rounded-lg border border-line-strong px-2 text-end text-sm disabled:bg-sunken" value={d.maxMarks} onChange={(e) => set({ maxMarks: e.target.value.trim() })} />
                <input aria-label={`${c.subjectName} ${t('exams.passMarks')}`} dir="ltr" inputMode="decimal" disabled={!d.on} className="tabular h-9 rounded-lg border border-line-strong px-2 text-end text-sm disabled:bg-sunken" value={d.passMarks} onChange={(e) => set({ passMarks: e.target.value.trim() })} />
              </div>
            );
          })}
          <InlineError error={addPapers.error} />
        </div>
      </Dialog>
      <Dialog open={!!sitting} onClose={() => setSitting(null)} title={sitting ? `${sitting.sittingId ? t('web.exams.reschedule') : t('web.exams.schedule')} · ${sitting.paper.subjectName}` : ''} footer={<Button variant="primary" loading={schedule.isPending} disabled={!s.date} onClick={() => schedule.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          {!sitting?.sittingId && (
            <SelectField label={t('web.common.section')} value={s.sectionId} onValue={(v) => setS({ ...s, sectionId: v })} placeholder={t('web.exams.allSections')} options={(cls?.sections ?? []).filter((x) => !x.archived).map((x) => ({ value: x.id, label: `${cls!.gradeName} ${x.name}` }))} />
          )}
          <TextField label={t('common.date')} type="date" value={s.date} onValue={(v) => setS({ ...s, date: v })} required />
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('common.from')} type="time" value={s.startTime} onValue={(v) => setS({ ...s, startTime: v })} />
            <TextField label={t('common.to')} type="time" value={s.endTime} onValue={(v) => setS({ ...s, endTime: v })} />
          </div>
          <SelectField label={t('web.timetable.room')} value={s.roomId} onValue={(v) => setS({ ...s, roomId: v })} placeholder={t('web.common.none')} options={(rooms.data?.items ?? []).filter((r) => !r.archived).map((r) => ({ value: r.id, label: r.name }))} />
          <TextField label={t('web.common.note')} value={s.note} onValue={(v) => setS({ ...s, note: v })} />
          {sitting?.sittingId && <p className="text-[13px] text-muted">{t('web.exams.rescheduleHint')}</p>}
          <InlineError error={schedule.error} />
        </div>
      </Dialog>
      <Dialog open={!!marks} onClose={() => setMarks(null)} title={marks ? `${t('exams.marks')} · ${marks.subjectName} · ${marks.gradeName}` : ''} wide>
        {marks && (
          <div className="flex flex-col gap-3">
            <SelectField className="w-52" label={t('web.common.section')} value={marksSection} onValue={setMarksSection} placeholder={t('common.all')} options={(cls?.sections ?? []).map((x) => ({ value: x.id, label: `${cls!.gradeName} ${x.name}` }))} />
            <MarkSheet key={marksSection} paperId={marks.id} sectionId={marksSection || undefined} />
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DateSheet({ cycle }: { cycle: ExamCycle }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof dateSheetRow>[] }>(['date-sheet', cycle.id], '/date-sheet', { examCycleId: cycle.id });
  const byDate = useMemo(() => {
    const m = new Map<string, z.infer<typeof dateSheetRow>[]>();
    for (const r of [...(q.data?.items ?? [])].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return [...m.entries()];
  }, [q.data]);
  if (q.isLoading) return <LoadingBlock />;
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex justify-end">
        <Button icon={<Printer size={16} />} onClick={() => window.print()}>{t('common.print')}</Button>
      </div>
      <Card padded={false}>
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-semibold">{t('exams.dateSheet')} · {lang === 'ur' && cycle.nameUr ? cycle.nameUr : cycle.name}</h2>
        </div>
        {byDate.length === 0 ? (
          <EmptyState title={t('web.exams.noSittings')} />
        ) : (
          <DataTable
            rows={byDate.flatMap(([, rows]) => rows)}
            rowKey={(r) => r.sittingId}
            columns={[
              { key: 'd', header: t('common.date'), cell: (r) => <span className="font-medium">{formatDate(r.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</span> },
              { key: 't', header: t('web.exams.time'), cell: (r) => <span className="tabular">{r.startTime}–{r.endTime}</span> },
              { key: 'c', header: t('web.common.class'), cell: (r) => `${r.gradeName}${r.sectionName ? ` ${r.sectionName}` : ''}` },
              { key: 's', header: t('web.common.subject'), cell: (r) => (lang === 'ur' && r.subjectNameUr ? r.subjectNameUr : r.subjectName) },
              { key: 'r', header: t('web.timetable.room'), cell: (r) => r.roomName ?? '—' },
              { key: 'm', header: t('exams.maxMarks'), numeric: true, cell: (r) => formatNumber(r.maxMarks) },
              { key: 'st', header: t('common.status'), cell: (r) => (r.status === 'scheduled' ? '' : <Badge tone={r.status === 'cancelled' ? 'danger' : 'warning'}>{t(`web.exams.sitting.${r.status}`)}</Badge>) },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
