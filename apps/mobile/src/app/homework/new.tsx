import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileInfo, HomeworkDetail, TeachingGroup } from '@edventure/contracts';
import { submissionPolicies } from '@edventure/contracts';
import { api, ApiError } from '@/lib/api';
import { pickDocument, uploadFile } from '@/lib/files';
import { addDays, formatDate, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/queries';
import { Button, Card, ChoiceField, ListRow, Row, Segmented, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

export default function NewHomework() {
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', 'mine'], '/teaching-groups', { mine: 'true' });
  const today = todayLocal();
  const [f, setF] = useState({
    teachingGroupId: groupId ?? '',
    title: '',
    instructions: '',
    dueDate: addDays(today, 2),
    submissionPolicy: 'optional' as (typeof submissionPolicies)[number],
    maxScore: '',
  });
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const create = useAction(
    (publish: boolean) =>
      api.post<HomeworkDetail>('/homework', {
        teachingGroupId: f.teachingGroupId,
        title: f.title,
        instructions: f.instructions || null,
        dueDate: f.dueDate,
        submissionPolicy: f.submissionPolicy,
        maxScore: f.maxScore || null,
        attachmentFileIds: files.map((x) => x.id),
        publish,
      }),
    { invalidate: [['homework']], success: t('mobile.common.saved'), onSuccess: (h) => router.replace(`/homework/${h.id}`) },
  );
  const field = (name: string) => (create.error instanceof ApiError ? create.error.fieldErrors?.[name]?.[0] : undefined);
  const attach = async () => {
    setUploadError(null);
    const file = await pickDocument();
    if (!file) return;
    setUploading(true);
    try {
      const info = await uploadFile(file, 'homework_attachment');
      setFiles((x) => [...x, info]);
    } catch (e) {
      setUploadError(e);
    } finally {
      setUploading(false);
    }
  };
  const ready = f.teachingGroupId && f.title.trim() && !uploading;

  return (
    <Screen
      footer={
        <Row>
          <Button variant="secondary" title={t('mobile.work.saveDraft')} loading={create.isPending && create.variables === false} disabled={!ready} onPress={() => create.mutate(false)} style={{ flex: 1 }} />
          <Button title={t('common.publish')} loading={create.isPending && create.variables === true} disabled={!ready} onPress={() => create.mutate(true)} style={{ flex: 1 }} />
        </Row>
      }
    >
      <Stack.Screen options={{ title: t('mobile.work.newHomework') }} />
      <Card>
        <ChoiceField label={t('mobile.work.group')} value={f.teachingGroupId} onChange={(v) => setF({ ...f, teachingGroupId: v })} placeholder={t('mobile.common.choose')} options={(groups.data?.items ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.subjectName}` }))} />
        <TextField label={t('mobile.work.title')} value={f.title} onChangeText={(v) => setF({ ...f, title: v })} error={field('title')} />
        <TextField label={t('mobile.work.instructions')} value={f.instructions} onChangeText={(v) => setF({ ...f, instructions: v })} multiline />
        <ChoiceField
          label={t('fees.dueDate')}
          value={f.dueDate}
          onChange={(v) => setF({ ...f, dueDate: v })}
          options={Array.from({ length: 45 }, (_, i) => addDays(today, i)).map((d) => ({ value: d, label: formatDate(d, lang, { weekday: 'short', day: 'numeric', month: 'short' }) }))}
        />
        <Text variant="small" weight="500" tone="soft">
          {t('mobile.work.submission')}
        </Text>
        <Segmented
          accessibilityLabel={t('mobile.work.submission')}
          value={f.submissionPolicy}
          onChange={(v) => setF({ ...f, submissionPolicy: v })}
          options={submissionPolicies.map((p) => ({ value: p, label: t(`mobile.work.policyShort.${p}`) }))}
        />
        <TextField label={t('mobile.work.maxScore')} value={f.maxScore} onChangeText={(v) => setF({ ...f, maxScore: v.trim() })} keyboardType="decimal-pad" hint={t('mobile.common.optional')} error={field('maxScore')} />
      </Card>
      <Card title={t('homework.attachments')} style={{ gap: spacing[2] }}>
        {files.map((x) => (
          <ListRow key={x.id} icon="document-attach-outline" title={x.name} latinTitle trailing={<Button small variant="ghost" title={t('common.delete')} onPress={() => setFiles((s) => s.filter((y) => y.id !== x.id))} />} />
        ))}
        {files.length < 5 && <Button variant="secondary" icon="attach-outline" title={t('mobile.homework.attach')} loading={uploading} onPress={() => void attach()} />}
        <InlineError error={uploadError} />
      </Card>
      <InlineError error={create.error && !field('title') && !field('maxScore') ? create.error : null} />
    </Screen>
  );
}
