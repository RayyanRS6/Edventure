import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AcademicYear, Announcement, AudienceSpec, ClassOffering, Role, TeachingGroup } from '@edventure/contracts';
import { announcementCategories, roles } from '@edventure/contracts';
import { api, ApiError } from '@/lib/api';
import { useAction, useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, Card, ChoiceField, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';

type Target = 'everyone' | 'role' | 'class_offering' | 'section' | 'teaching_group';

/**
 * Compose a notice. Administrators can address the school, a role, a class or a section; teachers
 * address the groups they teach. Urdu text is optional and never machine-translated.
 */
export default function NewAnnouncement() {
  const { t } = useTranslation();
  const router = useRouter();
  const { experience } = useSession();
  const admin = experience === 'admin';
  const years = useApi<{ items: AcademicYear[] }>(['academic-years'], admin ? '/academic-years' : null);
  const year = years.data?.items.find((y) => y.status === 'active');
  const classes = useApi<{ items: ClassOffering[] }>(['classes', year?.id], admin && year ? '/classes' : null, year ? { academicYearId: year.id } : undefined);
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', 'mine'], admin ? null : '/teaching-groups', { mine: 'true' });
  const [target, setTarget] = useState<Target>(admin ? 'everyone' : 'teaching_group');
  const [ref, setRef] = useState('');
  const [f, setF] = useState({ title: '', titleUr: '', body: '', bodyUr: '', category: 'general' });

  const audience = (): AudienceSpec => {
    switch (target) {
      case 'role':
        return { target, role: ref as Role };
      case 'class_offering':
        return { target, classOfferingId: ref };
      case 'section':
        return { target, sectionId: ref };
      case 'teaching_group':
        return { target, teachingGroupId: ref };
      default:
        return { target: 'everyone' };
    }
  };
  const create = useAction(
    () => api.post<Announcement>('/announcements', { ...f, titleUr: f.titleUr || null, bodyUr: f.bodyUr || null, audiences: [audience()], publish: true }),
    { invalidate: [['announcements']], success: t('mobile.announcements.published'), onSuccess: () => router.back() },
  );
  const field = (name: string) => (create.error instanceof ApiError ? create.error.fieldErrors?.[name]?.[0] : undefined);
  const targetOptions: Array<{ value: Target; label: string }> = admin
    ? (['everyone', 'role', 'class_offering', 'section'] as const).map((v) => ({ value: v, label: t(`mobile.announcements.targets.${v}`) }))
    : [{ value: 'teaching_group', label: t('mobile.announcements.targets.teaching_group') }];
  const refOptions =
    target === 'role'
      ? roles.map((r) => ({ value: r, label: t(`mobile.announcements.roles.${r}`) }))
      : target === 'class_offering'
        ? (classes.data?.items ?? []).map((c) => ({ value: c.id, label: c.gradeName }))
        : target === 'section'
          ? (classes.data?.items ?? []).flatMap((c) => c.sections.filter((s) => !s.archived).map((s) => ({ value: s.id, label: `${c.gradeName} ${s.name}` })))
          : target === 'teaching_group'
            ? (groups.data?.items ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.subjectName}` }))
            : [];
  const ready = f.title.trim() && f.body.trim() && (target === 'everyone' || ref);

  return (
    <Screen footer={<Button title={t('common.publish')} icon="send-outline" loading={create.isPending} disabled={!ready} onPress={() => create.mutate(undefined)} />}>
      <Stack.Screen options={{ title: t('mobile.announcements.new') }} />
      <Card>
        <ChoiceField<Target> label={t('mobile.announcements.sendTo')} value={target} onChange={(v) => { setTarget(v); setRef(''); }} options={targetOptions} />
        {target !== 'everyone' && <ChoiceField label={t(`mobile.announcements.targets.${target}`)} value={ref} onChange={setRef} placeholder={t('mobile.common.choose')} options={refOptions} />}
        <ChoiceField label={t('mobile.announcements.category')} value={f.category} onChange={(v) => setF({ ...f, category: v })} options={announcementCategories.map((c) => ({ value: c, label: t(`mobile.announcements.categories.${c}`) }))} />
      </Card>
      <Card>
        <TextField label={t('mobile.work.title')} value={f.title} onChangeText={(v) => setF({ ...f, title: v })} error={field('title')} />
        <TextField label={t('mobile.announcements.message')} value={f.body} onChangeText={(v) => setF({ ...f, body: v })} multiline error={field('body')} />
      </Card>
      <Card title={t('mobile.announcements.urdu')}>
        <TextField label={t('mobile.announcements.titleUr')} value={f.titleUr} onChangeText={(v) => setF({ ...f, titleUr: v })} textAlign="right" />
        <TextField label={t('mobile.announcements.messageUr')} value={f.bodyUr} onChangeText={(v) => setF({ ...f, bodyUr: v })} multiline textAlign="right" />
      </Card>
      <InlineError error={create.error && !field('title') && !field('body') ? create.error : null} />
    </Screen>
  );
}
