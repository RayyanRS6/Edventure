'use client';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { messages as shared, directionOf, type AppLocale } from '@edventure/i18n';
import { webEn, webUr } from '@/i18n/web';

export const LOCALE_COOKIE = 'edv_locale';

let initialized = false;

export function initI18n(locale: AppLocale) {
  if (!initialized) {
    initialized = true;
    void i18next.use(initReactI18next).init({
      lng: locale,
      fallbackLng: 'en',
      resources: {
        en: { translation: { ...shared.en, web: webEn } },
        ur: { translation: { ...shared.ur, web: webUr } },
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  }
  return i18next;
}

export async function switchLocale(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = directionOf(locale);
  await i18next.changeLanguage(locale);
}
