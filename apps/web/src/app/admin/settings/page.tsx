'use client';

import { Laptop, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SchoolSettings, SessionSummary } from '@edventure/contracts';
import { Button, LinkButton } from '@/components/ui/button';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, DefinitionList, PageHeader, Tabs } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

type Tab = 'school' | 'policies' | 'account';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('school');
  const q = useApi<SchoolSettings>(['school'], '/school');
  return (
    <>
      <PageHeader title={t('nav.settings')} subtitle={t('web.settings.subtitle')} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'school', label: t('web.settings.school') },
          { value: 'policies', label: t('web.settings.policies') },
          { value: 'account', label: t('web.settings.account') },
        ]}
      />
      {tab === 'account' ? <Account /> : q.isLoading ? <LoadingBlock /> : q.error || !q.data ? <ErrorState error={q.error} /> : tab === 'school' ? <School s={q.data} /> : <Policies s={q.data} />}
    </>
  );
}

function School({ s }: { s: SchoolSettings }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: s.name, nameUr: s.nameUr ?? '', defaultLocale: s.defaultLocale, primaryColor: s.branding.primaryColor ?? '#6C52D5' });
  useEffect(() => setF({ name: s.name, nameUr: s.nameUr ?? '', defaultLocale: s.defaultLocale, primaryColor: s.branding.primaryColor ?? '#6C52D5' }), [s]);
  const save = useAction(
    () => api.patch('/school', { version: s.version, name: f.name, nameUr: f.nameUr || null, defaultLocale: f.defaultLocale, branding: { ...s.branding, primaryColor: f.primaryColor } }),
    { invalidate: [['school'], ['me']], success: t('web.common.updated') },
  );
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card title={t('web.settings.profile')}>
        <div className="grid gap-3">
          <TextField label={t('web.settings.schoolName')} value={f.name} onValue={(v) => setF({ ...f, name: v })} required />
          <TextField label={t('web.settings.schoolNameUr')} value={f.nameUr} onValue={(v) => setF({ ...f, nameUr: v })} dir="rtl" />
          <SelectField label={t('web.settings.defaultLanguage')} value={f.defaultLocale} onValue={(v) => setF({ ...f, defaultLocale: v as 'en' | 'ur' })} options={[{ value: 'en', label: t('common.english') }, { value: 'ur', label: t('common.urdu') }]} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-soft">{t('web.settings.brandColor')}</span>
            <span className="flex items-center gap-2">
              <input type="color" aria-label={t('web.settings.brandColor')} value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value.toUpperCase() })} className="h-10 w-14 cursor-pointer rounded-lg border border-line-strong" />
              <code className="text-sm">{f.primaryColor}</code>
            </span>
            <span className="text-[12px] text-muted">{t('web.settings.brandColorHint')}</span>
          </label>
          <InlineError error={save.error} />
          <div className="flex justify-end">
            <Button variant="primary" loading={save.isPending} disabled={!f.name.trim()} onClick={() => save.mutate(undefined)}>{t('web.common.saveChanges')}</Button>
          </div>
        </div>
      </Card>
      <Card title={t('web.settings.fixed')}>
        <DefinitionList
          items={[
            [t('auth.schoolCode'), <code key="c">{s.code}</code>],
            [t('web.settings.timezone'), s.timezone],
            [t('web.settings.currency'), s.currency],
            [t('web.settings.offlineDays'), t('web.settings.days', { count: s.policies.operations.offlineCacheDays })],
            [t('web.settings.minimumApp'), s.policies.operations.minimumMobileVersion ?? '—'],
          ]}
        />
        <p className="mt-4 text-[13px] text-muted">{t('web.settings.fixedHint')}</p>
      </Card>
    </div>
  );
}

function Policies({ s }: { s: SchoolSettings }) {
  const { t } = useTranslation();
  const p = s.policies;
  const [f, setF] = useState({
    workingWeekdays: p.attendance.workingWeekdays,
    sameDayTeacherCorrection: p.attendance.sameDayTeacherCorrection,
    feeReminderMode: p.notifications.feeReminderMode,
    feeReminderDaysAfterDue: p.notifications.feeReminderDaysAfterDue.join(', '),
    purgeEnabled: p.retention.purgeEnabled,
    exportDownloadHours: String(p.retention.exportDownloadHours),
  });
  const days = f.feeReminderDaysAfterDue
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  const daysValid = days.every((d) => Number.isInteger(d) && d >= 0 && d <= 120) && days.length <= 5;
  const save = useAction(
    () =>
      api.patch('/school', {
        version: s.version,
        attendance: { workingWeekdays: [...f.workingWeekdays].sort(), sameDayTeacherCorrection: f.sameDayTeacherCorrection },
        notifications: { feeReminderMode: f.feeReminderMode, feeReminderDaysAfterDue: days },
        retention: { recoveryDays: 30, purgeEnabled: f.purgeEnabled, exportDownloadHours: Number(f.exportDownloadHours) },
      }),
    { invalidate: [['school']], success: t('web.common.updated') },
  );
  const toggleDay = (d: number, on: boolean) => setF({ ...f, workingWeekdays: on ? [...new Set([...f.workingWeekdays, d])] : f.workingWeekdays.filter((x) => x !== d) });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title={t('nav.attendance')}>
        <div className="grid gap-3">
          <p className="text-[13px] font-medium text-ink-soft">{t('web.settings.workingDays')}</p>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Checkbox key={d} label={t(`web.common.weekday.${d}`)} checked={f.workingWeekdays.includes(d)} onChange={(v) => toggleDay(d, v)} />
            ))}
          </div>
          <Checkbox label={t('web.settings.sameDayCorrection')} hint={t('web.settings.sameDayCorrectionHint')} checked={f.sameDayTeacherCorrection} onChange={(v) => setF({ ...f, sameDayTeacherCorrection: v })} />
        </div>
      </Card>
      <Card title={t('web.settings.feeReminders')}>
        <div className="grid gap-3">
          <SelectField label={t('web.settings.reminderMode')} value={f.feeReminderMode} onValue={(v) => setF({ ...f, feeReminderMode: v as 'preview' | 'scheduled' })} options={[{ value: 'preview', label: t('web.settings.reminderPreview') }, { value: 'scheduled', label: t('web.settings.reminderScheduled') }]} />
          <TextField label={t('web.settings.reminderDays')} value={f.feeReminderDaysAfterDue} onValue={(v) => setF({ ...f, feeReminderDaysAfterDue: v })} hint={t('web.settings.reminderDaysHint')} error={daysValid ? undefined : t('web.settings.reminderDaysInvalid')} dir="ltr" />
        </div>
      </Card>
      <Card title={t('web.settings.retention')}>
        <div className="grid gap-3">
          <DefinitionList items={[[t('web.settings.recoveryWindow'), t('web.settings.days', { count: p.retention.recoveryDays })]]} />
          <Checkbox label={t('web.settings.purge')} hint={t('web.settings.purgeHint')} checked={f.purgeEnabled} onChange={(v) => setF({ ...f, purgeEnabled: v })} />
          <TextField label={t('web.settings.downloadHours')} value={f.exportDownloadHours} onValue={(v) => setF({ ...f, exportDownloadHours: v.replace(/\D/g, '').slice(0, 3) })} hint={t('web.settings.downloadHoursHint')} dir="ltr" />
        </div>
      </Card>
      <div className="flex flex-col justify-end gap-3 xl:col-span-2">
        <InlineError error={save.error} />
        <div className="flex justify-end">
          <Button variant="primary" loading={save.isPending} disabled={!daysValid || !f.workingWeekdays.length || !(Number(f.exportDownloadHours) >= 1)} onClick={() => save.mutate(undefined)}>{t('web.common.saveChanges')}</Button>
        </div>
      </div>
    </div>
  );
}

function Account() {
  const { t } = useTranslation();
  const lang = useLang();
  const sessions = useApi<{ items: SessionSummary[] }>(['sessions'], '/sessions');
  const revoke = useAction((id: string) => api.delete(`/sessions/${id}`), { invalidate: [['sessions']], success: t('web.settings.signedOutDevice'), toastErrors: true });
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card title={t('auth.sessions')} padded={false}>
        {sessions.isLoading ? (
          <LoadingBlock />
        ) : (
          <ul className="divide-y divide-line">
            {(sessions.data?.items ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="flex items-center gap-3">
                  <span className="rounded-lg bg-sunken p-2 text-muted">{s.client === 'web' ? <Laptop size={16} /> : <Smartphone size={16} />}</span>
                  <span>
                    <span className="block font-medium">
                      {s.deviceName ?? (s.client === 'web' ? t('web.settings.browser') : t('web.settings.mobileApp'))}
                      {s.current && <Badge tone="success"> {t('auth.thisDevice')}</Badge>}
                    </span>
                    <span className="text-[12px] text-muted">{s.platform ?? s.client} · {t('web.settings.lastSeen', { time: formatDateTime(s.lastSeenAt, lang) })}</span>
                  </span>
                </span>
                {!s.current && <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>{t('auth.signOutDevice')}</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t('auth.changePassword')}>
        <p className="mb-3 text-[13px] text-muted">{t('web.settings.passwordHint')}</p>
        <LinkButton href="/change-password">{t('auth.changePassword')}</LinkButton>
      </Card>
    </div>
  );
}
