import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { z } from '@edventure/contracts';
import type { dailyOverview } from '@edventure/contracts';
import { addDays, formatDate, formatPercent, todayLocal } from '@/lib/format';
import { useApi, useLang } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Row, Stat } from '@/ui/controls';
import { ErrorState, Loading, Notice, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

/** Administrators: today's roll calls across the school; open a section to take or correct it. */
export default function AttendanceOverview() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const [date, setDate] = useState(todayLocal());
  const q = useApi<z.infer<typeof dailyOverview>>(['attendance-overview', date], '/attendance/overview', { date });
  const d = q.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('mobile.admin.attendanceToday') }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Button small variant="ghost" title={t('mobile.attendance.previousDay')} onPress={() => setDate(addDays(date, -1))} />
        <Text weight="600">{formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
        <Button small variant="ghost" title={t('common.today')} disabled={date === todayLocal()} onPress={() => setDate(todayLocal())} />
      </Row>
      {q.isLoading ? (
        <Loading />
      ) : q.error || !d ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !d.instructional ? (
        <Notice text={t('mobile.schedule.noSchool')} />
      ) : (
        <>
          <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={spacing[3]}>
            <Stat label={t('attendance.rate')} value={d.overall.rate ? formatPercent(d.overall.rate) : t('common.noData')} hint={t('attendance.summary', d.overall)} />
            <Stat label={t('attendance.completeness')} value={d.overall.completeness ? formatPercent(d.overall.completeness, 0) : t('common.noData')} />
          </Row>
          <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
            {d.sections.map((s, i) => (
              <View key={s.sectionId}>
                {i > 0 && <Divider />}
                <ListRow
                  title={`${s.gradeName} ${s.sectionName}`}
                  subtitle={s.state === 'not_started' ? undefined : t('attendance.summary', s)}
                  trailing={<Badge tone={s.state === 'submitted' ? 'success' : s.state === 'draft' ? 'warning' : 'danger'} label={t(`mobile.status.${s.state}`)} />}
                  onPress={() => router.push(`/roll-call/${s.sectionId}?date=${date}`)}
                />
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
