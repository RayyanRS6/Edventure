/**
 * Result calculation. Pure and deterministic so the rules can be unit-tested and published results
 * can be reproduced from their input snapshot. All arithmetic is exact (decimal.js); grade and pass
 * thresholds are applied to exact values before any display rounding.
 */
import { D, type Dec } from '../../platform/decimal';

export type MarkOutcome = 'score' | 'absent' | 'exempt' | 'withheld' | 'missing';
export type AbsentRule = 'fail' | 'zero' | 'exclude';

export interface Band {
  label: string;
  minPercentage: string;
  maxPercentage: string;
  gradePoints: string | null;
  isPassing: boolean;
}

export interface Policy {
  minOverallPercentage: string;
  requireAllCompulsoryPass: boolean;
  maxFailedSubjects: number | null;
  absentRule: AbsentRule;
  gpaEnabled: boolean;
  bands: Band[];
}

export interface Component {
  /** Relative weight of this exam cycle (1 for a single-cycle result). */
  weight: string;
  outcome: MarkOutcome;
  score: string | null;
  maxMarks: string;
  passMarks: string;
}

export interface SubjectInput {
  courseOfferingId: string;
  compulsory: boolean;
  credit: string | null;
  /** Max marks of the primary (published) paper; used to express the weighted result in marks. */
  displayMaxMarks: string;
  components: Component[];
}

export interface SubjectResult {
  courseOfferingId: string;
  obtainedMarks: string | null;
  maxMarks: string;
  percentage: string | null;
  gradeLabel: string | null;
  gradePoints: string | null;
  outcome: 'pass' | 'fail' | 'absent' | 'exempt' | 'incomplete';
}

export interface StudentResult {
  obtainedMarks: string | null;
  totalMarks: string | null;
  percentage: string | null;
  gradeLabel: string | null;
  gpa: string | null;
  outcome: 'pass' | 'fail' | 'incomplete';
  failedSubjects: number;
  subjects: SubjectResult[];
  /** Reasons finalization is blocked (missing or withheld marks). */
  blockers: string[];
}

/** Validates that bands cover 0–100 without gaps or overlaps. */
export function validateBands(bands: Band[]): string[] {
  const problems: string[] = [];
  if (!bands.length) return ['Add at least one grade band'];
  const sorted = [...bands].sort((a, b) => new D(a.minPercentage).cmp(b.minPercentage));
  if (!new D(sorted[0]!.minPercentage).eq(0)) problems.push('The lowest band must start at 0%');
  if (!new D(sorted[sorted.length - 1]!.maxPercentage).eq(100)) problems.push('The highest band must end at 100%');
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const cmp = new D(prev.maxPercentage).cmp(cur.minPercentage);
    if (cmp < 0) problems.push(`Gap between ${prev.label} and ${cur.label}`);
    if (cmp > 0) problems.push(`${prev.label} overlaps ${cur.label}`);
  }
  for (const b of bands) if (new D(b.maxPercentage).lte(b.minPercentage)) problems.push(`${b.label} has an empty range`);
  return problems;
}

/** `[min, max)` with the top band including 100. */
export function bandFor(percentage: Dec, bands: Band[]): Band | null {
  for (const b of bands) {
    const min = new D(b.minPercentage);
    const max = new D(b.maxPercentage);
    if (percentage.gte(min) && (percentage.lt(max) || (max.eq(100) && percentage.eq(100)))) return b;
  }
  return null;
}

const pctOf = (score: string, max: string) => new D(score).div(max).mul(100);

export function calculateSubject(input: SubjectInput, policy: Policy): SubjectResult {
  const base = { courseOfferingId: input.courseOfferingId, maxMarks: new D(input.displayMaxMarks).toFixed(2) };
  if (input.components.some((c) => c.outcome === 'missing' || c.outcome === 'withheld')) {
    return { ...base, obtainedMarks: null, percentage: null, gradeLabel: null, gradePoints: null, outcome: 'incomplete' };
  }
  let weightSum = new D(0);
  let weightedPct = new D(0);
  let weightedPass = new D(0);
  let absentFail = false;
  for (const c of input.components) {
    if (c.outcome === 'exempt') continue;
    if (c.outcome === 'absent') {
      if (policy.absentRule === 'exclude') continue;
      if (policy.absentRule === 'fail') absentFail = true;
    }
    const w = new D(c.weight);
    const pct = c.outcome === 'score' ? pctOf(c.score ?? '0', c.maxMarks) : new D(0);
    weightSum = weightSum.plus(w);
    weightedPct = weightedPct.plus(pct.mul(w));
    weightedPass = weightedPass.plus(pctOf(c.passMarks, c.maxMarks).mul(w));
  }
  if (weightSum.eq(0)) {
    return { ...base, obtainedMarks: null, percentage: null, gradeLabel: null, gradePoints: null, outcome: 'exempt' };
  }
  const percentage = weightedPct.div(weightSum);
  const passPercentage = weightedPass.div(weightSum);
  const band = bandFor(percentage, policy.bands);
  const obtained = percentage.div(100).mul(input.displayMaxMarks);
  const outcome = absentFail ? 'absent' : percentage.gte(passPercentage) ? 'pass' : 'fail';
  return {
    ...base,
    obtainedMarks: obtained.toFixed(2),
    percentage: percentage.toFixed(4),
    gradeLabel: band?.label ?? null,
    gradePoints: band?.gradePoints ?? null,
    outcome,
  };
}

export function calculateStudent(subjects: SubjectInput[], policy: Policy): StudentResult {
  const results = subjects.map((s) => calculateSubject(s, policy));
  const blockers = results.filter((r) => r.outcome === 'incomplete').map((r) => `Missing or withheld marks for subject ${r.courseOfferingId}`);
  const failed = results.filter((r) => r.outcome === 'fail' || r.outcome === 'absent');
  if (blockers.length) {
    return { obtainedMarks: null, totalMarks: null, percentage: null, gradeLabel: null, gpa: null, outcome: 'incomplete', failedSubjects: failed.length, subjects: results, blockers };
  }
  const counted = results.filter((r) => r.outcome !== 'exempt');
  if (!counted.length) {
    return { obtainedMarks: null, totalMarks: null, percentage: null, gradeLabel: null, gpa: null, outcome: 'incomplete', failedSubjects: 0, subjects: results, blockers: ['No assessed subjects'] };
  }
  const obtained = counted.reduce((acc, r) => acc.plus(r.obtainedMarks ?? 0), new D(0));
  const total = counted.reduce((acc, r) => acc.plus(r.maxMarks), new D(0));
  const percentage = obtained.div(total).mul(100);
  const band = bandFor(percentage, policy.bands);

  let gpa: string | null = null;
  if (policy.gpaEnabled) {
    let points = new D(0);
    let credits = new D(0);
    for (const r of counted) {
      const subject = subjects.find((s) => s.courseOfferingId === r.courseOfferingId)!;
      const credit = new D(subject.credit ?? 1);
      points = points.plus(new D(r.gradePoints ?? 0).mul(credit));
      credits = credits.plus(credit);
    }
    gpa = credits.gt(0) ? points.div(credits).toFixed(3) : null;
  }

  const compulsoryFailed = counted.some((r) => (r.outcome === 'fail' || r.outcome === 'absent') && subjects.find((s) => s.courseOfferingId === r.courseOfferingId)!.compulsory);
  const pass =
    percentage.gte(policy.minOverallPercentage) &&
    !(policy.requireAllCompulsoryPass && compulsoryFailed) &&
    (policy.maxFailedSubjects === null || failed.length <= policy.maxFailedSubjects);

  return {
    obtainedMarks: obtained.toFixed(2),
    totalMarks: total.toFixed(2),
    percentage: percentage.toFixed(4),
    gradeLabel: band?.label ?? null,
    gpa,
    outcome: pass ? 'pass' : 'fail',
    failedSubjects: failed.length,
    subjects: results,
    blockers: [],
  };
}

/** Display rounding happens only at presentation time. */
export const display = (value: string | null, decimals: number) => (value === null ? null : new D(value).toFixed(decimals));
