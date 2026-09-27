'use client';

import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppLocale } from '@edventure/i18n';
import { api } from '@/lib/api';
import { switchLocale } from '@/lib/i18n';

export function LanguageSwitch({ persist = false }: { persist?: boolean }) {
  const { i18n } = useTranslation();
  const next: AppLocale = i18n.language === 'ur' ? 'en' : 'ur';
  return (
    <button
      onClick={async () => {
        await switchLocale(next);
        if (persist) await api.patch('/me/preferences', { locale: next }).catch(() => undefined);
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-sunken"
      aria-label={next === 'ur' ? 'اردو' : 'English'}
    >
      <Languages size={16} />
      {next === 'ur' ? 'اردو' : 'English'}
    </button>
  );
}
