import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { TeachingGroup, z } from '@edventure/contracts';
import type { rollCallTask } from '@edventure/contracts';
import { todayLocal } from '@/lib/format';
import { useApi, useLocalized } from '@/lib/queries';
import { Badge, Card, Divider, ListRow } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, Screen, SectionTitle } from '@/ui/screen';
import { spacing } from '@/ui/theme';

/** Sections this teacher takes roll call for (class teacher or cover) and the groups they teach. */
export default function TeacherClasses() {
  const { t } = useTranslation();
  const localized = useLocalized();
  const router = useRouter();
  const today = todayLocal();
  const tasks = useApi<{ items: z.infer<typeof rollCallTask>[] }>(['roll-call-tasks', today], '/attendance/roll-call-tasks', { date: today });
  const groups = useApi<{ items: TeachingGroup[] }>(['teaching-groups', 'mine'], '/teaching-groups', { mine: 'true' });
  const refresh = () => {
    void tasks.refetch();
    void groups.refetch();
  };
  if (tasks.isLoading || groups.isLoading) return <Loading />;
  if (groups.error) return <ErrorState error={groups.error} onRetry={refresh} />;

  return (
    <Screen refreshing={tasks.isRefetching || groups.isRefetching} onRefresh={refresh}>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        <ListRow icon="calendar-outline" title={t('mobile.teacher.myTimetable')} onPress={() => router.push('/timetable')} />
        <Divider />
        <ListRow icon="calendar-number-outline" title={t('exams.dateSheet')} onPress={() => router.push('/date-sheet')} />
      </Card>

      {(tasks.data?.items.length ?? 0) > 0 && (
        <>
          <SectionTitle>{t('attendance.rollCall')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {tasks.data!.items.map((r, i) => (
              <View key={r.sectionId}>
                {i > 0 && <Divider />}
                <ListRow
                  icon="checkbox-outline"
                  title={`${r.gradeName} ${r.sectionName}`}
                  subtitle={r.delegated ? t('mobile.rollCall.delegated') : t('roles.classTeacher')}
                  trailing={<Badge tone={r.state === 'submitted' ? 'success' : 'warning'} label={t(`mobile.status.${r.state}`)} />}
                  onPress={() => router.push(`/roll-call/${r.sectionId}?date=${today}`)}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionTitle>{t('mobile.teacher.myGroups')}</SectionTitle>
      {(groups.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="people-outline" title={t('mobile.teacher.noGroups')} />
      ) : (
        <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
          {groups.data!.items.map((g, i) => (
            <View key={g.id}>
              {i > 0 && <Divider />}
              <ListRow
                icon="people-outline"
                title={g.name}
                subtitle={`${localized(g.subjectName, g.subjectNameUr)} · ${g.gradeName}${g.sectionName ? ` ${g.sectionName}` : ''} · ${t('mobile.teacher.students', { count: g.memberCount })}`}
                onPress={() => router.push(`/group/${g.id}`)}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
