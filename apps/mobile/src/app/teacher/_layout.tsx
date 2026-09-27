import { RoleTabs } from '@/features/role-tabs';

export default function TeacherTabs() {
  return (
    <RoleTabs
      experience="teacher"
      tabs={[
        { name: 'today', labelKey: 'nav.today', icon: 'today-outline' },
        { name: 'classes', labelKey: 'nav.classes', icon: 'people-outline' },
        { name: 'work', labelKey: 'nav.work', icon: 'clipboard-outline' },
        { name: 'notifications', labelKey: 'nav.notifications', icon: 'notifications-outline' },
        { name: 'profile', labelKey: 'nav.profile', icon: 'person-circle-outline' },
      ]}
    />
  );
}
