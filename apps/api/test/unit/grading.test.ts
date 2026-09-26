import { describe, expect, it } from 'vitest';
import { bandFor, calculateStudent, calculateSubject, validateBands, type Policy, type SubjectInput } from '../../src/modules/assessment/grading';
import { D } from '../../src/platform/decimal';

const bands = [
  { label: 'A+', minPercentage: '80', maxPercentage: '100', gradePoints: '4.00', isPassing: true },
  { label: 'A', minPercentage: '70', maxPercentage: '80', gradePoints: '3.50', isPassing: true },
  { label: 'B', minPercentage: '60', maxPercentage: '70', gradePoints: '3.00', isPassing: true },
  { label: 'C', minPercentage: '50', maxPercentage: '60', gradePoints: '2.50', isPassing: true },
  { label: 'D', minPercentage: '33', maxPercentage: '50', gradePoints: '2.00', isPassing: true },
  { label: 'F', minPercentage: '0', maxPercentage: '33', gradePoints: '0.00', isPassing: false },
];
const policy: Policy = { minOverallPercentage: '33', requireAllCompulsoryPass: true, maxFailedSubjects: null, absentRule: 'fail', gpaEnabled: true, bands };
const subject = (id: string, score: string | null, outcome: SubjectInput['components'][number]['outcome'] = 'score', compulsory = true): SubjectInput => ({
  courseOfferingId: id,
  compulsory,
  credit: null,
  displayMaxMarks: '100',
  components: [{ weight: '1', outcome, score, maxMarks: '100', passMarks: '33' }],
});

describe('grade bands', () => {
  it('accepts complete coverage and reports gaps and overlaps', () => {
    expect(validateBands(bands)).toEqual([]);
    expect(validateBands(bands.filter((b) => b.label !== 'C'))).toContain('Gap between D and B');
    expect(validateBands([...bands, { label: 'X', minPercentage: '75', maxPercentage: '85', gradePoints: null, isPassing: true }]).length).toBeGreaterThan(0);
  });
  it('applies thresholds to exact values before display rounding', () => {
    // 79.995% must be an A (not rounded up to 80 = A+).
    expect(bandFor(new D('79.995'), bands)?.label).toBe('A');
    expect(bandFor(new D('80'), bands)?.label).toBe('A+');
    expect(bandFor(new D('100'), bands)?.label).toBe('A+');
  });
});

describe('subject results', () => {
  it('distinguishes absent, exempt and missing outcomes', () => {
    expect(calculateSubject(subject('m', null, 'absent'), policy).outcome).toBe('absent');
    expect(calculateSubject(subject('m', null, 'absent'), { ...policy, absentRule: 'zero' }).outcome).toBe('fail');
    expect(calculateSubject(subject('m', null, 'absent'), { ...policy, absentRule: 'exclude' }).outcome).toBe('exempt');
    expect(calculateSubject(subject('m', null, 'exempt'), policy).outcome).toBe('exempt');
    expect(calculateSubject(subject('m', null, 'missing'), policy).outcome).toBe('incomplete');
    expect(calculateSubject(subject('m', null, 'withheld'), policy).outcome).toBe('incomplete');
  });
  it('combines weighted exam cycles', () => {
    const r = calculateSubject(
      {
        courseOfferingId: 'm',
        compulsory: true,
        credit: null,
        displayMaxMarks: '100',
        components: [
          { weight: '30', outcome: 'score', score: '40', maxMarks: '50', passMarks: '17' }, // 80%
          { weight: '70', outcome: 'score', score: '60', maxMarks: '100', passMarks: '33' }, // 60%
        ],
      },
      policy,
    );
    expect(r.percentage).toBe('66.0000');
    expect(r.gradeLabel).toBe('B');
    expect(r.outcome).toBe('pass');
  });
});

describe('student results', () => {
  it('computes totals, percentage, grade and GPA', () => {
    const r = calculateStudent([subject('a', '90'), subject('b', '70'), subject('c', null, 'exempt')], policy);
    expect(r).toMatchObject({ obtainedMarks: '160.00', totalMarks: '200.00', percentage: '80.0000', gradeLabel: 'A+', outcome: 'pass', gpa: '3.750' });
  });
  it('fails a student who fails a compulsory subject even with a good average', () => {
    const r = calculateStudent([subject('a', '95'), subject('b', '20')], policy);
    expect(r.outcome).toBe('fail');
    expect(r.failedSubjects).toBe(1);
    const lenient = calculateStudent([subject('a', '95'), subject('b', '20', 'score', false)], policy);
    expect(lenient.outcome).toBe('pass');
  });
  it('honours the maximum number of failed subjects', () => {
    const p = { ...policy, requireAllCompulsoryPass: false, maxFailedSubjects: 1 };
    expect(calculateStudent([subject('a', '90'), subject('b', '20'), subject('c', '80')], p).outcome).toBe('pass');
    expect(calculateStudent([subject('a', '90'), subject('b', '20'), subject('c', '10')], p).outcome).toBe('fail');
  });
  it('blocks finalization when marks are missing or withheld', () => {
    const r = calculateStudent([subject('a', '90'), subject('b', null, 'withheld')], policy);
    expect(r.outcome).toBe('incomplete');
    expect(r.blockers).toHaveLength(1);
  });
});
