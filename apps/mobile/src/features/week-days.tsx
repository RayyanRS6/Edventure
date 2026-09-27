import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { DaySchedule } from '@edventure/contracts';
import { addDays, formatDate, isoWeekday, todayLocal } from '@/lib/format';
import { useCachedApi, useLang } from '@/lib/queries';
import { DayLessons } from '@/features/schedule';
import { ErrorState, LastSynced, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, mirrorInRtl, radius, spacing } from '@/ui/theme';

/**
 * The viewer's own timetable, one day at a time, including one-day changes (cancellations, cover,
 * room changes). Loaded days are kept in the encrypted offline cache.
 */
export function WeekDays({ showClass }: { showClass?: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  const today = todayLocal();
  const monday = addDays(today, 1 - isoWeekday(today));
  const [weekStart, setWeekStart] = useState(monday);
  const [date, setDate] = useState(today);
  const days = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  const q = useCachedApi<DaySchedule>(`schedule:day:${date}`, '/schedule/day', { date });

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={styles.weekNav}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.schedule.previousWeek')} onPress={() => { const w = addDays(weekStart, -7); setWeekStart(w); setDate(w); }} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accent[700]} style={mirrorInRtl} />
        </Pressable>
        <Text weight="600">{formatDate(weekStart, lang, { day: 'numeric', month: 'short' })} – {formatDate(addDays(weekStart, 5), lang, { day: 'numeric', month: 'short' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('mobile.schedule.nextWeek')} onPress={() => { const w = addDays(weekStart, 7); setWeekStart(w); setDate(w); }} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.accent[700]} style={mirrorInRtl} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
        {days.map((d) => {
          const on = d === date;
          return (
            <Pressable key={d} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setDate(d)} style={[styles.day, on && styles.dayOn, d === today && !on && styles.dayToday]}>
              <Text variant="caption" style={{ color: on ? '#FFFFFF' : colors.muted }}>
                {formatDate(d, lang, { weekday: 'short' })}
              </Text>
              <Text latin weight="600" style={{ color: on ? '#FFFFFF' : colors.ink }}>
                {Number(d.slice(8))}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {q.isLoading ? <Loading /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : q.data ? <DayLessons day={q.data} showClass={showClass} /> : null}
      <LastSynced at={q.fromCache ? q.savedAt : null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  day: { width: 56, paddingVertical: spacing[2], borderRadius: radius.lg, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  dayOn: { backgroundColor: colors.accent[600], borderColor: colors.accent[600] },
  dayToday: { borderColor: colors.accent[500] },
});
