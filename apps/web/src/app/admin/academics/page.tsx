'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AcademicYear, ClassOffering, Curriculum, GradeLevel, z } from '@edventure/contracts';
import { academicYearClosureCheck, room, term } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, Grid, PageHeader, Tabs } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, fieldError } from '@/lib/api';
import { formatDate, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang, useStreams, useSubjects, useYears } from '@/lib/hooks';

type Tab = 'classes' | 'years' | 'subjects' | 'curricula' | 'rooms';

export default function AcademicsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('classes');
  return (
    <>
      <PageHeader title={t('web.nav.structure')} subtitle={t('web.academics.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'classes', label: t('nav.classes') },
          { value: 'years', label: t('web.academics.years') },
          { value: 'subjects', label: t('web.academics.subjectsStreams') },
          { value: 'curricula', label: t('web.academics.curricula') },
          { value: 'rooms', label: t('web.academics.rooms') },
        ]}
      />
      {tab === 'classes' && <Classes />}
      {tab === 'years' && <Years />}
      {tab === 'subjects' && <SubjectsAndStreams />}
      {tab === 'curricula' && <Curricula />}
      {tab === 'rooms' && <Rooms />}
    </>
  );
}

/* ---------------- Classes, sections, subject offerings ---------------- */

function Classes() {
  const { t } = useTranslation();
  const lang = useLang();
  const years = useYears();
  const { year: active } = useActiveYear();
  const [yearId, setYearId] = useState<string>('');
  const effectiveYear = yearId || active?.id || '';
  const classes = useClasses(effectiveYear || null);
  const grades = useApi<{ items: GradeLevel[] }>(['grade-levels'], '/grade-levels');
  const subjects = useSubjects();
  const streams = useStreams();
  const [dialog, setDialog] = useState<null | { kind: 'class' } | { kind: 'section'; cls: ClassOffering } | { kind: 'course'; cls: ClassOffering } | { kind: 'grade' }>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [enroll, setEnroll] = useState(true);
  const set = (k: string) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const invalidate = [['classes', effectiveYear]];
  const createClass = useAction(
    () =>
      api.post('/classes', {
        academicYearId: effectiveYear,
        gradeLevelId: f['gradeLevelId'],
        sections: (f['sections'] ?? 'A').split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({ code: s, name: s })),
      }),
    { invalidate, success: t('web.common.created'), onSuccess: () => setDialog(null) },
  );
  const addSection = useAction((cls: ClassOffering) => api.post(`/classes/${cls.id}/sections`, { code: f['code'], name: f['code'], capacity: f['capacity'] ? Number(f['capacity']) : null }), {
    invalidate,
    success: t('web.common.created'),
    onSuccess: () => setDialog(null),
  });
  const addCourse = useAction(
    (cls: ClassOffering) =>
      api.post(`/classes/${cls.id}/courses`, { subjectId: f['subjectId'], requirement: f['streamId'] ? 'elective' : (f['requirement'] ?? 'compulsory'), streamId: f['streamId'] || null, enrollStudents: enroll }),
    { invalidate, success: t('web.common.created'), onSuccess: () => setDialog(null) },
  );
  const createGrade = useAction(
    () =>
      api.post('/grade-levels', {
        code: f['code'],
        name: f['name'],
        nameUr: f['nameUr'] || null,
        sortOrder: Number(f['sortOrder'] ?? 0),
        nextGradeLevelId: f['nextGradeLevelId'] || null,
        isTerminal: f['isTerminal'] === 'true',
      }),
    { invalidate: [['grade-levels']], success: t('web.common.created'), onSuccess: () => setDialog(null) },
  );
  const open = (d: NonNullable<typeof dialog>) => {
    setF({});
    setEnroll(true);
    setDialog(d);
  };
  const existingGrades = new Set((classes.data?.items ?? []).map((c) => c.gradeLevelId));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField className="w-56" label={t('web.common.year')} value={effectiveYear} onValue={setYearId} options={(years.data?.items ?? []).map((y) => ({ value: y.id, label: `${y.name} (${t(`web.status.${y.status}`)})` }))} />
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => open({ kind: 'class' })} disabled={!effectiveYear}>
          {t('web.academics.offerClass')}
        </Button>
        <Button icon={<Plus size={16} />} onClick={() => open({ kind: 'grade' })}>
          {t('web.academics.newGrade')}
        </Button>
      </div>
      {classes.isLoading ? (
        <LoadingBlock />
      ) : !classes.data?.items.length ? (
        <EmptyState title={t('web.academics.noClasses')} hint={t('web.academics.noClassesHint')} />
      ) : (
        classes.data.items.map((c) => (
          <Card
            key={c.id}
            title={localized(lang, c.gradeName, c.gradeNameUr)}
            actions={
              <>
                <Button size="sm" onClick={() => open({ kind: 'section', cls: c })}>{t('web.academics.addSection')}</Button>
                <Button size="sm" onClick={() => open({ kind: 'course', cls: c })}>{t('web.academics.addSubject')}</Button>
              </>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-subtle">{t('web.academics.sections')}</p>
                <ul className="flex flex-col gap-2">
                  {c.sections.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                      <span className="font-medium">{c.gradeName} {s.name}</span>
                      <span className="text-[13px] text-muted">
                        {t('web.academics.studentsCount', { count: s.studentCount })}
                        {s.capacity ? ` / ${s.capacity}` : ''} · {s.classTeacher ? s.classTeacher.displayName : <span className="text-warning-fg">{t('web.academics.noClassTeacher')}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-subtle">{t('nav.subjects')}</p>
                <div className="flex flex-wrap gap-2">
                  {c.courses.map((co) => (
                    <span key={co.id} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[13px]">
                      {localized(lang, co.subjectName, co.subjectNameUr)}
                      {co.requirement === 'elective' && <Badge tone="info">{co.streamId ? streams.data?.items.find((s) => s.id === co.streamId)?.code : t('web.academics.elective')}</Badge>}
                    </span>
                  ))}
                  {!c.courses.length && <span className="text-muted">{t('web.academics.noSubjects')}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))
      )}

      <Dialog open={dialog?.kind === 'class'} onClose={() => setDialog(null)} title={t('web.academics.offerClass')} footer={<Button variant="primary" loading={createClass.isPending} onClick={() => createClass.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.common.class')} value={f['gradeLevelId'] ?? ''} onValue={set('gradeLevelId')} placeholder={t('web.common.select')} options={(grades.data?.items ?? []).filter((g) => !existingGrades.has(g.id) && !g.archived).map((g) => ({ value: g.id, label: g.name }))} />
          <TextField label={t('web.academics.sectionCodes')} value={f['sections'] ?? 'A, B'} onValue={set('sections')} hint={t('web.academics.sectionCodesHint')} dir="ltr" />
          <p className="text-[13px] text-muted">{t('web.academics.curriculumCopied')}</p>
          <InlineError error={createClass.error} />
        </div>
      </Dialog>
      <Dialog open={dialog?.kind === 'section'} onClose={() => setDialog(null)} title={t('web.academics.addSection')} footer={<Button variant="primary" loading={addSection.isPending} onClick={() => dialog?.kind === 'section' && addSection.mutate(dialog.cls)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.code')} value={f['code'] ?? ''} onValue={set('code')} dir="ltr" error={fieldError(addSection.error, 'code')} />
          <TextField label={t('web.academics.capacity')} value={f['capacity'] ?? ''} onValue={set('capacity')} dir="ltr" />
          <InlineError error={addSection.error} />
        </div>
      </Dialog>
      <Dialog open={dialog?.kind === 'course'} onClose={() => setDialog(null)} title={t('web.academics.addSubject')} footer={<Button variant="primary" loading={addCourse.isPending} onClick={() => dialog?.kind === 'course' && addCourse.mutate(dialog.cls)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.common.subject')} value={f['subjectId'] ?? ''} onValue={set('subjectId')} placeholder={t('web.common.select')} options={(subjects.data?.items ?? []).filter((s) => !s.archived && !(dialog?.kind === 'course' && dialog.cls.courses.some((c) => c.subjectId === s.id))).map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label={t('web.academics.requirement')} value={f['requirement'] ?? 'compulsory'} onValue={set('requirement')} options={[{ value: 'compulsory', label: t('web.academics.compulsory') }, { value: 'elective', label: t('web.academics.elective') }]} />
          <SelectField label={t('web.common.stream')} value={f['streamId'] ?? ''} onValue={set('streamId')} placeholder={t('web.academics.allStreams')} options={(streams.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          <Checkbox label={t('web.academics.enrollExisting')} checked={enroll} onChange={setEnroll} />
          <InlineError error={addCourse.error} />
        </div>
      </Dialog>
      <Dialog open={dialog?.kind === 'grade'} onClose={() => setDialog(null)} title={t('web.academics.newGrade')} footer={<Button variant="primary" loading={createGrade.isPending} onClick={() => createGrade.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('web.common.code')} value={f['code'] ?? ''} onValue={set('code')} dir="ltr" hint="G9" error={fieldError(createGrade.error, 'code')} />
          <TextField label={t('web.academics.order')} value={f['sortOrder'] ?? ''} onValue={set('sortOrder')} dir="ltr" />
          <TextField label={t('web.common.name')} value={f['name'] ?? ''} onValue={set('name')} />
          <TextField label={t('web.common.nameUr')} value={f['nameUr'] ?? ''} onValue={set('nameUr')} dir="rtl" />
          <SelectField className="sm:col-span-2" label={t('web.academics.nextClass')} value={f['nextGradeLevelId'] ?? ''} onValue={set('nextGradeLevelId')} placeholder={t('web.common.none')} options={(grades.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))} />
          <div className="sm:col-span-2">
            <Checkbox label={t('web.academics.terminal')} hint={t('web.academics.terminalHint')} checked={f['isTerminal'] === 'true'} onChange={(v) => setF((s) => ({ ...s, isTerminal: String(v), nextGradeLevelId: v ? '' : (s['nextGradeLevelId'] ?? '') }))} />
          </div>
          <InlineError error={createGrade.error} />
        </div>
      </Dialog>
    </div>
  );
}

/* ---------------- Academic years and terms ---------------- */

function Years() {
  const { t } = useTranslation();
  const lang = useLang();
  const years = useYears();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ code: '', name: '', startDate: '', endDate: '' });
  const [selected, setSelected] = useState<AcademicYear | null>(null);
  const create = useAction(() => api.post('/academic-years', f), { invalidate: [['academic-years']], success: t('web.common.created'), onSuccess: () => setOpen(false) });
  const activate = useAction((id: string) => api.post(`/academic-years/${id}/activate`), { invalidate: [['academic-years']], success: t('web.common.updated'), toastErrors: true });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card title={t('web.academics.years')} actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>{t('web.common.newItem')}</Button>} padded={false}>
        <DataTable
          rows={years.data?.items ?? []}
          rowKey={(r) => r.id}
          onRowClick={setSelected}
          columns={[
            { key: 'n', header: t('web.common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'd', header: t('common.date'), cell: (r) => `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}` },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.status] ?? 'neutral'}>{t(`web.status.${r.status}`)}</Badge> },
            { key: 'a', header: '', cell: (r) => r.status === 'planning' && <Button size="sm" onClick={(e) => { e.stopPropagation(); activate.mutate(r.id); }}>{t('web.academics.activate')}</Button> },
          ]}
        />
      </Card>
      {selected ? <YearDetail year={selected} /> : <Card><EmptyState title={t('web.academics.selectYear')} /></Card>}
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.academics.newYear')} footer={<Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" hint="2027-28" error={fieldError(create.error, 'code')} />
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
          <TextField label={t('web.common.startDate')} type="date" value={f.startDate} onValue={(v) => setF({ ...f, startDate: v })} error={fieldError(create.error, 'startDate')} />
          <TextField label={t('web.common.endDate')} type="date" value={f.endDate} onValue={(v) => setF({ ...f, endDate: v })} error={fieldError(create.error, 'endDate')} />
          <div className="sm:col-span-2"><InlineError error={create.error} /></div>
        </div>
      </Dialog>
    </div>
  );
}

function YearDetail({ year }: { year: AcademicYear }) {
  const { t } = useTranslation();
  const lang = useLang();
  const terms = useApi<{ items: z.infer<typeof term>[] }>(['terms', year.id], `/academic-years/${year.id}/terms`);
  const check = useApi<z.infer<typeof academicYearClosureCheck>>(['closure', year.id], year.status === 'active' ? `/academic-years/${year.id}/closure-check` : null);
  const [f, setF] = useState({ name: '', sequence: '1', startDate: year.startDate, endDate: year.endDate });
  const addTerm = useAction(() => api.post(`/academic-years/${year.id}/terms`, { ...f, sequence: Number(f.sequence) }), { invalidate: [['terms', year.id]], success: t('web.common.created'), toastErrors: true });
  const close = useAction(() => api.post(`/academic-years/${year.id}/close`), { invalidate: [['academic-years'], ['closure', year.id]], success: t('web.common.updated'), toastErrors: true });
  return (
    <Card title={year.name}>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-subtle">{t('web.academics.terms')}</p>
      <ul className="mb-4 flex flex-col gap-2">
        {(terms.data?.items ?? []).map((tm) => (
          <li key={tm.id} className="flex justify-between rounded-lg border border-line px-3 py-2">
            <span>{localized(lang, tm.name, tm.nameUr)}</span>
            <span className="text-[13px] text-muted">{formatDate(tm.startDate, lang)} – {formatDate(tm.endDate, lang)}</span>
          </li>
        ))}
      </ul>
      {year.status !== 'closed' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
          <TextField label="#" value={f.sequence} onValue={(v) => setF({ ...f, sequence: v })} dir="ltr" />
          <TextField label={t('web.common.startDate')} type="date" value={f.startDate} onValue={(v) => setF({ ...f, startDate: v })} />
          <TextField label={t('web.common.endDate')} type="date" value={f.endDate} onValue={(v) => setF({ ...f, endDate: v })} />
          <Button className="sm:col-span-2" loading={addTerm.isPending} onClick={() => addTerm.mutate(undefined)} disabled={!f.name}>{t('web.academics.addTerm')}</Button>
        </div>
      )}
      {year.status === 'active' && check.data && (
        <div className="mt-5 rounded-lg border border-line p-3">
          <p className="font-medium">{t('web.academics.closeYear')}</p>
          {check.data.blockers.length ? (
            <ul className="mt-2 list-disc space-y-1 ps-5 text-[13px] text-warning-fg">
              {check.data.blockers.map((b) => <li key={b.kind}>{b.count} {b.message}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-muted">{t('web.academics.readyToClose')}</p>
          )}
          <Button className="mt-3" size="sm" variant="danger" disabled={!check.data.canClose} loading={close.isPending} onClick={() => close.mutate(undefined)}>{t('web.academics.closeYear')}</Button>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Subjects and streams ---------------- */

function SubjectsAndStreams() {
  const { t } = useTranslation();
  const subjects = useSubjects();
  const streams = useStreams();
  const [dialog, setDialog] = useState<'subject' | 'stream' | null>(null);
  const [f, setF] = useState({ code: '', name: '', nameUr: '', description: '' });
  const create = useAction(
    () => (dialog === 'subject' ? api.post('/subjects', { code: f.code, name: f.name, nameUr: f.nameUr || null }) : api.post('/streams', { code: f.code, name: f.name, nameUr: f.nameUr || null, description: f.description || null })),
    { invalidate: [['subjects'], ['streams']], success: t('web.common.created'), onSuccess: () => setDialog(null) },
  );
  const archive = useAction(({ kind, id, archived }: { kind: 'subjects' | 'streams'; id: string; archived: boolean }) => api.patch(`/${kind}/${id}`, { archived }), { invalidate: [['subjects'], ['streams']], toastErrors: true });
  return (
    <Grid cols={2}>
      <Card title={t('nav.subjects')} actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => { setF({ code: '', name: '', nameUr: '', description: '' }); setDialog('subject'); }}>{t('web.common.newItem')}</Button>} padded={false}>
        <DataTable
          rows={subjects.data?.items ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'c', header: t('web.common.code'), cell: (r) => <span className="tabular">{r.code}</span> },
            { key: 'n', header: t('web.common.name'), cell: (r) => <span>{r.name} <span className="text-muted">{r.nameUr}</span></span> },
            { key: 'a', header: '', cell: (r) => <Button size="sm" variant="ghost" onClick={() => archive.mutate({ kind: 'subjects', id: r.id, archived: !r.archived })}>{r.archived ? t('web.common.unarchive') : t('web.common.archive')}</Button> },
          ]}
        />
      </Card>
      <Card title={t('web.academics.streams')} actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => { setF({ code: '', name: '', nameUr: '', description: '' }); setDialog('stream'); }}>{t('web.common.newItem')}</Button>} padded={false}>
        <p className="px-5 pt-3 text-[13px] text-muted">{t('web.academics.streamsHint')}</p>
        <DataTable
          rows={streams.data?.items ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'c', header: t('web.common.code'), cell: (r) => <span className="tabular">{r.code}</span> },
            { key: 'n', header: t('web.common.name'), cell: (r) => r.name },
            { key: 'a', header: '', cell: (r) => <Button size="sm" variant="ghost" onClick={() => archive.mutate({ kind: 'streams', id: r.id, archived: !r.archived })}>{r.archived ? t('web.common.unarchive') : t('web.common.archive')}</Button> },
          ]}
        />
      </Card>
      <Dialog open={!!dialog} onClose={() => setDialog(null)} title={dialog === 'subject' ? t('web.academics.newSubject') : t('web.academics.newStream')} footer={<Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" error={fieldError(create.error, 'code')} />
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
          <TextField label={t('web.common.nameUr')} value={f.nameUr} onValue={(v) => setF({ ...f, nameUr: v })} dir="rtl" />
          {dialog === 'stream' && <TextField label={t('web.common.description')} value={f.description} onValue={(v) => setF({ ...f, description: v })} />}
          <InlineError error={create.error} />
        </div>
      </Dialog>
    </Grid>
  );
}

/* ---------------- Curricula ---------------- */

function Curricula() {
  const { t } = useTranslation();
  const grades = useApi<{ items: GradeLevel[] }>(['grade-levels'], '/grade-levels');
  const list = useApi<{ items: Curriculum[] }>(['curricula'], '/curricula');
  const subjects = useSubjects();
  const streams = useStreams();
  const [open, setOpen] = useState(false);
  const [gradeLevelId, setGradeLevelId] = useState('');
  const [name, setName] = useState('');
  const [rows, setRows] = useState<Array<{ subjectId: string; requirement: string; streamId: string }>>([]);
  const create = useAction(
    () => api.post('/curricula', { gradeLevelId, name, subjects: rows.filter((r) => r.subjectId).map((r, i) => ({ subjectId: r.subjectId, requirement: r.streamId ? 'elective' : r.requirement, streamId: r.streamId || null, sortOrder: i })) }),
    { invalidate: [['curricula']], success: t('web.common.created'), onSuccess: () => setOpen(false) },
  );
  const activate = useAction((id: string) => api.patch(`/curricula/${id}`, { state: 'active' }), { invalidate: [['curricula']], success: t('web.common.updated'), toastErrors: true });
  const gradeName = (id: string) => grades.data?.items.find((g) => g.id === id)?.name ?? '';
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setRows([{ subjectId: '', requirement: 'compulsory', streamId: '' }]); setName(''); setGradeLevelId(''); setOpen(true); }}>
          {t('web.academics.newCurriculum')}
        </Button>
      </div>
      <Grid cols={2}>
        {(list.data?.items ?? []).map((c) => (
          <Card key={c.id} title={`${gradeName(c.gradeLevelId)} · ${c.name} (v${c.versionNumber})`} actions={c.state === 'draft' ? <Button size="sm" onClick={() => activate.mutate(c.id)}>{t('web.academics.activate')}</Button> : <Badge tone={stateTone[c.state] ?? 'neutral'}>{t(`web.status.${c.state}`)}</Badge>}>
            <ul className="flex flex-wrap gap-2">
              {c.subjects.map((s) => (
                <li key={s.id} className="rounded-full border border-line px-3 py-1 text-[13px]">
                  {s.subjectName}
                  {s.streamName ? ` · ${s.streamName}` : s.requirement === 'elective' ? ` · ${t('web.academics.elective')}` : ''}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </Grid>
      <Dialog open={open} onClose={() => setOpen(false)} wide title={t('web.academics.newCurriculum')} footer={<Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label={t('web.common.class')} value={gradeLevelId} onValue={setGradeLevelId} placeholder={t('web.common.select')} options={(grades.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))} />
            <TextField label={t('web.common.name')} value={name} onValue={setName} />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <SelectField label={t('web.common.subject')} value={r.subjectId} onValue={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, subjectId: v } : x)))} placeholder={t('web.common.select')} options={(subjects.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
              <SelectField label={t('web.academics.requirement')} value={r.requirement} onValue={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, requirement: v } : x)))} options={[{ value: 'compulsory', label: t('web.academics.compulsory') }, { value: 'elective', label: t('web.academics.elective') }]} />
              <SelectField label={t('web.common.stream')} value={r.streamId} onValue={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, streamId: v } : x)))} placeholder={t('web.academics.allStreams')} options={(streams.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
            </div>
          ))}
          <Button size="sm" onClick={() => setRows([...rows, { subjectId: '', requirement: 'compulsory', streamId: '' }])}>{t('web.academics.addSubject')}</Button>
          <InlineError error={create.error} />
        </div>
      </Dialog>
    </div>
  );
}

/* ---------------- Rooms ---------------- */

function Rooms() {
  const { t } = useTranslation();
  const rooms = useApi<{ items: z.infer<typeof room>[] }>(['rooms'], '/rooms');
  const [f, setF] = useState({ code: '', name: '', capacity: '' });
  const create = useAction(() => api.post('/rooms', { code: f.code, name: f.name, capacity: f.capacity ? Number(f.capacity) : null }), {
    invalidate: [['rooms']],
    success: t('web.common.created'),
    onSuccess: () => setF({ code: '', name: '', capacity: '' }),
  });
  return (
    <Grid cols={2}>
      <Card title={t('web.academics.rooms')} padded={false}>
        <DataTable
          rows={rooms.data?.items ?? []}
          rowKey={(r) => r.id}
          columns={[
            { key: 'c', header: t('web.common.code'), cell: (r) => r.code },
            { key: 'n', header: t('web.common.name'), cell: (r) => r.name },
            { key: 'p', header: t('web.academics.capacity'), numeric: true, cell: (r) => r.capacity ?? '—' },
          ]}
        />
      </Card>
      <Card title={t('web.academics.newRoom')}>
        <div className="grid gap-3">
          <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" error={fieldError(create.error, 'code')} />
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
          <TextField label={t('web.academics.capacity')} value={f.capacity} onValue={(v) => setF({ ...f, capacity: v.replace(/\D/g, '') })} dir="ltr" />
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)} disabled={!f.code || !f.name}>{t('common.create')}</Button>
          <InlineError error={create.error} />
        </div>
      </Card>
    </Grid>
  );
}
