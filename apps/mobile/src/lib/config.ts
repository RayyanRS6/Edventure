import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

/** A phone can reach the same LAN host as Metro, but its own localhost is not the API server. */
function localMetroHost(hostUri: string | undefined) {
  if (!hostUri) return null;
  try {
    const host = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
    const octets = host.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
    const [first = 0, second = 0] = octets;
    if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)) return host;
  } catch {
    // Tunnel or malformed host: an explicit EXPO_PUBLIC_API_URL is needed.
  }
  return null;
}

const configuredApiUrl = Constants.expoConfig?.extra?.['apiUrl'] as string | null | undefined;
const metroHost = __DEV__ ? localMetroHost(Constants.expoConfig?.hostUri) : null;
const fallbackApiUrl = Platform.OS === 'android' && !Device.isDevice ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

/** The one Edventure API shared with the website. Explicit URLs always win. */
export const apiUrl = (configuredApiUrl || (metroHost ? `http://${metroHost}:4000` : fallbackApiUrl)).replace(/\/$/, '');

export const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

export const easProjectId = Constants.expoConfig?.extra?.['eas']?.projectId as string | undefined;

/**
 * Development storage links point at the API's public URL, which may be `localhost` from the
 * server's point of view; route them through the origin this device actually reaches.
 */
export function reachableUrl(url: string) {
  const match = /^https?:\/\/[^/]+(\/api\/v1\/files\/local\/.+)$/.exec(url);
  return match ? `${apiUrl}${match[1]}` : url;
}
