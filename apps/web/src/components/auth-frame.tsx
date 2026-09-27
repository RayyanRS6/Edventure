'use client';

import { GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './language-switch';

/** Shared branded frame for sign-in and account recovery steps. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[1fr_1fr]">
      <aside className="relative m-4 hidden overflow-hidden rounded-[32px] bg-brand-lilac p-12 text-ink lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10 flex items-center gap-3 text-lg font-bold">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-night text-brand-lime">
            <GraduationCap size={22} />
          </span>
          {t('app.name')}
        </div>
        <div className="relative z-10">
          <span className="mb-6 inline-block rounded-full bg-brand-lime px-4 py-2 text-xs font-bold uppercase">{t('app.tagline')}</span>
          <p className="brand-display max-w-lg text-balance text-[50px] xl:text-[64px]">{t('web.auth.heroTitle')}</p>
          <p className="mt-5 max-w-md text-pretty text-base text-ink-soft">{t('web.auth.heroBody')}</p>
          <div className="mt-10 flex gap-2">
            <span className="h-2 w-10 rounded-full bg-brand-night" /><span className="size-2 rounded-full bg-white" /><span className="size-2 rounded-full bg-white" />
          </div>
        </div>
        <p className="relative z-10 text-sm font-semibold text-ink-soft">Edventure © {new Date().getFullYear()}</p>
        <div aria-hidden className="brand-hero-mark -end-24 top-12 size-80" />
        <div aria-hidden className="absolute -bottom-20 end-16 size-44 rounded-[42px] bg-brand-pink rotate-12" />
      </aside>
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex justify-end">
          <LanguageSwitch />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-brand-night text-brand-lime"><GraduationCap size={22} /></span><span className="text-lg font-bold">{t('app.name')}</span></div>
          <div className="rounded-[26px] bg-brand-lilac p-6 lg:bg-transparent lg:p-0">
            <h1 className="brand-display text-balance text-4xl">{title}</h1>
            {subtitle && <p className="mt-3 text-pretty text-ink-soft">{subtitle}</p>}
          </div>
          <div className="mt-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
