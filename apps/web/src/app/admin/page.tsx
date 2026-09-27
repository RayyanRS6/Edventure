'use client';

import { AlertCircle, ArrowRight, CalendarCheck, CalendarClock, Megaphone, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { AdminDashboard } from '@edventure/contracts';
import { localized } from '@edventure/i18n';
import { Badge, Card, Grid, Stat } from '@/components/ui/layout';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/states';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';
import { useApi, useLang } from '@/lib/hooks';
import { useSession } from '@/lib/session';

export default function DashboardPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const session = useSession();
  const q = useApi<AdminDashboard>(['dashboard', 'admin'], '/dashboards/admin', undefined, { staleTime: 30_000 });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  const name = session.data ? localized(lang, session.data.me.displayName, session.data.me.displayNameUr) : '';

  return (
    <>
      <section className="brand-hero relative mb-5 flex min-h-64 flex-col justify-between gap-8 p-7 sm:p-9 lg:flex-row lg:items-end">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-4 inline-flex rounded-full bg-white/55 px-4 py-1.5 text-xs font-semibold text-ink">{formatDate(d.date, lang, { dateStyle: 'full' })}{d.academicYear ? ` · ${d.academicYear.name}` : ''}</p>
          <h1 className="brand-display text-balance text-[36px] sm:text-[48px]">{t('dashboard.greeting', { name })}</h1>
          <p className="mt-4 max-w-lg text-pretty text-base text-ink-soft">{t('app.tagline')}</p>
        </div>
        <div className="relative z-10 flex shrink-0 flex-wrap gap-2">
          <Link href="/admin/attendance" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-night px-5 text-sm font-semibold text-white hover:bg-accent-800">{t('nav.attendance')} <ArrowRight size={16} className="rtl:rotate-180" /></Link>
          <Link href="/admin/announcements" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/80 px-5 text-sm font-semibold text-ink hover:bg-white">{t('nav.announcements')}</Link>
        </div>
        <div aria-hidden className="brand-hero-mark -end-14 -top-20 size-72" />
        <div aria-hidden className="absolute end-48 top-9 size-5 rounded-full bg-brand-lime" />
      </section>
      <Grid cols={4}>
        <Stat feature="lime" label={t('dashboard.enrollment')} value={d.metrics.enrollment.active} hint={t('web.dashboard.teachersCount', { count: d.metrics.enrollment.teachers })} icon={<Users size={18} />} />
        <Stat
          label={t('dashboard.attendanceToday')}
          value={d.metrics.attendanceToday.instructional ? formatPercent(d.metrics.attendanceToday.rate) : t('web.dashboard.noSchool')}
          hint={d.metrics.attendanceToday.instructional ? t('web.dashboard.recorded', { value: formatPercent(d.metrics.attendanceToday.completeness, 0) }) : undefined}
          icon={<CalendarCheck size={18} />}
          feature="lilac"
        />
        <Stat
          label={t('dashboard.outstandingFees')}
          value={formatMoney(d.metrics.outstandingFees.amount, d.metrics.outstandingFees.currency)}
          hint={t('web.dashboard.overdueStudents', { count: d.metrics.outstandingFees.studentsOverdue })}
          tone={Number(d.metrics.outstandingFees.overdue) > 0 ? 'danger' : undefined}
          icon={<Wallet size={18} />}
          feature="apricot"
        />
        <Stat feature="pink" label={t('dashboard.pendingApprovals')} value={d.metrics.pendingApprovals.total} hint={t('web.dashboard.leaveRequests', { count: d.metrics.pendingApprovals.leave })} icon={<AlertCircle size={18} />} />
      </Grid>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title={t('dashboard.actionList')} padded={false}>
          {d.actions.length === 0 ? (
            <EmptyState title={t('dashboard.nothingPending')} />
          ) : (
            <ul className="divide-y divide-line">
              {d.actions.map((a) => (
                <li key={a.kind}>
                  <Link href={a.link.startsWith('/admin') ? a.link : `/admin${a.link}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-sunken">
                    <span className="flex items-center gap-3">
                      <Badge tone={a.priority <= 2 ? 'warning' : 'info'}>{a.count}</Badge>
                      {t(`web.actions.${a.kind}`)}
                    </span>
                    <ArrowRight size={16} className="text-subtle rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t('dashboard.upcomingExams')} padded={false} actions={<Link className="text-[13px] text-accent-700 hover:underline" href="/admin/exams">{t('web.common.viewAll')}</Link>}>
            {d.upcomingExams.length === 0 ? (
              <EmptyState title={t('web.dashboard.noExams')} icon={<CalendarClock size={20} />} />
            ) : (
              <ul className="divide-y divide-line">
                {d.upcomingExams.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="font-medium">{e.subjectName}</p>
                      <p className="text-[13px] text-muted">
                        {e.gradeName} {e.sectionName ?? ''} · {e.examCycleName}
                      </p>
                    </div>
                    <span className="tabular text-[13px] text-ink-soft">
                      {formatDate(e.date, lang)} · {e.startTime}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('dashboard.recentAnnouncements')} padded={false} actions={<Link className="text-[13px] text-accent-700 hover:underline" href="/admin/announcements">{t('web.common.viewAll')}</Link>}>
            {d.recentAnnouncements.length === 0 ? (
              <EmptyState title={t('web.announcements.none')} icon={<Megaphone size={20} />} />
            ) : (
              <ul className="divide-y divide-line">
                {d.recentAnnouncements.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <p className="font-medium">{localized(lang, a.title, a.titleUr)}</p>
                    <p className="text-[13px] text-muted">{formatDate(a.publishedAt, lang)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
