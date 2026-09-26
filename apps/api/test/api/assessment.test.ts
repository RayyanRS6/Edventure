import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../../src/platform/dates';
import { createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, YEAR_END, type SchoolFixture } from '../support/fixtures';

let t: TestApp;
let f: SchoolFixture;
let cycle: any;
let papers: Record<string, any>;

const bands = [
  { label: 'A+', minPercentage: '80', maxPercentage: '100', gradePoints: '4', isPassing: true },
  { label: 'A', minPercentage: '70', maxPercentage: '80', gradePoints: '3.5', isPassing: true },
  { label: 'B', minPercentage: '60', maxPercentage: '70', gradePoints: '3', isPassing: true },
  { label: 'C', minPercentage: '50', maxPercentage: '60', gradePoints: '2.5', isPassing: true },
  { label: 'D', minPercentage: '33', maxPercentage: '50', gradePoints: '2', isPassing: true },
  { label: 'F', minPercentage: '0', maxPercentage: '33', gradePoints: '0', isPassing: false },
];

beforeAll(async () => {
  t = await createTestApp();
  f = await schoolFixture(t);
});
afterAll(async () => {
  await t?.close();
});

const markRows = async (client: any, paperId: string) => (await ok(client.get(`/exam-papers/${paperId}/marks`))).rows;
const enter = (client: any, paperId: string, rows: any[], scores: Record<string, string | { outcome: string }>, reason?: string) =>
  client.put(`/exam-papers/${paperId}/marks`, {
    reason,
    entries: rows
      .filter((r: any) => scores[r.displayName] !== undefined)
      .map((r: any) => {
        const v = scores[r.displayName]!;
        return typeof v === 'string'
          ? { registrationId: r.registrationId, outcome: 'score', score: v, version: r.version }
          : { registrationId: r.registrationId, outcome: v.outcome, version: r.version };
      }),
  });

describe('exams and marks', () => {
  it('creates a final exam with papers and registers students by subject', async () => {
    cycle = await ok(f.admin.post('/exams', { academicYearId: f.academicYear.id, name: 'Annual examination', kind: 'final', isFinal: true }));
    const created = await ok(
      f.admin.post(`/exams/${cycle.id}/papers`, {
        classOfferingId: f.class9.id,
        papers: ['maths', 'english', 'biology', 'cs'].map((k) => ({
          courseOfferingId: f.course((f.subjects as any)[k].id).id,
          maxMarks: '100',
          passMarks: '33',
        })),
      }),
    );
    papers = Object.fromEntries(created.items.map((p: any) => [p.subjectName, p]));
    expect(papers['Mathematics'].registrationCount).toBe(3);
    expect(papers['Biology'].registrationCount).toBe(2);
    expect(papers['Computer Science'].registrationCount).toBe(1);
  });

  it('publishes a date sheet per student and notifies on reschedule', async () => {
    const withSitting = await ok(
      f.admin.post('/exam-sittings', { examPaperId: papers['Mathematics'].id, date: addDays(TODAY, 3), startTime: '09:00', endTime: '12:00' }),
    );
    await ok(f.admin.post(`/exams/${cycle.id}/state`, { state: 'scheduled', version: cycle.version }));
    const sheet = await ok(f.students.ali.client.get('/date-sheet'));
    expect(sheet.items.map((r: any) => r.subjectName)).toEqual(['Mathematics']);
    await ok(f.admin.post(`/exam-sittings/${withSitting.sittings[0].id}/reschedule`, { date: addDays(TODAY, 4), startTime: '09:00', endTime: '12:00' }));
    const after = await ok(f.students.ali.client.get('/date-sheet'));
    expect(after.items.find((r: any) => r.status === 'scheduled').date).toBe(addDays(TODAY, 4));
    expect(after.items.some((r: any) => r.status === 'rescheduled')).toBe(true);
    const inbox = await ok(f.students.ali.client.get('/notifications'));
    expect(inbox.items.some((n: any) => n.kind === 'exam.rescheduled')).toBe(true);
  });

  it('lets teachers mark only the students they teach, with validation and concurrency checks', async () => {
    const teacherBRows = await markRows(f.teachers.teacherB.client, papers['Biology'].id);
    expect(teacherBRows.map((r: any) => r.displayName)).toEqual(['Ali Raza']);
    const forbidden = await f.teachers.teacherB.client.get(`/exam-papers/${papers['Mathematics'].id}/marks`);
    expect(forbidden.statusCode).toBe(403);

    const maths = await markRows(f.teachers.teacherA.client, papers['Mathematics'].id);
    const tooHigh = await enter(f.teachers.teacherA.client, papers['Mathematics'].id, maths, { 'Ali Raza': '101' });
    expect([400, 422]).toContain(tooHigh.statusCode);
    await ok(enter(f.teachers.teacherA.client, papers['Mathematics'].id, maths, { 'Ali Raza': '85', 'Sara Iqbal': '20', 'Hamza Tariq': '60' }));
    const stale = await enter(f.teachers.teacherA.client, papers['Mathematics'].id, maths, { 'Ali Raza': '86' });
    expect(stale.statusCode).toBe(409);

    await ok(enter(f.teachers.teacherB.client, papers['Biology'].id, teacherBRows, { 'Ali Raza': '75' }));
    const cs = await markRows(f.admin, papers['Computer Science'].id);
    await ok(enter(f.admin, papers['Computer Science'].id, cs, { 'Sara Iqbal': '90' }));
    const english = await markRows(f.admin, papers['English'].id);
    await ok(enter(f.admin, papers['English'].id, english, { 'Ali Raza': '70', 'Sara Iqbal': '65' }));
  });
});

let publication: any;

describe('results', () => {
  it('refuses to invent a pass threshold: a grading policy must be active', async () => {
    const res = await f.admin.post('/results/calculate', { examCycleId: cycle.id, classOfferingId: f.class9.id });
    expect(res.statusCode).toBe(422);
    const bad = await ok(
      f.admin.post('/grading-policies', { name: 'Draft with gap', passRequirement: { minOverallPercentage: '33' }, bands: bands.filter((b) => b.label !== 'C') }),
    );
    expect(bad.problems.length).toBeGreaterThan(0);
    const cannot = await f.admin.post(`/grading-policies/${bad.id}/activate`);
    expect(cannot.statusCode).toBe(422);
    const policy = await ok(f.admin.post('/grading-policies', { name: 'Matric policy', passRequirement: { minOverallPercentage: '33' }, bands, gpaEnabled: true }));
    await ok(f.admin.post(`/grading-policies/${policy.id}/activate`));
  });

  it('previews results with incomplete students blocking publication', async () => {
    publication = await ok(f.admin.post('/results/calculate', { examCycleId: cycle.id, classOfferingId: f.class9.id }));
    expect(publication.state).toBe('draft');
    const hamza = publication.results.find((r: any) => r.displayName === 'Hamza Tariq');
    expect(hamza.outcome).toBe('incomplete');
    const blocked = await f.admin.post(`/results/${publication.id}/publish`, { version: publication.version });
    expect(blocked.statusCode).toBe(422);
  });

  it('publishes complete results and shows them to students', async () => {
    const bio = await markRows(f.admin, papers['Biology'].id);
    await ok(enter(f.admin, papers['Biology'].id, bio, { 'Hamza Tariq': { outcome: 'absent' } }));
    const english = await markRows(f.admin, papers['English'].id);
    await ok(enter(f.admin, papers['English'].id, english, { 'Hamza Tariq': '55' }));
    // Marks changed after the preview: publishing must recalculate first.
    const stale = await f.admin.post(`/results/${publication.id}/publish`, { version: publication.version });
    expect(stale.statusCode).toBe(409);
    publication = await ok(f.admin.post('/results/calculate', { examCycleId: cycle.id, classOfferingId: f.class9.id }));
    const ali = publication.results.find((r: any) => r.displayName === 'Ali Raza');
    expect(ali).toMatchObject({ obtainedMarks: '230.00', totalMarks: '300.00', outcome: 'pass', gradeLabel: 'A' });
    const sara = publication.results.find((r: any) => r.displayName === 'Sara Iqbal');
    expect(sara.outcome).toBe('fail'); // failed compulsory Mathematics
    const hamza = publication.results.find((r: any) => r.displayName === 'Hamza Tariq');
    // Absent counts as a failed subject, but Biology is an elective and the average clears 33%.
    expect(hamza.subjects.find((s: any) => s.subjectName === 'Biology').outcome).toBe('absent');
    expect(hamza).toMatchObject({ outcome: 'pass', failedSubjects: 1, percentage: '38.3333' });

    publication = await ok(f.admin.post(`/results/${publication.id}/publish`, { version: publication.version }));
    expect(publication.state).toBe('published');
    const mine = await ok(f.students.ali.client.get('/results/me'));
    expect(mine.items[0].result.percentage).toBe('76.6667');
    const card = await ok(f.students.ali.client.get(`/results/${publication.id}/report-cards/${f.students.ali.id}`));
    expect(card).toMatchObject({ gradeName: 'Class 9', examCycleName: 'Annual examination', displayDecimals: 2 });
    const peek = await f.students.ali.client.get(`/results/${publication.id}/report-cards/${f.students.sara.id}`);
    expect(peek.statusCode).toBe(403);
  });

  it('corrects published results through a new revision', async () => {
    const edit = await enter(f.admin, papers['Biology'].id, await markRows(f.admin, papers['Biology'].id), { 'Hamza Tariq': '40' });
    expect(edit.statusCode).toBe(422); // published: marks are locked until a correction starts
    const revision = await ok(f.admin.post(`/results/${publication.id}/revise`, { reason: 'Absence was a recording error' }));
    expect(revision.revision).toBe(2);
    await ok(enter(f.admin, papers['Biology'].id, await markRows(f.admin, papers['Biology'].id), { 'Hamza Tariq': '40' }, 'Absence was a recording error'));
    const recalculated = await ok(f.admin.post('/results/calculate', { examCycleId: cycle.id, classOfferingId: f.class9.id }));
    expect(recalculated.id).toBe(revision.id);
    const hamza = recalculated.results.find((r: any) => r.displayName === 'Hamza Tariq');
    expect(hamza).toMatchObject({ failedSubjects: 0, percentage: '51.6667' });
    publication = await ok(f.admin.post(`/results/${revision.id}/publish`, { version: recalculated.version }));
    expect(publication.revision).toBe(2);
    const all = await ok(f.admin.get(`/results?examCycleId=${cycle.id}`));
    expect(all.items.map((p: any) => `${p.revision}:${p.state}`).sort()).toEqual(['1:superseded', '2:published']);
  });
});

describe('promotion', () => {
  let nextYear: any;
  let batch: any;

  it('recommends promote/repeat from final results and needs reasons for overrides', async () => {
    const start = addDays(YEAR_END, 1);
    nextYear = await ok(f.admin.post('/academic-years', { code: 'Y2', name: 'Next year', startDate: start, endDate: addDays(start, 364) }));
    const class10 = await ok(f.admin.post('/classes', { academicYearId: nextYear.id, gradeLevelId: f.grades.g10.id, sections: [{ code: 'A', name: 'A' }, { code: 'B', name: 'B' }] }));
    await ok(f.admin.post('/classes', { academicYearId: nextYear.id, gradeLevelId: f.grades.g9.id, sections: [{ code: 'A', name: 'A' }] }));
    batch = await ok(f.admin.post('/promotion-batches', { resultPublicationId: publication.id, targetAcademicYearId: nextYear.id }));
    const byName = Object.fromEntries(batch.decisions.map((d: any) => [d.displayName, d]));
    expect(byName['Ali Raza']).toMatchObject({ recommendation: 'promote', decision: 'promote', destinationSectionName: 'A' });
    expect(byName['Sara Iqbal']).toMatchObject({ recommendation: 'repeat', decision: 'repeat' });
    expect(byName['Hamza Tariq'].destinationSectionId).toBe(class10.sections.find((s: any) => s.code === 'B').id);

    const noReason = await f.admin.patch(`/promotion-decisions/${byName['Sara Iqbal'].id}`, { decision: 'promote', version: byName['Sara Iqbal'].version });
    expect(noReason.statusCode).toBe(400);
    batch = await ok(
      f.admin.patch(`/promotion-decisions/${byName['Sara Iqbal'].id}`, {
        decision: 'promote',
        overrideReason: 'Passed the supplementary Mathematics exam',
        destinationSectionId: class10.sections[0].id,
        version: byName['Sara Iqbal'].version,
      }),
    );
    expect(batch.decisions.find((d: any) => d.displayName === 'Sara Iqbal').decision).toBe('promote');
  });

  it('executes idempotently, creating next-year enrollments without touching history', async () => {
    batch = await ok(f.admin.post(`/promotion-batches/${batch.id}/approve`, { version: batch.version }));
    const key = { 'idempotency-key': 'promote-class9-000001' };
    const first = await ok(f.admin.post(`/promotion-batches/${batch.id}/execute`, {}, key));
    expect(first.created).toBe(3);
    const replay = await ok(f.admin.post(`/promotion-batches/${batch.id}/execute`, {}, key));
    expect(replay.created).toBe(3);
    const again = await ok(f.admin.post(`/promotion-batches/${batch.id}/execute`));
    expect(again.created).toBe(0);
    const history = await ok(f.admin.get(`/students/${f.students.ali.id}/enrollments`));
    expect(history.items.map((e: any) => `${e.academicYearCode}:${e.gradeName}:${e.status}`)).toEqual(['Y2:Class 10:active', 'Y1:Class 9:completed']);
    // Streams carry over so Biology remains Ali's default elective.
    expect(history.items[0].streamName).toBe('Biology group');
  });
});
