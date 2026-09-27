'use client';

import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson, PeriodDefinition, SchoolSettings, TeachingGroup, TimetableVersion, z } from '@edventure/contracts';
import { lessonException, room } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { addDays, formatDate, stateTone, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang, useSectionOptions, useTeacherOptions } from '@/lib/hooks';

type Detail = TimetableVersion & { periods: PeriodDefinition[]; lessons: Lesson[] };

export default function TimetableEditor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<Detail>(['timetable', id], `/timetables/${id}`);
  const school = useApi<SchoolSettings>(['school'], '/school');
  const weekdays = [...(school.data?.policies.attendance.workingWeekdays ?? [1, 2, 3, 4, 5])].sort();
  const sections = useSectionOptions(q.data?.academicYearId);
  const teachers = useTeacherOptions();
  const rooms = useApi<{ items: z.infer<typeof room>[] }>(['rooms'], '/rooms');
  const [sectionId, setSectionId] = useState('');
  const sec = sections.options.find((s) => s.value === sectionId) ?? sections.options[0];
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', sec?.classOfferingId], sec ? '/teaching-groups' : null, sec ? { classOfferingId: sec.classOfferingId } : undefined);
  const [slot, setSlot] = useState<{ weekday: number; periodId: string } | null>(null);
  const [f, setF] = useState({ teachingGroupId: '', teacherId: '', roomId: '' });
  const [publishOpen, setPublishOpen] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(addDays(todayLocal(), 1));
  const [exception, setException] = useState<Lesson | null>(null);
  const [ex, setEx] = useState({ date: todayLocal(), kind: 'cancelled', substituteTeacherId: '', roomId: '', note: '' });

  const invalidate = [['timetable', id], ['timetables']];
  const add = useAction(() => api.post(`/timetables/${id}/lessons`, { weekday: slot!.weekday, periodDefinitionId: slot!.periodId, teachingGroupId: f.teachingGroupId, teacherId: f.teacherId || null, roomId: f.roomId || null }), {
    invalidate,
    onSuccess: () => setSlot(null),
  });
  const remove = useAction((lessonId: string) => api.delete(`/timetable-lessons/${lessonId}`), { invalidate, toastErrors: true });
  const validate = useAction(() => api.post(`/timetables/${id}/validate`, {}), { invalidate, toastErrors: true });
  const publish = useAction(() => api.post(`/timetables/${id}/publish`, { effectiveFrom, version: q.data!.version }), { invalidate, success: t('web.timetable.published'), onSuccess: () => setPublishOpen(false) });
  const createException = useAction(
    () => api.post<z.infer<typeof lessonException>>('/lesson-exceptions', { timetableLessonId: exception!.id, date: ex.date, kind: ex.kind, substituteTeacherId: ex.substituteTeacherId || null, roomId: ex.roomId || null, note: ex.note || null }),
    { success: t('web.common.created'), onSuccess: () => setException(null) },
  );

  const relevantGroups = useMemo(() => (groups.data?.items ?? []).filter((g) => !g.archived && (g.sectionId === sec?.value || g.sectionId === null)), [groups.data, sec]);
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const tt = q.data;
  const draft = tt.status === 'draft';
  const groupIds = new Set(relevantGroups.map((g) => g.id));
  const lessonsFor = (weekday: number, periodId: string) => tt.lessons.filter((l) => l.weekday === weekday && l.periodId === periodId && groupIds.has(l.teachingGroupId));
  const conflictIds = new Set((tt.conflicts ?? []).flatMap((c) => c.lessonIds));

  return (
    <>
      <PageHeader
        back={<Link href="/admin/timetable" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.timetable')}</Link>}
        title={tt.name}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge tone={stateTone[tt.status] ?? 'neutral'}>{t(`web.status.${tt.status}`)}</Badge>
            {tt.effectiveFrom && <span>{t('web.common.effectiveDate')}: {formatDate(tt.effectiveFrom, lang)}</span>}
          </span>
        }
        actions={
          draft && (
            <>
              <Button loading={validate.isPending} onClick={() => validate.mutate(undefined)}>{t('web.timetable.check')}</Button>
              <Button variant="primary" onClick={() => setPublishOpen(true)}>{t('common.publish')}</Button>
            </>
          )
        }
      />
      {tt.conflicts && draft && (
        <div className={clsx('mb-4 rounded-xl border px-4 py-3', tt.conflicts.length ? 'border-danger-fg/20 bg-danger-bg text-danger-fg' : 'border-success-fg/20 bg-success-bg text-success-fg')}>
          {tt.conflicts.length ? (
            <>
              <p className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> {t('web.timetable.conflicts', { count: tt.conflicts.length })}</p>
              <ul className="mt-1 list-disc ps-6 text-sm">
                {tt.conflicts.map((c, i) => <li key={i}>{t(`web.common.weekday.${c.weekday}`)} · {tt.periods.find((p) => p.id === c.periodId)?.name}: {c.detail}</li>)}
              </ul>
            </>
          ) : (
            <p className="flex items-center gap-2 font-medium"><CheckCircle2 size={16} /> {t('web.timetable.noConflicts')}</p>
          )}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SelectField className="w-52" label={t('web.common.section')} value={sec?.value ?? ''} onValue={setSectionId} options={sections.options} />
        {!draft && <p className="text-[13px] text-muted">{t('web.timetable.publishedHint')}</p>}
      </div>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="bg-sunken/60">
                <th className="w-28 border-b border-line px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('web.timetable.period')}</th>
                {weekdays.map((d) => (
                  <th key={d} className="border-b border-line px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t(`web.common.weekday.${d}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tt.periods.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 align-top">
                    <p className="font-medium">{p.name}</p>
                    <p className="tabular text-[12px] text-muted">{p.startTime}–{p.endTime}</p>
                  </td>
                  {weekdays.map((d) =>
                    p.kind !== 'lesson' ? (
                      <td key={d} className="bg-sunken/50 px-2 py-2 text-center text-[12px] text-subtle">{t(`web.timetable.${p.kind}`)}</td>
                    ) : (
                      <td key={d} className="px-1.5 py-1.5 align-top">
                        <div className="flex min-h-14 flex-col gap-1">
                          {lessonsFor(d, p.id).map((l) => (
                            <div key={l.id} className={clsx('group relative rounded-lg border px-2 py-1.5', conflictIds.has(l.id) ? 'border-danger-fg bg-danger-bg' : 'border-accent-200 bg-accent-50')}>
                              <p className="truncate font-medium text-accent-800">{l.subjectName}</p>
                              <p className="truncate text-[11px] text-muted">{l.teacherName}{l.roomName ? ` · ${l.roomName}` : ''}</p>
                              {draft ? (
                                <button className="absolute end-1 top-1 hidden rounded p-0.5 text-muted hover:text-danger-fg group-hover:block" aria-label={t('common.delete')} onClick={() => remove.mutate(l.id)}>
                                  <X size={12} />
                                </button>
                              ) : (
                                <button className="mt-0.5 text-[11px] text-accent-700 hover:underline" onClick={() => { setEx({ date: todayLocal(), kind: 'cancelled', substituteTeacherId: '', roomId: '', note: '' }); setException(l); }}>
                                  {t('web.timetable.change')}
                                </button>
                              )}
                            </div>
                          ))}
                          {draft && (
                            <button onClick={() => { setF({ teachingGroupId: '', teacherId: '', roomId: '' }); setSlot({ weekday: d, periodId: p.id }); }} className="flex h-7 items-center justify-center rounded-lg border border-dashed border-line text-subtle hover:border-accent-500 hover:text-accent-700" aria-label={t('web.timetable.addLesson')}>
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!slot} onClose={() => setSlot(null)} title={t('web.timetable.addLesson')} footer={<Button variant="primary" loading={add.isPending} disabled={!f.teachingGroupId} onClick={() => add.mutate(undefined)}>{t('common.add')}</Button>}>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted">{slot && `${t(`web.common.weekday.${slot.weekday}`)} · ${tt.periods.find((p) => p.id === slot.periodId)?.name}`}</p>
          <SelectField label={t('web.nav.teaching')} value={f.teachingGroupId} onValue={(v) => setF({ ...f, teachingGroupId: v })} placeholder={t('web.common.select')} options={relevantGroups.map((g) => ({ value: g.id, label: `${g.name}${g.teachers[0] ? ` — ${g.teachers[0].displayName}` : ''}` }))} />
          <SelectField label={t('web.common.teacher')} value={f.teacherId} onValue={(v) => setF({ ...f, teacherId: v })} placeholder={t('web.timetable.groupTeacher')} options={teachers.options} />
          <SelectField label={t('web.timetable.room')} value={f.roomId} onValue={(v) => setF({ ...f, roomId: v })} placeholder={t('web.common.none')} options={(rooms.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }))} />
          <InlineError error={add.error} />
        </div>
      </Dialog>
      <Dialog open={publishOpen} onClose={() => setPublishOpen(false)} title={t('web.timetable.publishTitle')} footer={<Button variant="primary" loading={publish.isPending} onClick={() => publish.mutate(undefined)}>{t('common.publish')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.effectiveDate')} type="date" value={effectiveFrom} onValue={setEffectiveFrom} hint={t('web.timetable.publishHint')} />
          <InlineError error={publish.error} />
        </div>
      </Dialog>
      <Dialog open={!!exception} onClose={() => setException(null)} title={t('web.timetable.changeFor', { name: exception?.groupName ?? '' })} footer={<Button variant="primary" loading={createException.isPending} onClick={() => createException.mutate(undefined)}>{t('common.save')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('common.date')} type="date" value={ex.date} onValue={(v) => setEx({ ...ex, date: v })} hint={exception ? t('web.timetable.weekdayHint', { day: t(`web.common.weekday.${exception.weekday}`) }) : undefined} />
          <SelectField label={t('web.common.type')} value={ex.kind} onValue={(v) => setEx({ ...ex, kind: v })} options={[{ value: 'cancelled', label: t('web.timetable.cancelled') }, { value: 'substitution', label: t('web.timetable.substitution') }, { value: 'room_change', label: t('web.timetable.roomChange') }]} />
          {ex.kind === 'substitution' && <SelectField label={t('web.timetable.substitute')} value={ex.substituteTeacherId} onValue={(v) => setEx({ ...ex, substituteTeacherId: v })} placeholder={t('web.common.select')} options={teachers.options} />}
          {ex.kind === 'room_change' && <SelectField label={t('web.timetable.room')} value={ex.roomId} onValue={(v) => setEx({ ...ex, roomId: v })} placeholder={t('web.common.select')} options={(rooms.data?.items ?? []).map((r) => ({ value: r.id, label: r.name }))} />}
          <TextField label={t('web.common.note')} value={ex.note} onValue={(v) => setEx({ ...ex, note: v })} />
          <InlineError error={createException.error} />
        </div>
      </Dialog>
    </>
  );
}
