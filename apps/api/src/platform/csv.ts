import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export const MAX_IMPORT_ROWS = 5000;

/** Parses a UTF-8 CSV (BOM tolerated). Returns header-keyed records. */
export function parseCsv(body: Buffer, options: { delimiter?: string; skipRows?: number; hasHeader?: boolean } = {}) {
  const text = body.toString('utf8').replace(/^﻿/, '');
  const records = parse(text, {
    delimiter: options.delimiter ?? ',',
    from_line: (options.skipRows ?? 0) + 1,
    columns: options.hasHeader === false ? false : (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  }) as Array<Record<string, string> | string[]>;
  return records.map((r) => (Array.isArray(r) ? Object.fromEntries(r.map((v, i) => [String(i + 1), v])) : r)) as Array<Record<string, string>>;
}

/**
 * Spreadsheet formula injection guard: values starting with = + - @ tab or CR are prefixed with an
 * apostrophe so Excel/Sheets treat them as text.
 */
export function safeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** UTF-8 CSV with BOM so Excel shows Urdu correctly. */
export function toCsv(header: string[], rows: unknown[][]) {
  const body = stringify([header, ...rows.map((r) => r.map(safeCell))], { record_delimiter: 'windows' });
  return Buffer.concat([Buffer.from('﻿', 'utf8'), Buffer.from(body, 'utf8')]);
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseDateWithFormat(value: string, format: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'DD-MMM-YYYY'): string | null {
  const v = value.trim();
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  switch (format) {
    case 'YYYY-MM-DD':
      match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!match) return null;
      [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
      break;
    case 'DD/MM/YYYY':
    case 'DD-MM-YYYY':
      match = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
      if (!match) return null;
      [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
      break;
    case 'MM/DD/YYYY':
      match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!match) return null;
      [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
      break;
    case 'DD-MMM-YYYY':
      match = v.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})/);
      if (!match) return null;
      d = Number(match[1]);
      m = MONTHS[match[2]!.toLowerCase()] ?? 0;
      y = Number(match[3]);
      break;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** Parses a bank amount like "12,500.00", "(1,000)" or "1 500" into a decimal string. */
export function parseAmount(value: string, thousands: ',' | '' | ' '): string | null {
  let v = value.trim();
  if (!v) return null;
  const negative = /^\(.*\)$/.test(v) || v.startsWith('-');
  v = v.replace(/[()]/g, '').replace(/^-/, '').replace(/^(PKR|Rs\.?)\s*/i, '');
  if (thousands) v = v.split(thousands).join('');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return `${negative ? '-' : ''}${v}`;
}
