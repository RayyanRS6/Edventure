'use client';

import clsx from 'clsx';
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { errorMessage } from '@/lib/api';

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner /> {label ?? t('common.loading')}
    </div>
  );
}

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 rounded-full bg-sunken p-3 text-muted">{icon ?? <Inbox size={22} />}</div>
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="max-w-md text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="rounded-full bg-danger-bg p-3 text-danger-fg">
        <AlertTriangle size={22} />
      </div>
      <p className="font-medium">{t('common.somethingWentWrong')}</p>
      <p className="max-w-md text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm hover:bg-sunken">
          <RotateCw size={14} /> {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger-fg/20 bg-danger-bg px-3 py-2 text-sm text-danger-fg">
      {errorMessage(error)}
    </div>
  );
}
