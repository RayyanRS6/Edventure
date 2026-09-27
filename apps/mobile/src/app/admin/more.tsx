import { useTranslation } from 'react-i18next';
import { LinkCard, ProfileScreen } from '@/features/profile';
import { SectionTitle } from '@/ui/screen';

/** Everything else an administrator does from the phone, plus their account settings. */
export default function AdminMore() {
  const { t } = useTranslation();
  return (
    <ProfileScreen>
      <SectionTitle>{t('nav.more')}</SectionTitle>
      <LinkCard
        links={[
          { title: t('mobile.admin.attendanceToday'), icon: 'checkbox-outline', href: '/attendance-overview' },
          { title: t('nav.announcements'), icon: 'megaphone-outline', href: '/announcements' },
          { title: t('mobile.admin.feeReminders'), icon: 'notifications-outline', href: '/fee-reminders' },
          { title: t('exams.dateSheet'), icon: 'calendar-number-outline', href: '/date-sheet' },
        ]}
      />
    </ProfileScreen>
  );
}
