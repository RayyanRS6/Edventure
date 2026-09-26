import { and, gte, lte } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { schoolCalendarDays, schoolPolicies } from '../db/schema';
import { eachDate, isoWeekday } from './dates';

/**
 * Instructional days between two dates (inclusive): the school's working weekdays, minus holidays
 * and closures, plus any explicitly instructional make-up days on non-working weekdays.
 */
export async function instructionalDays(tx: Tx, from: string, to: string): Promise<string[]> {
  if (to < from) return [];
  const [policy] = await tx.select({ attendance: schoolPolicies.attendance }).from(schoolPolicies).limit(1);
  const working = new Set(policy?.attendance.workingWeekdays ?? [1, 2, 3, 4, 5, 6]);
  const overrides = await tx
    .select({ date: schoolCalendarDays.date, kind: schoolCalendarDays.kind })
    .from(schoolCalendarDays)
    .where(and(gte(schoolCalendarDays.date, from), lte(schoolCalendarDays.date, to)));
  const byDate = new Map(overrides.map((o) => [o.date, o.kind]));
  return eachDate(from, to).filter((d) => {
    const kind = byDate.get(d);
    if (kind === 'holiday' || kind === 'closure') return false;
    if (kind === 'instructional') return true;
    return working.has(isoWeekday(d));
  });
}

export async function isInstructionalDay(tx: Tx, date: string) {
  return (await instructionalDays(tx, date, date)).length === 1;
}
