import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts } from '@expo-google-fonts/dm-sans';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_500Medium, NotoNastaliqUrdu_600SemiBold, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import { focusManager, onlineManager, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationResponse } from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AppLocale } from '@edventure/i18n';
import { ApiError } from '@/lib/api';
import { ensureDirection, initI18n, storedLocale } from '@/lib/i18n';
import { routeForLink } from '@/lib/links';
import { loadNotifications } from '@/lib/notifications-runtime';
import { SessionProvider, useSession } from '@/lib/session';
import { Button } from '@/ui/controls';
import { EmptyState, ToastProvider } from '@/ui/screen';
import { colors, fontFamily } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

/** Detail screens reachable only while signed in (titles are set by each screen). */
const signedInRoutes = [
  'announcements',
  'announcement/[id]',
  'announcement/new',
  'homework/[id]',
  'homework/new',
  'quiz/[id]',
  'quiz/new',
  'attempt/[id]',
  'leave/index',
  'leave/new',
  'results',
  'result/[id]',
  'fees',
  'fee-reminders',
  'attendance',
  'attendance-overview',
  'date-sheet',
  'timetable',
  'roll-call/[sectionId]',
  'marks/[paperId]',
  'group/[id]',
  'person/student/[id]',
  'person/teacher/[id]',
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Client errors (4xx) will not fix themselves; retry only network and server failures.
      retry: (count, e) => count < 2 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
    },
  },
});

// React Query follows the device's connectivity and app focus.
onlineManager.setEventListener((setOnline) => {
  const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected !== false));
  return () => sub.remove();
});
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
  return () => sub.remove();
});

export default function RootLayout() {
  const [locale, setLocale] = useState<AppLocale | null>(null);
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    NotoNastaliqUrdu_400Regular,
    NotoNastaliqUrdu_500Medium,
    NotoNastaliqUrdu_600SemiBold,
    NotoNastaliqUrdu_700Bold,
  });

  useEffect(() => {
    void (async () => {
      const l = await storedLocale();
      initI18n(l);
      if (!(await ensureDirection(l))) setLocale(l);
    })();
  }, []);

  if (!locale || !fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <StatusBar style="dark" />
            <Gate />
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { t, i18n } = useTranslation();
  const { status, experience, outdated, reload } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const handled = useRef<string | null>(null);
  const net = Network.useNetworkState();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  const openNotification = useCallback((response: NotificationResponse | null) => {
    const id = response?.notification.request.identifier;
    if (!response || !id || handled.current === id || status !== 'signedIn' || !experience) return;
    handled.current = id;
    const link = response.notification.request.content.data?.['link'] as string | undefined;
    router.push(routeForLink(link, experience) as never);
  }, [status, experience, router]);

  // Load the native push module only in a custom build. Expo Go still has the in-app inbox.
  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void loadNotifications().then(async (notifications) => {
      if (!notifications || !active) return;
      subscription = notifications.addNotificationResponseReceivedListener(openNotification);
      const last = await notifications.getLastNotificationResponseAsync();
      if (active) openNotification(last);
    }).catch(() => undefined);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [openNotification]);

  // On reconnection, refresh permissions and data before anything is submitted.
  useEffect(() => {
    const offline = net.isConnected === false;
    if (wasOffline.current && !offline && status === 'signedIn') {
      void reload().catch(() => undefined);
      void qc.invalidateQueries();
    }
    wasOffline.current = offline;
  }, [net.isConnected, status, reload, qc]);

  if (outdated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.canvas }}>
        <EmptyState icon="cloud-download-outline" title={t('errors.clientOutdated')} hint={t('mobile.update.hint')} action={<Button title={t('common.retry')} variant="secondary" onPress={() => void reload()} />} />
      </View>
    );
  }

  const headerFont = (i18n.language === 'ur' ? fontFamily.urdu : fontFamily.latin)['600'];
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: headerFont, fontSize: 17, color: colors.ink },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.accent[700],
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="change-password" options={{ title: t('auth.changePassword') }} />
        <Stack.Screen name="mfa" options={{ title: t('auth.mfaTitle') }} />
        <Stack.Screen name="student" options={{ headerShown: false }} />
        <Stack.Screen name="teacher" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        {signedInRoutes.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
