import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { z } from '@edventure/contracts';
import type { dateSheetRow } from '@edventure/contracts';
import { formatDate, formatNumber, todayLocal } from '@/lib/format';
import { useApi, useLang, useLocalized } from '@/lib/queries';
import { useMe } from '@/lib/session';
import { Badge, Card, Row } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';

type Sitting = z.infer<typeof dateSheetRow>;

export default function DateSheet() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const me = useMe();
  const q = useApi<{ items: Sitting[] }>(['date-sheet', me.studentId], '/date-sheet', me.studentId ? { studentId: me.studentId } : undefined);
  const today = todayLocal();
  const upcoming = (q.data?.items ?? []).filter((s) => s.date >= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const byDate = upcoming.reduce<Record<string, Sitting[]>>((acc, s) => ({ ...acc, [s.date]: [...(acc[s.date] ?? []), s] }), {});

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('exams.dateSheet') }} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : upcoming.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title={t('mobile.exams.none')} />
      ) : (
        Object.entries(byDate).map(([date, rows]) => (
          <View key={date} style={{ gap: 8 }}>
            <SectionTitle>{formatDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</SectionTitle>
            {rows.map((s) => (
              <Card key={s.sittingId}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text weight="600">{localized(s.subjectName, s.subjectNameUr)}</Text>
                  {s.status !== 'scheduled' && <Badge tone={s.status === 'cancelled' ? 'danger' : 'warning'} label={t(`mobile.sitting.${s.status}`)} />}
                </Row>
                <Text variant="small" tone="muted">
                  {`${s.startTime}–${s.endTime}`} · {s.gradeName}
                  {s.sectionName ? ` ${s.sectionName}` : ''}
                  {s.roomName ? ` · ${s.roomName}` : ''} · {t('exams.maxMarks')} {formatNumber(s.maxMarks)}
                </Text>
              </Card>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}
