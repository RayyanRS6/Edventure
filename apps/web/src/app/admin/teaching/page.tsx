'use client';

import { Plus, Sparkles, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TeachingGroup, z } from '@edventure/contracts';
import { classTeacherAssignment, classTeacherSuggestion, delegation, groupMember } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader, Tabs } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, todayLocal } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang, useSectionOptions, useTeacherOptions } from '@/lib/hooks';

type Tab = 'groups' | 'classTeachers' | 'delegations';

export default function TeachingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('groups');
  return (
    <>
      <PageHeader title={t('web.nav.teaching')} subtitle={t('web.teaching.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'groups', label: t('web.nav.teaching') },
          { value: 'classTeachers', label: t('web.teaching.classTeachers') },
          { value: 'delegations', label: t('web.teaching.delegations') },
        ]}
      />
      {tab === 'groups' && <Groups />}
      {tab === 'classTeachers' && <ClassTeachers />}
      {tab === 'delegations' && <Delegations />}
    </>
  );
}

function Groups() {
  const { t } = useTranslation();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const teachers = useTeacherOptions();
  const [classOfferingId, setClassOfferingId] = useState('');
  const cls = classes.data?.items.find((c) => c.id === classOfferingId) ?? classes.data?.items[0];
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', cls?.id], cls ? '/teaching-groups' : null, cls ? { classOfferingId: cls.id } : undefined);
  const [create, setCreate] = useState(false);
  const [assign, setAssign] = useState<TeachingGroup | null>(null);
  const [members, setMembers] = useState<TeachingGroup | null>(null);
  const [f, setF] = useState({ courseOfferingId: '', sectionId: '', code: '', name: '', teacherId: '', populate: true });
  const invalidate = [['teaching-groups', cls?.id]];
  const createGroup = useAction(
    () => api.post('/teaching-groups', { courseOfferingId: f.courseOfferingId, sectionId: f.sectionId || null, code: f.code, name: f.name, populate: f.populate }),
    { invalidate, success: t('web.common.created'), onSuccess: () => setCreate(false) },
  );
  const assignTeacher = useAction((g: TeachingGroup) => api.post('/teacher-assignments', { teacherId: f.teacherId, teachingGroupId: g.id, startDate: todayLocal() }), {
    invalidate,
    success: t('web.common.updated'),
    onSuccess: () => setAssign(null),
  });
  const endAssignment = useAction((id: string) => api.post(`/teacher-assignments/${id}/end`, { endDate: todayLocal() }), { invalidate, toastErrors: true });
  const course = cls?.courses.find((c) => c.id === f.courseOfferingId);
  const section = cls?.sections.find((s) => s.id === f.sectionId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectField className="w-52" label={t('web.common.class')} value={cls?.id ?? ''} onValue={setClassOfferingId} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />
        <Button variant="primary" icon={<Plus size={16} />} disabled={!cls} onClick={() => { setF({ courseOfferingId: '', sectionId: '', code: '', name: '', teacherId: '', populate: true }); setCreate(true); }}>
          {t('web.teaching.newGroup')}
        </Button>
      </div>
      <Card padded={false}>
        {groups.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={groups.data?.items ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title={t('web.teaching.noGroups')} hint={t('web.teaching.noGroupsHint')} />}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-[12px] text-muted">{r.subjectName} · {r.sectionName ? `${r.gradeName} ${r.sectionName}` : t('web.teaching.wholeClass')}</p></div> },
              { key: 'm', header: t('web.teaching.members'), numeric: true, cell: (r) => r.memberCount },
              {
                key: 't',
                header: t('nav.teachers'),
                cell: (r) =>
                  r.teachers.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.teachers.map((x) => (
                        <span key={x.assignmentId} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[12px]">
                          {x.displayName}
                          <button className="text-muted hover:text-danger-fg" aria-label={t('web.teaching.unassign')} onClick={() => endAssignment.mutate(x.assignmentId)}>×</button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Badge tone="warning">{t('web.teaching.noTeacher')}</Badge>
                  ),
              },
              {
                key: 'a',
                header: '',
                cell: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" icon={<UserPlus size={14} />} onClick={() => { setF((s) => ({ ...s, teacherId: '' })); setAssign(r); }}>{t('web.teaching.assign')}</Button>
                    <Button size="sm" variant="ghost" icon={<Users size={14} />} onClick={() => setMembers(r)}>{t('web.teaching.members')}</Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Dialog open={create} onClose={() => setCreate(false)} title={t('web.teaching.newGroup')} footer={<Button variant="primary" loading={createGroup.isPending} onClick={() => createGroup.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <SelectField
            label={t('web.common.subject')}
            value={f.courseOfferingId}
            onValue={(v) => {
              const c = cls?.courses.find((x) => x.id === v);
              setF((s) => ({ ...s, courseOfferingId: v, code: `${c?.subjectCode ?? ''}-${section?.code ?? ''}`, name: `${c?.subjectName ?? ''} ${cls?.gradeName.replace(/\D/g, '') ?? ''}${section?.code ?? ''}` }));
            }}
            placeholder={t('web.common.select')}
            options={(cls?.courses ?? []).map((c) => ({ value: c.id, label: c.subjectName }))}
          />
          <SelectField
            label={t('web.common.section')}
            value={f.sectionId}
            onValue={(v) => {
              const sec = cls?.sections.find((x) => x.id === v);
              setF((s) => ({ ...s, sectionId: v, code: `${course?.subjectCode ?? ''}-${sec?.code ?? ''}`, name: `${course?.subjectName ?? ''} ${cls?.gradeName.replace(/\D/g, '') ?? ''}${sec?.code ?? ''}` }));
            }}
            placeholder={t('web.teaching.wholeClass')}
            options={(cls?.sections ?? []).map((s) => ({ value: s.id, label: `${cls!.gradeName} ${s.name}` }))}
          />
          <TextField label={t('web.common.code')} value={f.code} onValue={(v) => setF({ ...f, code: v })} dir="ltr" />
          <TextField label={t('web.common.name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} />
          <Checkbox label={t('web.teaching.populate')} hint={t('web.teaching.populateHint')} checked={f.populate} onChange={(v) => setF({ ...f, populate: v })} />
          <InlineError error={createGroup.error} />
        </div>
      </Dialog>
      <Dialog open={!!assign} onClose={() => setAssign(null)} title={t('web.teaching.assignTo', { name: assign?.name ?? '' })} footer={<Button variant="primary" loading={assignTeacher.isPending} disabled={!f.teacherId} onClick={() => assign && assignTeacher.mutate(assign)}>{t('web.teaching.assign')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.common.teacher')} value={f.teacherId} onValue={(v) => setF({ ...f, teacherId: v })} placeholder={t('web.common.select')} options={teachers.options} />
          <InlineError error={assignTeacher.error} />
        </div>
      </Dialog>
      {members && <MembersDialog group={members} onClose={() => setMembers(null)} />}
    </div>
  );
}

function MembersDialog({ group, onClose }: { group: TeachingGroup; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof groupMember>[] }>(['group-members', group.id], `/teaching-groups/${group.id}/members`);
  const remove = useAction((studentId: string) => api.post(`/teaching-groups/${group.id}/members`, { effectiveDate: todayLocal(), remove: [studentId] }), {
    invalidate: [['group-members', group.id], ['teaching-groups']],
    toastErrors: true,
  });
  return (
    <Dialog open onClose={onClose} title={`${group.name} · ${t('web.teaching.members')}`} wide>
      {q.isLoading ? (
        <LoadingBlock />
      ) : (
        <DataTable
          rows={q.data?.items ?? []}
          rowKey={(r) => r.studentId}
          columns={[
            { key: 'n', header: t('web.common.name'), cell: (r) => r.displayName },
            { key: 'a', header: t('web.people.admissionNumber'), cell: (r) => r.admissionNumber },
            { key: 's', header: t('web.common.startDate'), cell: (r) => formatDate(r.startDate, lang) },
            { key: 'x', header: '', cell: (r) => <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.studentId)}>{t('web.teaching.remove')}</Button> },
          ]}
        />
      )}
      <p className="mt-3 text-[13px] text-muted">{t('web.teaching.membersHint')}</p>
    </Dialog>
  );
}

function ClassTeachers() {
  const { t } = useTranslation();
  const lang = useLang();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const teachers = useTeacherOptions();
  const list = useApi<{ items: z.infer<typeof classTeacherAssignment>[] }>(['class-teachers'], '/class-teacher-assignments');
  const [dialog, setDialog] = useState<{ sectionId: string; label: string } | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [startDate, setStartDate] = useState(todayLocal());
  const [suggestion, setSuggestion] = useState<z.infer<typeof classTeacherSuggestion> | null>(null);
  const assign = useAction(
    (replace: boolean) => api.post('/class-teacher-assignments', { teacherId, sectionId: dialog!.sectionId, startDate, replaceCurrent: replace }),
    { invalidate: [['class-teachers'], ['classes']], success: t('web.common.updated'), onSuccess: () => setDialog(null) },
  );
  const current = (sectionId: string) => list.data?.items.find((a) => a.sectionId === sectionId);
  const openFor = async (sectionId: string, label: string) => {
    setTeacherId('');
    setSuggestion(null);
    setDialog({ sectionId, label });
    setSuggestion(await api.get<z.infer<typeof classTeacherSuggestion>>(`/sections/${sectionId}/class-teacher-suggestion`).catch(() => null));
  };
  return (
    <Card padded={false}>
      <p className="px-5 pt-3 text-[13px] text-muted">{t('web.teaching.classTeacherHint')}</p>
      <DataTable
        rows={sections.options}
        rowKey={(r) => r.value}
        columns={[
          { key: 's', header: t('web.common.section'), cell: (r) => <span className="font-medium">{r.label}</span> },
          { key: 't', header: t('roles.classTeacher'), cell: (r) => current(r.value)?.teacherName ?? <Badge tone="warning">{t('web.academics.noClassTeacher')}</Badge> },
          { key: 'd', header: t('web.common.startDate'), cell: (r) => formatDate(current(r.value)?.startDate, lang) },
          { key: 'a', header: '', cell: (r) => <Button size="sm" onClick={() => openFor(r.value, r.label)}>{current(r.value) ? t('web.teaching.change') : t('web.teaching.assign')}</Button> },
        ]}
      />
      <Dialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        title={t('web.teaching.classTeacherFor', { section: dialog?.label ?? '' })}
        footer={<Button variant="primary" loading={assign.isPending} disabled={!teacherId} onClick={() => assign.mutate(!!(dialog && current(dialog.sectionId)))}>{t('common.save')}</Button>}
      >
        <div className="grid gap-3">
          {suggestion?.teacherId && (
            <button onClick={() => setTeacherId(suggestion.teacherId!)} className="flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 p-3 text-start text-sm">
              <Sparkles size={16} className="mt-0.5 text-accent-700" />
              <span>
                {t('web.teaching.suggested', { name: suggestion.teacherName })}
                <span className="block text-[12px] text-muted">{suggestion.reason}</span>
              </span>
            </button>
          )}
          <SelectField label={t('web.common.teacher')} value={teacherId} onValue={setTeacherId} placeholder={t('web.common.select')} options={teachers.options} />
          <TextField label={t('web.common.startDate')} type="date" value={startDate} onValue={setStartDate} />
          {dialog && current(dialog.sectionId) && <p className="text-[13px] text-muted">{t('web.teaching.replaceHint', { name: current(dialog.sectionId)!.teacherName })}</p>}
          <InlineError error={assign.error} />
        </div>
      </Dialog>
    </Card>
  );
}

function Delegations() {
  const { t } = useTranslation();
  const lang = useLang();
  const { year } = useActiveYear();
  const sections = useSectionOptions(year?.id);
  const teachers = useTeacherOptions();
  const list = useApi<{ items: z.infer<typeof delegation>[] }>(['delegations'], '/attendance-delegations');
  const [f, setF] = useState({ sectionId: '', teacherId: '', startDate: todayLocal(), lastDate: todayLocal(), reason: '' });
  const create = useAction(() => api.post('/attendance-delegations', { ...f, reason: f.reason || null }), { invalidate: [['delegations']], success: t('web.common.created') });
  const revoke = useAction((id: string) => api.delete(`/attendance-delegations/${id}`), { invalidate: [['delegations']], toastErrors: true });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card title={t('web.teaching.delegations')} padded={false}>
        <DataTable
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          empty={<EmptyState title={t('web.teaching.noDelegations')} />}
          columns={[
            { key: 's', header: t('web.common.section'), cell: (r) => r.sectionName },
            { key: 't', header: t('web.common.teacher'), cell: (r) => r.teacherName },
            { key: 'd', header: t('common.date'), cell: (r) => `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}` },
            { key: 'x', header: '', cell: (r) => <Button size="sm" variant="ghost" onClick={() => revoke.mutate(r.id)}>{t('web.teaching.revoke')}</Button> },
          ]}
        />
      </Card>
      <Card title={t('web.teaching.newDelegation')}>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted">{t('web.teaching.delegationHint')}</p>
          <SelectField label={t('web.common.section')} value={f.sectionId} onValue={(v) => setF({ ...f, sectionId: v })} placeholder={t('web.common.select')} options={sections.options} />
          <SelectField label={t('web.common.teacher')} value={f.teacherId} onValue={(v) => setF({ ...f, teacherId: v })} placeholder={t('web.common.select')} options={teachers.options} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label={t('leave.startDate')} type="date" value={f.startDate} onValue={(v) => setF({ ...f, startDate: v })} />
            <TextField label={t('leave.endDate')} type="date" value={f.lastDate} onValue={(v) => setF({ ...f, lastDate: v })} />
          </div>
          <TextField label={t('web.common.optionalReason')} value={f.reason} onValue={(v) => setF({ ...f, reason: v })} />
          <Button variant="primary" loading={create.isPending} disabled={!f.sectionId || !f.teacherId} onClick={() => create.mutate(undefined)}>{t('common.save')}</Button>
          <InlineError error={create.error} />
        </div>
      </Card>
    </div>
  );
}
