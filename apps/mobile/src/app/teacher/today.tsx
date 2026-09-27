import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { TeacherDashboard } from '@edventure/contracts';
import { DayLessons } from '@/features/schedule';
import { HomeHero } from '@/features/home-hero';
import { formatDate, formatDateTime } from '@/lib/format';
import { offlineDrafts } from '@/lib/offline';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { useMe } from '@/lib/session';
import { Badge, Card, Divider, ListRow } from '@/ui/controls';
import { ErrorState, Loading, Notice, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

const taskRoutes: Record<string, string> = { homework_to_review: '/teacher/work', quiz_to_mark: '/teacher/work', marks_to_enter: '/teacher/work' };

export default function TeacherToday() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const me = useMe();
  const q = useApi<TeacherDashboard>(['dashboard', 'teacher'], '/dashboards/teacher');
  const [drafts, setDrafts] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      void offlineDrafts.keys('rollcall:').then(setDrafts).catch(() => setDrafts([]));
    }, []),
  );

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const pendingRollCalls = d.rollCalls.filter((r) => r.state !== 'submitted');

  return (
    <Screen safeTop refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <HomeHero
        role={t('roles.teacher')}
        title={t('dashboard.greeting', { name: localized(me.displayName, me.displayNameUr) })}
        subtitle={formatDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
        action={d.rollCalls.length ? t('dashboard.pendingRollCall') : t('nav.timetable')}
        onAction={() => d.rollCalls[0] ? router.push(`/roll-call/${d.rollCalls[0].sectionId}?date=${d.date}`) : router.push('/timetable')}
        icon="checkbox-outline"
      />

      {drafts.length > 0 && <Notice tone="warning" text={t('mobile.rollCall.draftsWaiting', { count: drafts.length })} />}

      {d.rollCalls.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.pendingRollCall')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.rollCalls.map((r, i) => (
              <View key={r.sectionId}>
                {i > 0 && <Divider />}
                <ListRow
                  icon="checkbox-outline"
                  title={`${r.gradeName} ${r.sectionName}`}
                  subtitle={r.delegated ? t('mobile.rollCall.delegated') : undefined}
                  trailing={<Badge tone={r.state === 'submitted' ? 'success' : drafts.some((k) => k.startsWith(`rollcall:${r.sectionId}:`)) ? 'warning' : 'danger'} label={t(`mobile.status.${r.state}`)} />}
                  onPress={() => router.push(`/roll-call/${r.sectionId}?date=${d.date}`)}
                />
              </View>
            ))}
          </Card>
          {pendingRollCalls.length === 0 && <Text variant="small" tone="success">{t('dashboard.nothingPending')}</Text>}
        </>
      )}

      <SectionTitle>{t('dashboard.todaysLessons')}</SectionTitle>
      <DayLessons day={d.today} showClass />

      {d.tasks.some((x) => x.count > 0) && (
        <>
          <SectionTitle>{t('dashboard.markingTasks')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.tasks
              .filter((x) => x.count > 0)
              .map((task, i) => (
                <View key={task.kind}>
                  {i > 0 && <Divider />}
                  <ListRow icon="create-outline" title={t(`mobile.tasks.${task.kind}`)} trailing={<Badge tone="warning" label={String(task.count)} />} onPress={() => router.push((taskRoutes[task.kind] ?? '/teacher/work') as never)} />
                </View>
              ))}
          </Card>
        </>
      )}

      {d.recentAnnouncements.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.recentAnnouncements')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.recentAnnouncements.map((a, i) => (
              <View key={a.id}>
                {i > 0 && <Divider />}
                <ListRow icon="megaphone-outline" title={localized(a.title, a.titleUr)} subtitle={formatDateTime(a.publishedAt, lang)} onPress={() => router.push(`/announcement/${a.id}`)} />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
