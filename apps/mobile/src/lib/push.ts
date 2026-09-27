import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { AppLocale } from '@edventure/i18n';
import { api } from './api';
import { easProjectId } from './config';
import { loadNotifications } from './notifications-runtime';

const PUSH_TOKEN_KEY = 'edventure.push-token';

/**
 * Registers this device for push. Lock-screen text is generic by design (no marks or amounts);
 * details load after the user opens the app. Failures never block sign-in.
 */
export async function registerForPush(locale: AppLocale) {
  try {
    if (!Device.isDevice || !easProjectId) return null;
    const Notifications = await loadNotifications();
    if (!Notifications) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Edventure', importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    await api.post('/devices', { expoPushToken: token, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale });
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPush() {
  const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return;
  await api.delete('/devices', { expoPushToken: token }).catch(() => undefined);
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
}
