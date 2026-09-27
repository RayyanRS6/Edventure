import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Experience } from '@edventure/contracts';
import { useApi } from '@/lib/queries';
import { useSession } from '@/lib/session';
import type { IconName } from '@/ui/controls';
import { colors, fontFamily } from '@/ui/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bottom tabs for one experience (plan §4 navigation). Other experiences are redirected away. */
export function RoleTabs({ experience, tabs }: { experience: Experience; tabs: Array<{ name: string; labelKey: string; icon: IconName }> }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const unread = useApi<{ unreadCount: number }>(['notifications', 'unread'], session.status === 'signedIn' ? '/notifications' : null, { limit: 1, unreadOnly: 'true' }, { refetchInterval: 60_000 });
  if (session.status !== 'signedIn' || session.next !== 'ready') return <Redirect href="/" />;
  if (session.experience !== experience) return <Redirect href="/" />;
  const font = (i18n.language === 'ur' ? fontFamily.urdu : fontFamily.latin)['600'];
  const count = unread.data?.unreadCount ?? 0;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand.lime,
        tabBarInactiveTintColor: '#ABA9B9',
        tabBarLabelStyle: { fontFamily: font, fontSize: i18n.language === 'ur' ? 10 : 11, marginTop: 2 },
        tabBarStyle: { backgroundColor: colors.brand.night, borderTopWidth: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: 62 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 8) },
        headerTitleStyle: { fontFamily: font, fontSize: 17, color: colors.ink },
        headerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.labelKey),
            tabBarLabel: tab.name === 'notifications' ? t('mobile.notifications.tab') : t(tab.labelKey),
            headerShown: tab.name !== 'home' && tab.name !== 'today',
            tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} color={color} size={size} />,
            tabBarBadge: tab.name === 'notifications' && count > 0 ? (count > 99 ? '99+' : count) : undefined,
          }}
        />
      ))}
    </Tabs>
  );
}
