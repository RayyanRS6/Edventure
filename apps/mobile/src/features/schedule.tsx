import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import type { DayLesson, DaySchedule } from '@edventure/contracts';
import { useLocalized } from '@/lib/queries';
import { Badge, Card } from '@/ui/controls';
import { EmptyState, Notice } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

const statusTone = { scheduled: 'neutral', cancelled: 'danger', substituted: 'warning', room_changed: 'info' } as const;

export function LessonRow({ lesson, showClass }: { lesson: DayLesson; showClass?: boolean }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const cancelled = lesson.status === 'cancelled';
  return (
    <View style={[styles.lesson, cancelled && { opacity: 0.6 }]}>
      <View style={styles.time}>
        <Text latin variant="small" weight="600">
          {lesson.startTime}
        </Text>
        <Text latin variant="caption" tone="muted">
          {lesson.endTime}
        </Text>
      </View>
      <View style={styles.bar} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="600" style={cancelled ? { textDecorationLine: 'line-through' } : undefined}>
          {localized(lesson.subjectName, lesson.subjectNameUr)}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={2}>
          {[showClass ? `${lesson.gradeName}${lesson.sectionName ? ` ${lesson.sectionName}` : ''}` : lesson.teacherName, lesson.roomName].filter(Boolean).join(' · ')}
        </Text>
        {lesson.status !== 'scheduled' && <Badge tone={statusTone[lesson.status]} label={t(`mobile.lesson.${lesson.status}`)} />}
        {lesson.asSubstitute && <Badge tone="info" label={t('mobile.lesson.cover')} />}
        {lesson.note ? (
          <Text variant="caption" tone="soft">
            {lesson.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function DayLessons({ day, showClass, compactEmpty = false }: { day: DaySchedule; showClass?: boolean; compactEmpty?: boolean }) {
  const { t } = useTranslation();
  if (!day.instructional) {
    const empty = <EmptyState compact={compactEmpty} icon="sunny-outline" title={t('mobile.schedule.noSchool')} hint={day.calendarNote ?? undefined} />;
    return compactEmpty ? <Card style={{ padding: 0 }}>{empty}</Card> : empty;
  }
  return (
    <View style={{ gap: spacing[2] }}>
      {day.calendarNote ? <Notice text={day.calendarNote} /> : null}
      {day.lessons.length === 0 ? (compactEmpty ? <Card style={{ padding: 0 }}><EmptyState compact icon="calendar-clear-outline" title={t('mobile.schedule.noLessons')} /></Card> : <EmptyState icon="calendar-clear-outline" title={t('mobile.schedule.noLessons')} />) : day.lessons.map((l) => <LessonRow key={`${l.id}-${l.startTime}`} lesson={l} showClass={showClass} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  lesson: { flexDirection: 'row', gap: spacing[4], backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  time: { width: 56, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.md, backgroundColor: colors.accent[50] },
  bar: { width: 4, borderRadius: 2, backgroundColor: colors.brand.lilac },
});
