import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { AttendanceStatus, z } from '@edventure/contracts';
import type { studentAttendanceReport } from '@edventure/contracts';
import { attendanceTone } from '@edventure/design-tokens';
import { addDays, formatDate, formatPercent, todayLocal } from '@/lib/format';
import { useApi, useLang } from '@/lib/queries';
import { useMe } from '@/lib/session';
import { Card, Row, Segmented, Stat } from '@/ui/controls';
import { ErrorState, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, radius, spacing, toneColors } from '@/ui/theme';

type Range = '30' | '90' | '365';

/** The student's own attendance: rate (excused days excluded) and day-by-day record. */
export default function MyAttendance() {
  const { t } = useTranslation();
  const lang = useLang();
  const me = useMe();
  const [range, setRange] = useState<Range>('30');
  const to = todayLocal();
  const from = addDays(to, -Number(range));
  const q = useApi<z.infer<typeof studentAttendanceReport>>(['attendance', me.studentId, range], me.studentId ? `/attendance/students/${me.studentId}/report` : null, { from, to });
  const r = q.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.attendance') }} />
      <Segmented<Range>
        accessibilityLabel={t('mobile.attendance.period')}
        value={range}
        onChange={setRange}
        options={[
          { value: '30', label: t('mobile.attendance.days30') },
          { value: '90', label: t('mobile.attendance.days90') },
          { value: '365', label: t('mobile.attendance.year') },
        ]}
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error || !r ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={spacing[3]}>
            <Stat label={t('attendance.rate')} value={r.summary.rate ? formatPercent(r.summary.rate) : t('common.noData')} />
            <Stat label={t('attendance.absent')} value={String(r.summary.absent)} tone={r.summary.absent ? 'danger' : undefined} />
          </Row>
          <Text variant="small" tone="muted">
            {t('attendance.summary', r.summary)}
          </Text>
          <Card style={{ gap: spacing[2] }}>
            {r.days
              .filter((d) => d.status && d.status !== 'present')
              .map((d) => {
                const tone = toneColors[attendanceTone[d.status as AttendanceStatus]];
                return (
                  <View key={d.date} style={styles.day}>
                    <Text style={{ flex: 1 }}>{formatDate(d.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                      <Text variant="caption" style={{ color: tone.fg }}>
                        {t(`attendance.${d.status}`)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            {!r.days.some((d) => d.status && d.status !== 'present') && <Text tone="muted">{t('mobile.attendance.allPresent')}</Text>}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
