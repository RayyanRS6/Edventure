import { z } from 'zod';

/** Opaque identifier used in every URL and payload. */
export const id = z.uuid();
export type Id = z.infer<typeof id>;

/** School-local calendar date (attendance, due dates, calendars): `YYYY-MM-DD`. */
export const isoDate = z.iso.date();

/** UTC instant serialized as ISO-8601. */
export const isoDateTime = z.iso.datetime({ offset: true });

/** Wall-clock time in the school timezone: `HH:MM`. */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour) time');

/**
 * Exact money amount as a decimal string (never a float). Up to 12 integer digits and 2 decimals.
 * Negative values are rejected here; reversals and credits are modelled as their own records.
 */
export const money = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Enter an amount such as 1500 or 1500.50');

export const positiveMoney = money.refine((v) => /[1-9]/.test(v), 'Amount must be greater than zero');

/** Exact score/marks as a decimal string. */
export const score = z
  .string()
  .trim()
  .regex(/^\d{1,5}(\.\d{1,2})?$/, 'Enter a number with at most 2 decimal places');

/** Percentage 0–100 with up to 2 decimals, as a decimal string. */
export const percentage = z
  .string()
  .trim()
  .regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, 'Enter a percentage between 0 and 100');

export const locales = ['en', 'ur'] as const;
export const locale = z.enum(locales);
export type Locale = z.infer<typeof locale>;

/** Optional Urdu variant for school-authored content and names. */
export const optionalUrdu = z.string().trim().max(500).nullish();

export const nonEmpty = (max = 200) => z.string().trim().min(1, 'Required').max(max);

/** Opaque cursor pagination. Default 50, maximum 100. */
export const pageQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageQuery = z.infer<typeof pageQuery>;

export const page = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

export type Page<T> = { items: T[]; nextCursor: string | null };

/** Version precondition for concurrently editable records. Stale versions return 409. */
export const versioned = z.object({ version: z.number().int().positive() });

/** Accepted response for long-running work. */
export const jobAccepted = z.object({ jobId: id, status: z.literal('queued') });

export const okResponse = z.object({ ok: z.literal(true) });

export const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const weekday = z.number().int().min(1).max(7); // ISO: 1 = Monday … 7 = Sunday
