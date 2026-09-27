import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { AdminDashboard } from '@edventure/contracts';
import { HomeHero } from '@/features/home-hero';
import { formatDate, formatDateTime, formatMoneyAmount, formatPercent } from '@/lib/format';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Card, Divider, ListRow, Row, Stat } from '@/ui/controls';
import { ErrorState, Loading, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

/** Action links handled in the app; the rest (imports, bank matching, exam review) belong to the website. */
const mobileRoutes: Partial<Record<AdminDashboard['actions'][number]['kind'], string>> = {
  roll_call_missing: '/attendance-overview',
  leave_pending: '/admin/approvals',
  results_draft: '/admin/approvals?tab=results',
  provisioning_failed: '/admin/people',
};

export default function AdminHome() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const q = useApi<AdminDashboard>(['dashboard', 'admin'], '/dashboards/admin');
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const d = q.data;
  const m = d.metrics;
  const actions = d.actions.filter((a) => a.count > 0);

  return (
    <Screen safeTop refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <HomeHero
        role={t('roles.school_admin')}
        title={t('nav.dashboard')}
        subtitle={`${formatDate(d.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}${d.academicYear ? ` · ${d.academicYear.name}` : ''}`}
        action={t('dashboard.pendingApprovals')}
        onAction={() => router.push('/admin/approvals')}
        icon="checkmark-done-outline"
      />
      <View style={{ gap: spacing[3] }}>
        <Row style={{ alignItems: 'stretch' }} gap={spacing[3]}>
          <Stat style={{ minWidth: 0 }} feature="lime" label={t('dashboard.enrollment')} value={String(m.enrollment.active)} hint={t('mobile.admin.teachers', { count: m.enrollment.teachers })} />
          <Stat
            style={{ minWidth: 0 }}
            feature="lilac"
            label={t('dashboard.attendanceToday')}
            value={!m.attendanceToday.instructional ? '—' : m.attendanceToday.rate ? formatPercent(m.attendanceToday.rate) : t('dashboard.notRecorded')}
            hint={!m.attendanceToday.instructional ? t('mobile.schedule.noSchool') : m.attendanceToday.completeness ? t('mobile.admin.recorded', { value: formatPercent(m.attendanceToday.completeness, 0) }) : undefined}
          />
        </Row>
        <Row style={{ alignItems: 'stretch' }} gap={spacing[3]}>
          <Stat style={{ minWidth: 0 }} feature="apricot" label={t('dashboard.outstandingFees')} prefix={m.outstandingFees.currency} value={formatMoneyAmount(m.outstandingFees.amount)} tone={Number(m.outstandingFees.overdue) > 0 ? 'danger' : undefined} hint={t('mobile.admin.overdueStudents', { count: m.outstandingFees.studentsOverdue })} />
          <Stat style={{ minWidth: 0 }} feature="pink" label={t('dashboard.pendingApprovals')} value={String(m.pendingApprovals.total)} hint={t('mobile.admin.leaveRequests', { count: m.pendingApprovals.leave })} />
        </Row>
      </View>

      <SectionTitle>{t('dashboard.actionList')}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {actions.length === 0 ? (
          <Text tone="success" style={{ paddingVertical: spacing[3] }}>
            {t('dashboard.nothingPending')}
          </Text>
        ) : (
          actions.map((a, i) => {
            const route = mobileRoutes[a.kind];
            return (
              <View key={a.kind}>
                {i > 0 && <Divider />}
                <ListRow
                  title={t(`mobile.tasks.${a.kind}`)}
                  subtitle={route ? undefined : t('mobile.admin.onWebsite')}
                  trailing={<Badge tone="warning" label={String(a.count)} />}
                  onPress={route ? () => router.push(route as never) : undefined}
                />
              </View>
            );
          })
        )}
      </Card>

      {d.upcomingExams.length > 0 && (
        <>
          <SectionTitle>{t('dashboard.upcomingExams')}</SectionTitle>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.upcomingExams.slice(0, 6).map((e, i) => (
              <View key={`${e.date}-${e.subjectName}-${e.gradeName}`}>
                {i > 0 && <Divider />}
                <ListRow title={`${e.subjectName} · ${e.gradeName}${e.sectionName ? ` ${e.sectionName}` : ''}`} subtitle={`${formatDate(e.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.startTime}`} />
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
