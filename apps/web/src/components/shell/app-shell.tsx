'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, ChevronDown, GraduationCap, LogOut, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Me } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import { useSignOut } from '@/lib/session';
import { LanguageSwitch } from '../language-switch';
import { navigation, type NavGroup } from './nav';

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({ group, pathname, onNavigate }: { group: NavGroup; pathname: string; onNavigate: () => void }) {
  const { t } = useTranslation();
  const Icon = group.icon;
  const active = group.href ? isActive(pathname, group.href) : group.items!.some((i) => isActive(pathname, i.href));
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  if (group.href) {
    return (
      <Link
        href={group.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={clsx('flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors', active ? 'bg-brand-lime text-brand-night' : 'text-white/65 hover:bg-white/10 hover:text-white')}
      >
        <Icon size={17} className="shrink-0" />
        <span className="min-w-0 flex-1">{t(group.labelKey)}</span>
      </Link>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={clsx('flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-[13px] font-medium transition-colors', active ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white')}
      >
        <Icon size={17} className="shrink-0" />
        <span className="min-w-0 flex-1">{t(group.labelKey)}</span>
        <ChevronDown size={15} className={clsx('shrink-0 text-white/45 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ms-5 mt-1 flex flex-col gap-0.5 border-s border-white/15 ps-2">
          {group.items!.map((item) => {
            const on = pathname === item.href || (item.href !== '/admin/fees' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                className={clsx('flex min-h-9 items-center rounded-md px-3 py-1.5 text-[13px] transition-colors', on ? 'bg-white/10 font-semibold text-brand-lime' : 'text-white/55 hover:bg-white/10 hover:text-white')}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GlobalSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const results = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<{ students: Array<{ id: string; displayName: string; admissionNumber: string; detail: string | null }>; teachers: Array<{ id: string; displayName: string; employeeNumber: string }> }>('/search', { query: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };
  const data = results.data;
  return (
    <div ref={ref} className="relative w-full max-w-lg">
      <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-subtle" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('web.shell.search')}
        aria-label={t('web.shell.search')}
        className="h-11 w-full rounded-full border border-line bg-canvas ps-10 pe-4 text-sm focus:border-accent-500 focus:bg-surface focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-11 z-30 max-h-96 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {!data || (!data.students.length && !data.teachers.length) ? (
            <p className="px-3 py-4 text-center text-muted">{results.isFetching ? t('common.loading') : t('common.noResults')}</p>
          ) : (
            <>
              {data.students.map((s) => (
                <button key={s.id} onClick={() => go(`/admin/students/${s.id}`)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-sunken">
                  <span className="font-medium">{s.displayName}</span>
                  <span className="text-[12px] text-muted">
                    {s.admissionNumber} · {s.detail ?? ''}
                  </span>
                </button>
              ))}
              {data.teachers.map((te) => (
                <button key={te.id} onClick={() => go(`/admin/teachers/${te.id}`)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-sunken">
                  <span className="font-medium">{te.displayName}</span>
                  <span className="text-[12px] text-muted">
                    {t('roles.teacher')} · {te.employeeNumber}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const signOut = useSignOut();
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications', { query: { limit: 1, unreadOnly: 'true' } }),
    refetchInterval: 60_000,
  });
  const schoolName = localized(i18n.language === 'ur' ? 'ur' : 'en', me.school.name, me.school.nameUr);

  const sidebar = (
    <nav className="flex h-full min-h-0 flex-col text-white" aria-label="Main">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-lime text-brand-night">
          <GraduationCap size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-lime">Edventure</p>
          <p className="truncate text-sm font-semibold leading-snug">{schoolName}</p>
          <p className="truncate text-[11px] text-white/45">{me.school.code}</p>
        </div>
        <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        <div className="flex flex-col gap-1">
          {navigation.map((g) => (
            <NavSection key={g.labelKey} group={g} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('web.shell.skip')}
      </a>
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 overflow-hidden bg-brand-night lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-hidden bg-brand-night shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="no-print z-20 flex h-18 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
          <button className="rounded-md p-2 text-muted lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <GlobalSearch />
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitch persist />
            <Link href="/admin/notifications" className="relative rounded-lg p-2 text-ink-soft hover:bg-sunken" aria-label={t('nav.notifications')}>
              <Bell size={18} />
              {!!unread.data?.unreadCount && (
                <span className="absolute -end-0.5 -top-0.5 min-w-4 rounded-full bg-danger-fg px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {unread.data.unreadCount > 99 ? '99+' : unread.data.unreadCount}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-2 ps-2">
              <span className="grid size-9 place-items-center rounded-full bg-brand-lime text-[12px] font-bold text-brand-night">{initials(me.displayName)}</span>
              <span className="hidden text-sm font-medium md:block">{localized(i18n.language === 'ur' ? 'ur' : 'en', me.displayName, me.displayNameUr)}</span>
              <button onClick={signOut} className="rounded-lg p-2 text-muted hover:bg-sunken" aria-label={t('common.signOut')} title={t('common.signOut')}>
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>
        <div className="app-content-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
