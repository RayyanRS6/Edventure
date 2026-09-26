import { z } from 'zod';
import { id, isoDate } from '@edventure/contracts';

/** Small shared route schemas. */
export const idParams = z.object({ id });
export const list = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });
export const ok = z.object({ ok: z.literal(true) });
export const OK = { ok: true as const };
export const reasonBody = z.object({ reason: z.string().trim().min(3).max(500) });
export const endDateBody = z.object({ endDate: isoDate });
export const dateQuery = z.object({ date: isoDate.optional() });
