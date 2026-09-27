import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager } from 'react-native';
import { directionOf, en, ur, type AppLocale } from '@edventure/i18n';
import { mobileEn, mobileUr } from '@/i18n/mobile';

const LOCALE_KEY = 'edventure.locale';
const RTL_ATTEMPT_KEY = 'edventure.rtl-attempt';

export function deviceLocale(): AppLocale {
  return Localization.getLocales()[0]?.languageCode === 'ur' ? 'ur' : 'en';
}

export async function storedLocale(): Promise<AppLocale> {
  const saved = await SecureStore.getItemAsync(LOCALE_KEY);
  return saved === 'ur' || saved === 'en' ? saved : deviceLocale();
}

export function initI18n(locale: AppLocale) {
  if (i18next.isInitialized) return i18next;
  void i18next.use(initReactI18next).init({
    resources: {
      en: { translation: { ...en, mobile: mobileEn } },
      ur: { translation: { ...ur, mobile: mobileUr } },
    },
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18next;
}

function restart() {
  if (__DEV__) DevSettings.reload();
  else void Updates.reloadAsync();
}

/**
 * React Native applies layout direction at start-up. When the language's direction differs from
 * the running layout, flip it and restart once. A stored marker prevents a restart loop on
 * platforms where forcing RTL is unavailable.
 */
export async function ensureDirection(locale: AppLocale): Promise<boolean> {
  const rtl = directionOf(locale) === 'rtl';
  if (I18nManager.isRTL === rtl) {
    await SecureStore.deleteItemAsync(RTL_ATTEMPT_KEY);
    return false;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  if ((await SecureStore.getItemAsync(RTL_ATTEMPT_KEY)) === locale) return false;
  await SecureStore.setItemAsync(RTL_ATTEMPT_KEY, locale);
  restart();
  return true;
}

/** Switches language on this device (and the caller persists it on the account). */
export async function applyLocale(locale: AppLocale) {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
  await i18next.changeLanguage(locale);
  await ensureDirection(locale);
}
