import type { StatusTone } from '@edventure/design-tokens';

const loc = (lang: string) => (lang === 'ur' ? 'ur-PK' : 'en-PK');

function safeFormat(date: Date, lang: string, opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(loc(lang), opts).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', { ...opts, timeZone: undefined }).format(date);
  }
}

/** School-local calendar dates are `YYYY-MM-DD`; render them without shifting time zones. */
export function formatDate(date: string | null | undefined, lang = 'en', opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  if (!date) return '—';
  const plain = date.length === 10;
  return safeFormat(new Date(plain ? `${date}T00:00:00Z` : date), lang, { ...opts, timeZone: plain ? 'UTC' : 'Asia/Karachi' });
}

export function formatDateTime(value: string | null | undefined, lang = 'en') {
  if (!value) return '—';
  return safeFormat(new Date(value), lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' });
}

export const weekdayName = (date: string, lang: string) => formatDate(date, lang, { weekday: 'long' });

/** Money arrives as exact decimal strings; digits stay Latin in both languages. */
export function formatMoney(amount: string | null | undefined, currency = 'PKR') {
  if (amount === null || amount === undefined) return '—';
  return `${currency} ${formatMoneyAmount(amount)}`;
}

export function formatMoneyAmount(amount: string | null | undefined) {
  if (amount === null || amount === undefined) return '—';
  const n = Number.parseFloat(amount);
  return n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function formatNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(value);
}

export function formatPercent(value: string | null | undefined, decimals = 1) {
  if (value === null || value === undefined) return '—';
  return `${Number.parseFloat(value).toFixed(decimals)}%`;
}

export const todayLocal = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a school-local date. */
export const isoWeekday = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

export const stateTone: Record<string, StatusTone> = {
  pending: 'warning',
  submitted: 'success',
  completed: 'success',
  excused: 'neutral',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
  draft: 'neutral',
  published: 'success',
  closed: 'neutral',
  in_progress: 'info',
  marked: 'success',
  not_started: 'danger',
  pass: 'success',
  fail: 'danger',
  incomplete: 'warning',
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'danger',
};
