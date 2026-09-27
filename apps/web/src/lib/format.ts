import type { StatusTone } from '@edventure/design-tokens';

const loc = (lang: string) => (lang === 'ur' ? 'ur-PK' : 'en-PK');

/** School-local calendar dates are `YYYY-MM-DD`; render them without shifting time zones. */
export function formatDate(date: string | null | undefined, lang = 'en', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!date) return '—';
  const d = date.length === 10 ? new Date(`${date}T00:00:00Z`) : new Date(date);
  return new Intl.DateTimeFormat(loc(lang), { ...opts, timeZone: date.length === 10 ? 'UTC' : 'Asia/Karachi' }).format(d);
}

export function formatDateTime(value: string | null | undefined, lang = 'en') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(loc(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' }).format(new Date(value));
}

/** Money arrives as exact decimal strings; format for display only. Digits stay Latin in both languages, as on printed fee slips. */
export function formatMoney(amount: string | null | undefined, currency = 'PKR') {
  if (amount === null || amount === undefined) return '—';
  const n = Number.parseFloat(amount);
  return `${currency} ${n.toLocaleString('en-PK', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Exact decimal strings from the API ("45.50") shown without trailing zeros ("45.5"). */
export function formatNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false }) : String(value);
}

export function formatPercent(value: string | null | undefined, decimals = 1) {
  if (value === null || value === undefined) return '—';
  return `${Number.parseFloat(value).toFixed(decimals)}%`;
}

export const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const accountTone: Record<string, StatusTone> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  disabled: 'neutral',
  pending_deletion: 'danger',
};

export const feeTone: Record<string, StatusTone> = { paid: 'success', partially_paid: 'warning', unpaid: 'danger' };
export const stateTone: Record<string, StatusTone> = {
  draft: 'neutral',
  published: 'success',
  scheduled: 'info',
  marking: 'warning',
  review: 'warning',
  closed: 'neutral',
  superseded: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  submitted: 'success',
  not_started: 'danger',
  validated: 'info',
  invalid: 'danger',
  committed: 'success',
  committing: 'warning',
  failed: 'danger',
  queued: 'neutral',
  running: 'info',
  succeeded: 'success',
  expired: 'neutral',
  executed: 'success',
  active: 'success',
  planning: 'info',
  pass: 'success',
  fail: 'danger',
  incomplete: 'warning',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
