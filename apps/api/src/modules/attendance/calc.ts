import type { AttendanceSummary } from '@edventure/contracts';
import { D } from '../../platform/decimal';

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
}

/**
 * Default attendance rate: (present + late) ÷ (present + late + absent), as a percentage with two
 * decimals. Excused days are excluded and reported separately. No eligible recorded days → null
 * ("No data"); missing records are "not recorded", never absent.
 */
export function attendanceRate(c: AttendanceCounts): string | null {
  const attended = c.present + c.late;
  const denominator = attended + c.absent;
  if (denominator === 0) return null;
  return new D(attended).div(denominator).mul(100).toFixed(2);
}

export function completeness(recorded: number, expected: number): string | null {
  if (expected <= 0) return null;
  return new D(Math.min(recorded, expected)).div(expected).mul(100).toFixed(2);
}

export function summarize(c: AttendanceCounts, expectedDays: number): AttendanceSummary {
  const recordedDays = c.present + c.absent + c.late + c.excused;
  return {
    ...c,
    recordedDays,
    expectedDays,
    rate: attendanceRate(c),
    completeness: completeness(recordedDays, expectedDays),
  };
}

export const emptyCounts = (): AttendanceCounts => ({ present: 0, absent: 0, late: 0, excused: 0 });

export function addCount(c: AttendanceCounts, status: string, n = 1) {
  if (status === 'present' || status === 'absent' || status === 'late' || status === 'excused') c[status] += n;
  return c;
}
