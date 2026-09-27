import { useTranslation } from 'react-i18next';
import { LinkCard, ProfileScreen } from '@/features/profile';

export default function TeacherProfile() {
  const { t } = useTranslation();
  return (
    <ProfileScreen>
      <LinkCard
        links={[
          { title: t('nav.timetable'), icon: 'calendar-outline', href: '/timetable' },
          { title: t('nav.leave'), icon: 'airplane-outline', href: '/leave' },
          { title: t('nav.announcements'), icon: 'megaphone-outline', href: '/announcements' },
        ]}
      />
    </ProfileScreen>
  );
}
