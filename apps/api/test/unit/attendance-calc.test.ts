import { describe, expect, it } from 'vitest';
import { attendanceRate, completeness, summarize } from '../../src/modules/attendance/calc';

describe('attendance rate', () => {
  it('counts late as attended and excludes excused days', () => {
    expect(attendanceRate({ present: 17, late: 1, absent: 2, excused: 5 })).toBe('90.00');
  });
  it('returns null ("No data") when nothing eligible was recorded', () => {
    expect(attendanceRate({ present: 0, late: 0, absent: 0, excused: 3 })).toBeNull();
  });
  it('rounds half up to two decimals using exact arithmetic', () => {
    expect(attendanceRate({ present: 2, late: 0, absent: 1, excused: 0 })).toBe('66.67');
    expect(attendanceRate({ present: 1, late: 0, absent: 2, excused: 0 })).toBe('33.33');
  });
  it('separates recording completeness from the rate', () => {
    const s = summarize({ present: 3, late: 0, absent: 0, excused: 0 }, 5);
    expect(s.rate).toBe('100.00');
    expect(s.completeness).toBe('60.00');
    expect(completeness(0, 0)).toBeNull();
  });
});
