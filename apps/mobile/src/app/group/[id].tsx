import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { HomeworkSummary, Page, TeachingGroup, z } from '@edventure/contracts';
import type { groupMember } from '@edventure/contracts';
import { formatDate, stateTone } from '@/lib/format';
import { useApi, useCachedApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow } from '@/ui/controls';
import { ErrorState, LastSynced, Loading, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const group = useApi<TeachingGroup>(['teaching-group', id], `/teaching-groups/${id}`);
  const members = useCachedApi<{ items: z.infer<typeof groupMember>[] }>(`roster:group:${id}`, `/teaching-groups/${id}/members`);
  const homework = useApi<Page<HomeworkSummary>>(['homework', 'group', id], '/homework', { teachingGroupId: id, limit: 20 });
  if (group.isLoading) return <Loading />;
  if (group.error || !group.data) return <ErrorState error={group.error} onRetry={() => void group.refetch()} />;
  const g = group.data;

  return (
    <Screen refreshing={members.isRefetching} onRefresh={() => { void members.refetch(); void homework.refetch(); }}>
      <Stack.Screen options={{ title: g.name }} />
      <Card>
        <Text variant="heading">{localized(g.subjectName, g.subjectNameUr)}</Text>
        <Text tone="muted">
          {g.gradeName}
          {g.sectionName ? ` ${g.sectionName}` : ''} · {t('mobile.teacher.students', { count: g.memberCount })}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
          <Button small icon="add" title={t('mobile.work.newHomework')} onPress={() => router.push(`/homework/new?groupId=${g.id}`)} />
          <Button small variant="secondary" icon="add" title={t('mobile.work.newQuiz')} onPress={() => router.push(`/quiz/new?groupId=${g.id}`)} />
        </View>
      </Card>

      <SectionTitle>{t('nav.homework')}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {(homework.data?.items ?? []).map((h, i) => (
          <View key={h.id}>
            {i > 0 && <Divider />}
            <ListRow
              title={localized(h.title, h.titleUr)}
              subtitle={`${t('homework.due', { date: formatDate(h.dueDate, lang) })}${h.completion ? ` · ${t('homework.completion', { done: h.completion.submitted + h.completion.completed, total: h.completion.total })}` : ''}`}
              trailing={<Badge tone={stateTone[h.state] ?? 'neutral'} label={t(`mobile.status.${h.state}`)} />}
              onPress={() => router.push(`/homework/${h.id}`)}
            />
          </View>
        ))}
        {homework.data?.items.length === 0 && <Text tone="muted" style={{ paddingVertical: spacing[3] }}>{t('mobile.homework.none')}</Text>}
      </Card>

      <SectionTitle>{t('mobile.teacher.studentsTitle')}</SectionTitle>
      <LastSynced at={members.fromCache ? members.savedAt : null} />
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {(members.data?.items ?? []).map((m, i) => (
          <View key={m.studentId}>
            {i > 0 && <Divider />}
            <ListRow title={m.displayName} subtitle={m.admissionNumber} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
