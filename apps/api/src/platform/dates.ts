/**
 * School-local calendar helpers. Attendance, calendars and due dates use the school's timezone
 * (Asia/Karachi by default); instants are stored in UTC.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Today's date (`YYYY-MM-DD`) in the given timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return formatterFor(timeZone).format(now);
}

export function localDateOf(instant: Date, timeZone: string): string {
  return formatterFor(timeZone).format(instant);
}

export function parseDate(date: string): Date {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date ${date}`);
  return d;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = parseDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Inclusive list of dates between `from` and `to`. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** True when `date` is inside the half-open effective range `[start, end)`; `end` null means open-ended. */
export function inRange(date: string, start: string, end: string | null): boolean {
  return date >= start && (end === null || date < end);
}

export function compareDates(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** UTC instant for a school-local wall-clock date/time. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(':').map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const offset = asLocal - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

export function monthEnd(date: string) {
  const d = parseDate(monthStart(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return formatDate(d);
}
