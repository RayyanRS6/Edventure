import { RoleTabs } from '@/features/role-tabs';

export default function AdminTabs() {
  return (
    <RoleTabs
      experience="admin"
      tabs={[
        { name: 'home', labelKey: 'nav.home', icon: 'grid-outline' },
        { name: 'people', labelKey: 'nav.people', icon: 'people-outline' },
        { name: 'approvals', labelKey: 'nav.approvals', icon: 'checkmark-done-outline' },
        { name: 'notifications', labelKey: 'nav.notifications', icon: 'notifications-outline' },
        { name: 'more', labelKey: 'nav.more', icon: 'ellipsis-horizontal-circle-outline' },
      ]}
    />
  );
}
