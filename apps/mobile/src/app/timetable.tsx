import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { WeekDays } from '@/features/week-days';

/** A teacher's own timetable (students have it as a tab). */
export default function TeacherTimetable() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('nav.timetable') }} />
      <WeekDays showClass />
    </>
  );
}
