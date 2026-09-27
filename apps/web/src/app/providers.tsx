'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { AppLocale } from '@edventure/i18n';
import { ApiError } from '@/lib/api';
import { initI18n } from '@/lib/i18n';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const [i18n] = useState(() => initI18n(locale));
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dashboards stay fresh for 30 s; configuration data overrides with longer windows.
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
