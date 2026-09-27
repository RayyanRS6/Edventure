'use client';

import { Paperclip, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Announcement, AudienceSpec, FileInfo, Page, TeachingGroup } from '@edventure/contracts';
import { announcementCategories, announcementStates, roles } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField, Textarea } from '@/components/ui/field';
import { Badge, Card, PageHeader, Toolbar } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, downloadFile } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useAction, useActiveYear, useApi, useClasses, useLang, useSectionOptions } from '@/lib/hooks';
import { uploadFile } from '@/lib/upload';

type Draft = { title: string; titleUr: string; body: string; bodyUr: string; category: string; audiences: AudienceSpec[]; files: FileInfo[] };
const emptyDraft = (): Draft => ({ title: '', titleUr: '', body: '', bodyUr: '', category: 'general', audiences: [{ target: 'everyone' }], files: [] });

export default function AnnouncementsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const [state, setState] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(50);
  const q = useApi<Page<Announcement>>(['announcements', state, category, limit], '/announcements', { state: state || undefined, category: category || undefined, limit });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<Announcement | null>(null);
  const describe = useAudienceLabel();

  return (
    <>
      <PageHeader title={t('nav.announcements')} subtitle={t('web.announcements.subtitle')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setDraft(emptyDraft())}>{t('web.announcements.new')}</Button>} />
      <Toolbar>
        <SelectField className="w-40" label={t('common.status')} value={state} onValue={setState} placeholder={t('common.all')} options={announcementStates.map((s) => ({ value: s, label: t(`web.status.${s}`) }))} />
        <SelectField className="w-44" label={t('web.announcements.category')} value={category} onValue={setCategory} placeholder={t('common.all')} options={announcementCategories.map((c) => ({ value: c, label: t(`web.announcements.categories.${c}`) }))} />
      </Toolbar>
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={setOpen}
            empty={<EmptyState title={t('web.announcements.none')} />}
            footer={q.data?.nextCursor ? <Button size="sm" onClick={() => setLimit((l) => Math.min(100, l + 50))}>{t('common.loadMore')}</Button> : undefined}
            columns={[
              { key: 't', header: t('web.common.title'), cell: (r) => <div><p className="font-medium">{lang === 'ur' && r.titleUr ? r.titleUr : r.title}</p><p className="line-clamp-1 max-w-md text-[12px] text-muted">{lang === 'ur' && r.bodyUr ? r.bodyUr : r.body}</p></div> },
              { key: 'c', header: t('web.announcements.category'), cell: (r) => <Badge tone={r.category === 'emergency' ? 'danger' : 'neutral'}>{t(`web.announcements.categories.${r.category}`)}</Badge> },
              { key: 'a', header: t('web.announcements.audience'), cell: (r) => <span className="text-[13px]">{r.audiences.map(describe).join(', ')}</span> },
              { key: 'n', header: t('web.announcements.recipients'), numeric: true, cell: (r) => r.recipientCount ?? '—' },
              { key: 's', header: t('common.status'), cell: (r) => <div><Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge><p className="mt-0.5 text-[11px] text-muted">{formatDateTime(r.publishedAt ?? r.createdAt, lang)}</p></div> },
            ]}
          />
        )}
      </Card>
      {draft && <ComposeDialog initial={draft} onClose={() => setDraft(null)} />}
      {open && <AnnouncementDialog announcement={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Human-readable audience, e.g. "Everyone", "Teachers", "Grade 9 A". */
function useAudienceLabel() {
  const { t } = useTranslation();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const sections = useSectionOptions(year?.id);
  return (a: AudienceSpec) => {
    if (a.target === 'everyone') return t('web.announcements.everyone');
    if (a.target === 'role') return a.role ? t(`web.announcements.roleAudience.${a.role}`) : '';
    if (a.target === 'class_offering') return classes.data?.items.find((c) => c.id === a.classOfferingId)?.gradeName ?? t('web.common.class');
    if (a.target === 'section') return sections.options.find((s) => s.value === a.sectionId)?.label ?? t('web.common.section');
    return t('web.nav.teaching');
  };
}

function AudienceRow({ value, onChange, onRemove }: { value: AudienceSpec; onChange: (a: AudienceSpec) => void; onRemove?: () => void }) {
  const { t } = useTranslation();
  const { year } = useActiveYear();
  const classes = useClasses(year?.id);
  const sections = useSectionOptions(year?.id);
  const [groupClassId, setGroupClassId] = useState('');
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', groupClassId], groupClassId ? '/teaching-groups' : null, groupClassId ? { classOfferingId: groupClassId } : undefined);
  const targets = ['everyone', 'role', 'class_offering', 'section', 'teaching_group'] as const;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-2">
      <SelectField className="w-44" label={t('web.announcements.sendTo')} value={value.target} onValue={(v) => onChange({ target: v as AudienceSpec['target'] })} options={targets.map((x) => ({ value: x, label: t(`web.announcements.targets.${x}`) }))} />
      {value.target === 'role' && <SelectField className="w-44" label={t('web.announcements.role')} value={value.role ?? ''} onValue={(v) => onChange({ ...value, role: v as AudienceSpec['role'] })} placeholder={t('web.common.select')} options={roles.map((r) => ({ value: r, label: t(`web.announcements.roleAudience.${r}`) }))} />}
      {value.target === 'class_offering' && <SelectField className="w-44" label={t('web.common.class')} value={value.classOfferingId ?? ''} onValue={(v) => onChange({ ...value, classOfferingId: v })} placeholder={t('web.common.select')} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />}
      {value.target === 'section' && <SelectField className="w-44" label={t('web.common.section')} value={value.sectionId ?? ''} onValue={(v) => onChange({ ...value, sectionId: v })} placeholder={t('web.common.select')} options={sections.options} />}
      {value.target === 'teaching_group' && (
        <>
          <SelectField className="w-36" label={t('web.common.class')} value={groupClassId} onValue={setGroupClassId} placeholder={t('web.common.select')} options={(classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))} />
          <SelectField className="w-52" label={t('web.nav.teaching')} value={value.teachingGroupId ?? ''} onValue={(v) => onChange({ ...value, teachingGroupId: v })} placeholder={t('web.common.select')} options={(groups.data?.items ?? []).map((g) => ({ value: g.id, label: g.name }))} />
        </>
      )}
      {onRemove && <button aria-label={t('common.delete')} className="mb-2 ms-auto p-1 text-muted hover:text-danger-fg" onClick={onRemove}><Trash2 size={15} /></button>}
    </div>
  );
}

function ComposeDialog({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const save = useAction(
    (publish: boolean) =>
      api.post('/announcements', {
        title: d.title,
        titleUr: d.titleUr || null,
        body: d.body,
        bodyUr: d.bodyUr || null,
        category: d.category,
        audiences: d.audiences,
        attachmentFileIds: d.files.map((f) => f.id),
        publish,
      }),
    { invalidate: [['announcements'], ['admin-dashboard']], success: t('web.common.updated'), onSuccess: onClose },
  );
  const addFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const info = await uploadFile(file, 'announcement_attachment');
      setD((s) => ({ ...s, files: [...s.files, info] }));
    } catch (e) {
      setUploadError(e);
    } finally {
      setUploading(false);
    }
  };
  const valid = d.title.trim() && d.body.trim() && d.audiences.length > 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('web.announcements.new')}
      wide
      footer={
        <>
          <Button loading={save.isPending && save.variables === false} disabled={!valid} onClick={() => save.mutate(false)}>{t('web.announcements.saveDraft')}</Button>
          <Button variant="primary" loading={save.isPending && save.variables === true} disabled={!valid || uploading} onClick={() => save.mutate(true)}>{t('common.publish')}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <TextField label={t('web.common.title')} value={d.title} onValue={(v) => setD({ ...d, title: v })} required />
          <SelectField label={t('web.announcements.category')} value={d.category} onValue={(v) => setD({ ...d, category: v })} options={announcementCategories.map((c) => ({ value: c, label: t(`web.announcements.categories.${c}`) }))} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-soft">{t('web.announcements.message')} <span className="text-danger-fg">*</span></span>
          <Textarea value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} maxLength={5000} />
        </label>
        <details className="rounded-lg border border-line p-3" open={!!(d.titleUr || d.bodyUr)}>
          <summary className="cursor-pointer text-[13px] font-medium">{t('web.announcements.urduVersion')}</summary>
          <div className="mt-3 grid gap-3" dir="rtl">
            <TextField label={t('web.announcements.titleUr')} value={d.titleUr} onValue={(v) => setD({ ...d, titleUr: v })} dir="rtl" />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-soft">{t('web.announcements.messageUr')}</span>
              <Textarea dir="rtl" lang="ur" value={d.bodyUr} onChange={(e) => setD({ ...d, bodyUr: e.target.value })} maxLength={5000} />
            </label>
          </div>
          <p className="mt-2 text-[12px] text-muted">{t('web.announcements.urduHint')}</p>
        </details>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-ink-soft">{t('web.announcements.audience')}</p>
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} disabled={d.audiences.length >= 20} onClick={() => setD({ ...d, audiences: [...d.audiences, { target: 'section' }] })}>{t('common.add')}</Button>
          </div>
          {d.audiences.map((a, i) => (
            <AudienceRow key={i} value={a} onChange={(v) => setD({ ...d, audiences: d.audiences.map((x, j) => (j === i ? v : x)) })} onRemove={d.audiences.length > 1 ? () => setD({ ...d, audiences: d.audiences.filter((_, j) => j !== i) }) : undefined} />
          ))}
          <p className="text-[12px] text-muted">{t('web.announcements.audienceHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {d.files.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[13px]">
              <Paperclip size={12} /> {f.name}
              <button aria-label={t('common.delete')} className="text-muted hover:text-danger-fg" onClick={() => setD({ ...d, files: d.files.filter((x) => x.id !== f.id) })}><X size={12} /></button>
            </span>
          ))}
          {d.files.length < 5 && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-[13px] text-muted hover:border-accent-500 hover:text-accent-700">
              <Paperclip size={14} /> {uploading ? t('web.common.uploading') : t('web.announcements.attach')}
              <input type="file" className="hidden" disabled={uploading} accept="application/pdf,image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFile(f); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <InlineError error={uploadError ?? save.error} />
      </div>
    </Dialog>
  );
}

function AnnouncementDialog({ announcement: a, onClose }: { announcement: Announcement; onClose: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const describe = useAudienceLabel();
  const publish = useAction(() => api.post(`/announcements/${a.id}/publish`), { invalidate: [['announcements']], success: t('web.announcements.publishedToast'), onSuccess: onClose, toastErrors: true });
  const archive = useAction(() => api.post(`/announcements/${a.id}/archive`), { invalidate: [['announcements']], success: t('web.common.updated'), onSuccess: onClose, toastErrors: true });
  return (
    <Dialog
      open
      onClose={onClose}
      title={lang === 'ur' && a.titleUr ? a.titleUr : a.title}
      wide
      footer={
        <>
          {a.state !== 'archived' && <Button loading={archive.isPending} onClick={() => archive.mutate(undefined)}>{t('web.common.archive')}</Button>}
          {a.state === 'draft' && <Button variant="primary" loading={publish.isPending} onClick={() => publish.mutate(undefined)}>{t('common.publish')}</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <Badge tone={stateTone[a.state] ?? 'neutral'}>{t(`web.status.${a.state}`)}</Badge>
          <span>{t(`web.announcements.categories.${a.category}`)}</span>·<span>{a.createdBy.displayName}</span>·<span>{formatDateTime(a.publishedAt ?? a.createdAt, lang)}</span>
        </div>
        <p className="whitespace-pre-wrap">{a.body}</p>
        {a.bodyUr && <p className="whitespace-pre-wrap rounded-lg bg-sunken px-4 py-3" dir="rtl" lang="ur">{a.bodyUr}</p>}
        {a.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {a.attachments.map((f) => <Button key={f.id} size="sm" icon={<Paperclip size={14} />} onClick={() => downloadFile(f.id)}>{f.name}</Button>)}
          </div>
        )}
        <p className="text-[13px] text-muted">{t('web.announcements.audience')}: {a.audiences.map(describe).join(', ')}{a.recipientCount !== null ? ` · ${t('web.announcements.recipientCount', { count: a.recipientCount })}` : ''}</p>
      </div>
    </Dialog>
  );
}
