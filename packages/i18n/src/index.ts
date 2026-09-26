import { en, type Messages } from './locales/en';
import { ur } from './locales/ur';

export type { Messages };
export type AppLocale = 'en' | 'ur';

export const messages: Record<AppLocale, Messages> = { en, ur };

/** i18next-compatible resources (`{{name}}` interpolation). */
export const resources = {
  en: { translation: en },
  ur: { translation: ur },
} as const;

export const supportedLocales: AppLocale[] = ['en', 'ur'];
export const directionOf = (locale: AppLocale): 'ltr' | 'rtl' => (locale === 'ur' ? 'rtl' : 'ltr');
export const isRtl = (locale: AppLocale) => directionOf(locale) === 'rtl';

type Path<T> = T extends string ? '' : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}` }[keyof T & string];
export type MessageKey = Path<Messages>;

export function lookup(locale: AppLocale, key: string): string | undefined {
  let node: unknown = messages[locale];
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, values: Record<string, unknown> = {}) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = values[name];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Translate outside React (backend push text, PDF templates). Falls back to English, then the key. */
export function translate(locale: AppLocale, key: string, values?: Record<string, unknown>) {
  const template = lookup(locale, key) ?? lookup('en', key) ?? key;
  return interpolate(template, values);
}

/**
 * Localized push text for a notification kind. Lock-screen text never includes marks, amounts or
 * other sensitive details; the app shows those after the user opens it.
 */
export function pushText(locale: AppLocale, kind: string, data: Record<string, unknown> = {}) {
  const base = `notifications.${kind.replace(/\./g, '_')}`;
  const title = lookup(locale, `${base}.title`) ?? lookup('en', `${base}.title`);
  const body = lookup(locale, `${base}.body`) ?? lookup('en', `${base}.body`);
  return {
    title: interpolate(title ?? translate(locale, 'notifications.generic.title'), data),
    body: interpolate(body ?? translate(locale, 'notifications.generic.body'), data),
  };
}

/** Pick the Urdu variant of school-authored content when requested and present; never machine-translate. */
export function localized(locale: AppLocale, en: string, ur: string | null | undefined) {
  return locale === 'ur' && ur ? ur : en;
}

export { en, ur };
