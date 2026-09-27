import { RoleTabs } from '@/features/role-tabs';

export default function StudentTabs() {
  return (
    <RoleTabs
      experience="student"
      tabs={[
        { name: 'home', labelKey: 'nav.home', icon: 'home-outline' },
        { name: 'learning', labelKey: 'nav.learning', icon: 'book-outline' },
        { name: 'timetable', labelKey: 'nav.timetable', icon: 'calendar-outline' },
        { name: 'notifications', labelKey: 'nav.notifications', icon: 'notifications-outline' },
        { name: 'profile', labelKey: 'nav.profile', icon: 'person-circle-outline' },
      ]}
    />
  );
}
