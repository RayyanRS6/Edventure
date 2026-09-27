import { isRunningInExpoGo } from 'expo';

/** Android remote push is unavailable in Expo Go. Keep its native module out of that runtime. */
let notificationsPromise: Promise<typeof import('expo-notifications')> | null = null;

export function loadNotifications() {
  if (isRunningInExpoGo()) return Promise.resolve(null);
  notificationsPromise ??= import('expo-notifications').then((notifications) => {
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });
    return notifications;
  });
  return notificationsPromise;
}
