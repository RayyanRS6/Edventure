import { useTranslation } from 'react-i18next';
import { LinkCard, ProfileScreen } from '@/features/profile';

export default function StudentProfile() {
  const { t } = useTranslation();
  return (
    <ProfileScreen>
      <LinkCard
        links={[
          { title: t('nav.attendance'), icon: 'checkmark-circle-outline', href: '/attendance' },
          { title: t('nav.results'), icon: 'ribbon-outline', href: '/results' },
          { title: t('exams.dateSheet'), icon: 'calendar-number-outline', href: '/date-sheet' },
          { title: t('fees.statement'), icon: 'wallet-outline', href: '/fees' },
          { title: t('nav.leave'), icon: 'airplane-outline', href: '/leave' },
          { title: t('nav.announcements'), icon: 'megaphone-outline', href: '/announcements' },
        ]}
      />
    </ProfileScreen>
  );
}
