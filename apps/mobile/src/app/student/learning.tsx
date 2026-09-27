import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { HomeworkSummary, Page, QuizSummary, z } from '@edventure/contracts';
import type { learningMaterial } from '@edventure/contracts';
import { openFile } from '@/lib/files';
import { formatDate, formatDateTime, stateTone, todayLocal } from '@/lib/format';
import { useApi, useCachedApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Card, Divider, ListRow, Segmented } from '@/ui/controls';
import { EmptyState, ErrorState, LastSynced, Loading, Screen } from '@/ui/screen';
import { spacing } from '@/ui/theme';

type Tab = 'homework' | 'quizzes' | 'materials';

export default function StudentLearning() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('homework');
  return (
    <Screen>
      <Segmented<Tab>
        accessibilityLabel={t('nav.learning')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'homework', label: t('nav.homework') },
          { value: 'quizzes', label: t('nav.quizzes') },
          { value: 'materials', label: t('nav.materials') },
        ]}
      />
      {tab === 'homework' && <HomeworkList />}
      {tab === 'quizzes' && <QuizList />}
      {tab === 'materials' && <MaterialList />}
    </Screen>
  );
}

function HomeworkList() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const q = useCachedApi<Page<HomeworkSummary>>('homework:student', '/homework', { limit: 100 });
  if (q.isLoading) return <Loading />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  const today = todayLocal();
  const open = items.filter((h) => h.myStatus === 'pending');
  const done = items.filter((h) => h.myStatus !== 'pending');
  const row = (h: HomeworkSummary, i: number) => (
    <View key={h.id}>
      {i > 0 && <Divider />}
      <ListRow
        icon="document-text-outline"
        title={localized(h.title, h.titleUr)}
        subtitle={`${localized(h.subjectName, h.subjectNameUr)} · ${t('homework.due', { date: formatDate(h.dueDate, lang) })}`}
        trailing={
          h.myStatus === 'pending' && h.dueDate < today ? (
            <Badge tone="danger" label={t('homework.overdue')} />
          ) : h.myStatus ? (
            <Badge tone={stateTone[h.myStatus] ?? 'neutral'} label={t(`mobile.status.${h.myStatus}`)} />
          ) : undefined
        }
        onPress={() => router.push(`/homework/${h.id}`)}
      />
    </View>
  );
  if (!items.length) return <EmptyState icon="book-outline" title={t('mobile.homework.none')} />;
  return (
    <View style={{ gap: spacing[3] }}>
      <LastSynced at={q.fromCache ? q.savedAt : null} />
      {open.length > 0 && <Card title={t('homework.pending')} style={{ gap: 0 }}>{open.map(row)}</Card>}
      {done.length > 0 && <Card title={t('mobile.homework.done')} style={{ gap: 0 }}>{done.map(row)}</Card>}
    </View>
  );
}

function QuizList() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const q = useApi<Page<QuizSummary>>(['quizzes'], '/quizzes', { limit: 100 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState icon="help-circle-outline" title={t('mobile.quiz.none')} />;
  return (
    <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
      {items.map((qz, i) => (
        <View key={qz.id}>
          {i > 0 && <Divider />}
          <ListRow
            icon="help-circle-outline"
            title={localized(qz.title, qz.titleUr)}
            subtitle={[qz.subjectName, qz.availableUntil ? t('mobile.quiz.openUntil', { time: formatDateTime(qz.availableUntil, lang) }) : null].filter(Boolean).join(' · ')}
            trailing={
              qz.myAttempt ? (
                <Badge tone={stateTone[qz.myAttempt.state] ?? 'neutral'} label={t(`mobile.status.${qz.myAttempt.state}`)} />
              ) : qz.state === 'closed' ? (
                <Badge label={t('mobile.status.closed')} />
              ) : undefined
            }
            onPress={() => router.push(`/quiz/${qz.id}`)}
          />
        </View>
      ))}
    </Card>
  );
}

function MaterialList() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const q = useApi<{ items: z.infer<typeof learningMaterial>[] }>(['materials'], '/materials');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState icon="folder-open-outline" title={t('mobile.materials.none')} />;
  return (
    <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
      {items.map((m, i) => (
        <View key={m.id}>
          {i > 0 && <Divider />}
          <ListRow icon="attach-outline" title={localized(m.title, m.titleUr)} subtitle={`${m.subjectName} · ${m.file.name}`} onPress={() => void openFile(m.file.id, m.file.name)} />
        </View>
      ))}
    </Card>
  );
}
