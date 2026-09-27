'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import type { StatusTone } from '@edventure/design-tokens';

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-balance text-[30px] font-bold leading-tight text-ink sm:text-[36px]">{title}</h1>
        {subtitle && <div className="mt-2 text-pretty text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('brand-card overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[16px] font-bold text-ink">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon, feature }: { label: string; value: ReactNode; hint?: ReactNode; tone?: StatusTone; icon?: ReactNode; feature?: 'lilac' | 'lime' | 'apricot' | 'pink' }) {
  return (
    <div className={clsx('brand-card min-h-40 p-5', feature === 'lilac' && 'bg-brand-lilac', feature === 'lime' && 'bg-brand-lime', feature === 'apricot' && 'bg-brand-apricot', feature === 'pink' && 'bg-brand-pink')}>
      <div className="flex items-start justify-between gap-2 text-ink-soft">
        <span className="text-[13px] font-semibold">{label}</span>
        {icon && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/55 text-ink">{icon}</span>}
      </div>
      <div className={clsx('tabular mt-4 break-words text-[28px] font-bold leading-tight', tone === 'danger' ? 'text-danger-fg' : 'text-ink')}>{value}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-soft">{hint}</div>}
    </div>
  );
}

const toneClass: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success-fg',
  warning: 'bg-warning-bg text-warning-fg',
  danger: 'bg-danger-bg text-danger-fg',
  info: 'bg-info-bg text-info-fg',
  neutral: 'bg-neutral-bg text-neutral-fg',
};

/** Status is always written out; color only reinforces it. */
export function Badge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold', toneClass[tone])}>{children}</span>;
}

export function Grid({ children, cols = 2, className }: { children: ReactNode; cols?: 1 | 2 | 3 | 4; className?: string }) {
  const map = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-2 xl:grid-cols-4' };
  return <div className={clsx('grid grid-cols-1 gap-4', map[cols], className)}>{children}</div>;
}

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] font-medium uppercase tracking-wide text-subtle">{k}</dt>
          <dd className="mt-0.5 break-words text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="no-print mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={clsx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            t.value === value ? 'border-accent-600 text-accent-700' : 'border-transparent text-muted hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="no-print mb-4 flex flex-wrap items-end gap-3">{children}</div>;
}
