import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { FileInfo, HomeworkDetail, z } from '@edventure/contracts';
import type { recipientStatus } from '@edventure/contracts';
import { api } from '@/lib/api';
import { openFile, pickDocument, uploadFile } from '@/lib/files';
import { formatDate, formatDateTime, formatNumber, stateTone } from '@/lib/format';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, Divider, ListRow, Row, Segmented, TextField } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Notice, Screen, SectionTitle, useToast } from '@/ui/screen';
import { Sheet } from '@/ui/sheet';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Recipient = z.infer<typeof recipientStatus>;

export default function HomeworkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const { experience } = useSession();
  const q = useApi<HomeworkDetail>(['homework', id], `/homework/${id}`);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const h = q.data;
  const staff = experience === 'teacher' || experience === 'admin';

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.homework') }} />
      <Card>
        <Text variant="title">{localized(h.title, h.titleUr)}</Text>
        <Text tone="muted">
          {localized(h.subjectName, h.subjectNameUr)} · {h.groupName}
        </Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge tone="info" label={t('homework.due', { date: `${formatDate(h.dueDate, lang)}${h.dueTime ? ` ${h.dueTime}` : ''}` })} />
          {!staff && h.myStatus && <Badge tone={stateTone[h.myStatus] ?? 'neutral'} label={t(`mobile.status.${h.myStatus}`)} />}
          {staff && <Badge tone={stateTone[h.state] ?? 'neutral'} label={t(`mobile.status.${h.state}`)} />}
        </Row>
        {(h.instructions || h.instructionsUr) && <Text>{localized(h.instructions ?? '', h.instructionsUr)}</Text>}
        {h.attachments.map((a) => (
          <ListRow key={a.id} icon="attach-outline" title={a.name} latinTitle onPress={() => void openFile(a.id, a.name)} />
        ))}
        <Text variant="small" tone="muted">
          {t(`mobile.work.policy.${h.submissionPolicy}`)}
          {h.maxScore ? ` · ${t('mobile.homework.maxScore', { max: formatNumber(h.maxScore) })}` : ''}
        </Text>
      </Card>
      {staff ? <StaffView h={h} /> : <StudentView h={h} />}
    </Screen>
  );
}

function StudentView({ h }: { h: HomeworkDetail }) {
  const { t } = useTranslation();
  const lang = useLang();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const submit = useAction(() => api.post(`/homework/${h.id}/submissions`, { body: body || null, attachmentFileIds: files.map((f) => f.id) }), {
    invalidate: [['homework'], ['cached'], ['dashboard']],
    onSuccess: () => {
      setBody('');
      setFiles([]);
      toast(t('mobile.homework.submitted'));
    },
  });
  const attach = async () => {
    setUploadError(null);
    const file = await pickDocument();
    if (!file) return;
    setUploading(true);
    try {
      const info = await uploadFile(file, 'submission');
      setFiles((f) => [...f, info]);
    } catch (e) {
      setUploadError(e);
    } finally {
      setUploading(false);
    }
  };
  const submissions = h.mySubmissions ?? [];
  const canSubmit = h.submissionPolicy !== 'none' && h.state === 'published';

  return (
    <>
      {submissions.length > 0 && (
        <>
          <SectionTitle>{t('mobile.homework.yourWork')}</SectionTitle>
          {submissions.map((s) => (
            <Card key={s.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight="600">{t('mobile.homework.revision', { n: s.revision })}</Text>
                {s.isLate && <Badge tone="warning" label={t('homework.late')} />}
              </Row>
              <Text variant="small" tone="muted">
                {formatDateTime(s.submittedAt, lang)}
              </Text>
              {s.body ? <Text>{s.body}</Text> : null}
              {s.attachments.map((a) => (
                <ListRow key={a.id} icon="attach-outline" title={a.name} latinTitle onPress={() => void openFile(a.id, a.name)} />
              ))}
              {(s.feedback || s.score) && (
                <View style={{ gap: 4 }}>
                  <Divider />
                  <Text weight="600">{t('homework.feedback')}</Text>
                  {s.score ? <Text latin>{t('mobile.homework.score', { score: formatNumber(s.score), max: formatNumber(h.maxScore) })}</Text> : null}
                  {s.feedback ? <Text>{s.feedback}</Text> : null}
                </View>
              )}
            </Card>
          ))}
        </>
      )}
      {canSubmit && (
        <Card title={submissions.length ? t('homework.resubmit') : t('homework.submit')}>
          <TextField label={t('mobile.homework.answer')} value={body} onChangeText={setBody} multiline />
          {files.map((f) => (
            <ListRow key={f.id} icon="document-attach-outline" title={f.name} latinTitle trailing={<Button small variant="ghost" title={t('common.delete')} onPress={() => setFiles((x) => x.filter((y) => y.id !== f.id))} />} />
          ))}
          {files.length < 5 && <Button variant="secondary" icon="attach-outline" title={t('mobile.homework.attach')} loading={uploading} onPress={() => void attach()} />}
          <Text variant="caption" tone="muted">
            {t('mobile.homework.attachHint')}
          </Text>
          <InlineError error={uploadError ?? submit.error} />
          <Button
            title={submissions.length ? t('homework.resubmit') : t('homework.submit')}
            loading={submit.isPending}
            disabled={uploading || (!body.trim() && files.length === 0) || (h.submissionPolicy === 'required' && !body.trim() && files.length === 0)}
            onPress={() => submit.mutate(undefined)}
          />
        </Card>
      )}
      {h.state === 'closed' && <Notice tone="warning" text={t('mobile.homework.closed')} />}
    </>
  );
}

function StaffView({ h }: { h: HomeworkDetail }) {
  const { t } = useTranslation();
  const lang = useLang();
  const recipients = useApi<{ items: Recipient[] }>(['homework-recipients', h.id], `/homework/${h.id}/recipients`);
  const [open, setOpen] = useState<Recipient | null>(null);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState('');
  const invalidate = [['homework-recipients', h.id], ['homework']];
  const publish = useAction(() => api.post(`/homework/${h.id}/publish`), { invalidate, success: t('mobile.homework.publishedToast'), toastErrors: true });
  const close = useAction(() => api.post(`/homework/${h.id}/close`), { invalidate, success: t('mobile.homework.closedToast'), toastErrors: true });
  const sync = useAction(() => api.post<{ added: number }>(`/homework/${h.id}/recipients/sync`), { invalidate, toastErrors: true });
  const giveFeedback = useAction(
    () => api.post(`/submissions/${open!.latestSubmission!.id}/feedback`, { feedback: feedback || null, score: score || null, markCompleted: true }),
    { invalidate, success: t('mobile.homework.feedbackSaved'), onSuccess: () => setOpen(null) },
  );
  const mark = useAction((state: 'completed' | 'pending' | 'excused') => api.post(`/homework/${h.id}/completion`, { studentIds: [open!.studentId], state }), {
    invalidate,
    success: t('mobile.common.saved'),
    onSuccess: () => setOpen(null),
  });
  const items = recipients.data?.items ?? [];
  const done = items.filter((r) => r.completionState !== 'pending').length;

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        {h.state === 'draft' && <Button title={t('common.publish')} icon="send-outline" loading={publish.isPending} onPress={() => publish.mutate(undefined)} />}
        {h.state === 'published' && <Button variant="secondary" title={t('mobile.homework.close')} loading={close.isPending} onPress={() => close.mutate(undefined)} />}
        {h.state === 'published' && <Button variant="ghost" icon="person-add-outline" title={t('mobile.homework.syncMembers')} loading={sync.isPending} onPress={() => sync.mutate(undefined)} />}
      </Row>
      <SectionTitle>{t('homework.completion', { done, total: items.length })}</SectionTitle>
      {recipients.isLoading ? (
        <Loading />
      ) : (
        <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
          {items.map((r, i) => (
            <View key={r.recipientId}>
              {i > 0 && <Divider />}
              <ListRow
                title={r.displayName}
                subtitle={r.latestSubmission ? `${formatDateTime(r.latestSubmission.submittedAt, lang)}${r.latestSubmission.isLate ? ` · ${t('homework.late')}` : ''}` : r.admissionNumber}
                trailing={<Badge tone={stateTone[r.completionState] ?? 'neutral'} label={t(`mobile.status.${r.completionState}`)} />}
                onPress={() => {
                  setFeedback(r.latestSubmission?.feedback ?? '');
                  setScore(r.latestSubmission?.score ?? '');
                  setOpen(r);
                }}
              />
            </View>
          ))}
        </Card>
      )}
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.displayName ?? ''}>
        {open && (
          <>
            {open.latestSubmission ? (
              <>
                <Text variant="small" tone="muted">
                  {t('mobile.homework.revision', { n: open.latestSubmission.revision })} · {formatDateTime(open.latestSubmission.submittedAt, lang)}
                </Text>
                {open.latestSubmission.body ? <Text>{open.latestSubmission.body}</Text> : null}
                {open.latestSubmission.attachments.map((a) => (
                  <ListRow key={a.id} icon="attach-outline" title={a.name} latinTitle onPress={() => void openFile(a.id, a.name)} />
                ))}
                <TextField label={t('homework.feedback')} value={feedback} onChangeText={setFeedback} multiline />
                {h.maxScore && <TextField label={t('mobile.homework.scoreOutOf', { max: formatNumber(h.maxScore) })} value={score} onChangeText={(v) => setScore(v.trim())} keyboardType="decimal-pad" />}
                <InlineError error={giveFeedback.error} />
                <Button title={t('mobile.homework.saveFeedback')} loading={giveFeedback.isPending} onPress={() => giveFeedback.mutate(undefined)} />
              </>
            ) : (
              <Text tone="muted">{t('mobile.homework.noSubmission')}</Text>
            )}
            <Text variant="small" weight="600" tone="muted">
              {t('mobile.homework.setStatus')}
            </Text>
            <Segmented
              accessibilityLabel={t('mobile.homework.setStatus')}
              value={open.completionState === 'submitted' ? null : open.completionState}
              onChange={(v) => mark.mutate(v)}
              options={[
                { value: 'completed', label: t('mobile.status.completed') },
                { value: 'pending', label: t('mobile.status.pending') },
                { value: 'excused', label: t('mobile.status.excused') },
              ]}
            />
            <InlineError error={mark.error} />
          </>
        )}
      </Sheet>
    </>
  );
}
