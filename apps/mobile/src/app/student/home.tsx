import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { StudentDashboard } from '@edventure/contracts';
import { DayLessons } from '@/features/schedule';
import { HomeHero } from '@/features/home-hero';
import { formatDate, formatDateTime, formatMoney, formatMoneyAmount, formatPercent, stateTone } from '@/lib/format';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { useMe } from '@/lib/session';
import { Badge, Card, Divider, ListRow, Row, Stat } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, Notice, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

export default function StudentHome() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const me = useMe();
  const q = useApi<StudentDashboard>(['dashboard', 'student'], '/dashboards/student');
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;

  return (
    <Screen safeTop refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <HomeHero
        role={t('roles.student')}
        title={t('dashboard.greeting', { name: localized(me.displayName, me.displayNameUr) })}
        subtitle={formatDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
        action={t('nav.timetable')}
        onAction={() => router.push('/student/timetable')}
        icon="calendar-outline"
      />
      {d.alerts.suspended && <Notice tone="warning" text={t('mobile.student.suspended')} />}

      <SectionTitle>{t('dashboard.todaysLessons')}</SectionTitle>
      <DayLessons day={d.today} compactEmpty />

      <SectionTitle>{t('dashboard.upcomingWork')}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {d.upcomingHomework.length === 0 && d.openQuizzes.length === 0 ? (
          <EmptyState compact icon="checkmark-circle-outline" title={t('dashboard.nothingPending')} />
        ) : (
          <>
            {d.upcomingHomework.map((h, i) => (
              <View key={h.id}>
                {i > 0 && <Divider />}
                <ListRow
                  icon="document-text-outline"
                  title={h.title}
                  subtitle={`${h.subjectName} · ${t('homework.due', { date: formatDate(h.dueDate, lang) })}`}
                  trailing={<Badge tone={stateTone[h.status] ?? 'neutral'} label={t(`mobile.status.${h.status}`)} />}
                  onPress={() => router.push(`/homework/${h.id}`)}
                />
              </View>
            ))}
            {d.openQuizzes.map((qz) => (
              <View key={qz.id}>
                <Divider />
                <ListRow
                  icon="help-circle-outline"
                  title={qz.title}
                  subtitle={`${qz.subjectName}${qz.availableUntil ? ` · ${t('mobile.quiz.openUntil', { time: formatDateTime(qz.availableUntil, lang) })}` : ''}`}
                  onPress={() => router.push(`/quiz/${qz.id}`)}
                />
              </View>
            ))}
          </>
        )}
      </Card>

      {d.upcomingExams.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.upcomingExams')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.upcomingExams.map((e, i) => (
              <View key={`${e.date}-${e.subjectName}`}>
                {i > 0 && <Divider />}
                <ListRow icon="school-outline" title={e.subjectName} subtitle={`${formatDate(e.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.startTime} · ${e.examCycleName}`} />
              </View>
            ))}
            <Divider />
            <ListRow icon="calendar-number-outline" title={t('exams.dateSheet')} onPress={() => router.push('/date-sheet')} />
          </Card>
        </>
      )}

      <Row style={{ alignItems: 'stretch' }} gap={spacing[3]}>
        <Stat
          style={{ minWidth: 0 }}
          feature="lime"
          label={t('attendance.rate')}
          value={d.attendance?.rate ? formatPercent(d.attendance.rate) : t('common.noData')}
          hint={d.attendance ? t('attendance.summary', d.attendance) : undefined}
        />
        <Stat
          style={{ minWidth: 0 }}
          feature="apricot"
          label={t('fees.balance')}
          prefix={d.fees.currency}
          value={formatMoneyAmount(d.fees.balance)}
          tone={Number(d.fees.overdue) > 0 ? 'danger' : undefined}
          hint={Number(d.fees.overdue) > 0 ? `${t('fees.overdue')}: ${formatMoney(d.fees.overdue, d.fees.currency)}` : d.fees.nextDueDate ? `${t('fees.dueDate')}: ${formatDate(d.fees.nextDueDate, lang)}` : undefined}
        />
      </Row>

      {d.latestResult && (
        <Card title={t('dashboard.latestResult')}>
          <ListRow
            icon="ribbon-outline"
            title={d.latestResult.examCycleName}
            subtitle={[formatPercent(d.latestResult.percentage), d.latestResult.gradeLabel].filter(Boolean).join(' · ')}
            trailing={<Badge tone={stateTone[d.latestResult.outcome] ?? 'neutral'} label={t(`exams.${d.latestResult.outcome}`)} />}
            onPress={() => router.push('/results')}
          />
        </Card>
      )}
    </Screen>
  );
}
