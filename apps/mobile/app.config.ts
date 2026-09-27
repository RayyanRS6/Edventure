import type { ExpoConfig } from 'expo/config';

/**
 * One app for students, teachers and administrators. It talks only to the shared Edventure API
 * (EXPO_PUBLIC_API_URL); there is no mobile-specific backend.
 */
const config: ExpoConfig = {
  name: 'Edventure',
  slug: 'edventure',
  scheme: 'edventure',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'com.edventure.app',
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.edventure.app',
    // Locally stored data is encrypted and bound to the signed-in account; never back it up.
    allowBackup: false,
    permissions: ['POST_NOTIFICATIONS'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-localization', { supportsRTL: true, supportedLocales: ['en', 'ur'] }],
    ['expo-notifications', { color: '#6C52D5' }],
    ['expo-splash-screen', { backgroundColor: '#BCA8F4', imageWidth: 160 }],
    'expo-font',
  ],
  experiments: { typedRoutes: false },
  extra: {
    // In local development the app derives the API host from Metro's LAN address when unset.
    ...(process.env.EXPO_PUBLIC_API_URL ? { apiUrl: process.env.EXPO_PUBLIC_API_URL } : {}),
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
  updates: { enabled: true, checkAutomatically: 'ON_LOAD' },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
