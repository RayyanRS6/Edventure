import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, isoWeekday } from '../../src/platform/dates';
import { createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, type SchoolFixture } from '../support/fixtures';

let t: TestApp;
let f: SchoolFixture;
let periods: any[];
let version: any;

beforeAll(async () => {
  t = await createTestApp();
  f = await schoolFixture(t);
  // Make today and the next two days instructional regardless of the real weekday.
  for (const d of [TODAY, addDays(TODAY, 1), addDays(TODAY, 2)]) {
    await ok(f.admin.put('/calendar', { date: d, kind: 'instructional', title: 'School day' }));
  }
  periods = [];
  for (const [i, [start, end]] of [['08:00', '08:40'], ['08:40', '09:20'], ['09:20', '10:00']].entries()) {
    periods.push(await ok(f.admin.post('/periods', { academicYearId: f.academicYear.id, sequence: i + 1, name: `P${i + 1}`, startTime: start, endTime: end })));
  }
});
afterAll(async () => {
  await t?.close();
});

const weekday = () => isoWeekday(TODAY);

describe('timetables', () => {
  it('drafts lessons, prevents double-booked teachers and allows disjoint electives in one slot', async () => {
    version = await ok(f.admin.post('/timetables', { academicYearId: f.academicYear.id, name: 'Term 1' }));
    await ok(f.admin.post(`/timetables/${version.id}/lessons`, { weekday: weekday(), periodDefinitionId: periods[0].id, teachingGroupId: f.groups.mathsA.id }));
    const clash = await f.admin.post(`/timetables/${version.id}/lessons`, { weekday: weekday(), periodDefinitionId: periods[0].id, teachingGroupId: f.groups.mathsB.id });
    expect(clash.statusCode).toBe(409);
    // Biology 9A and Computer Science 9A share P2: their students are disjoint.
    await ok(f.admin.post(`/timetables/${version.id}/lessons`, { weekday: weekday(), periodDefinitionId: periods[1].id, teachingGroupId: f.groups.bioA.id }));
    version = await ok(
      f.admin.post(`/timetables/${version.id}/lessons`, {
        weekday: weekday(),
        periodDefinitionId: periods[1].id,
        teachingGroupId: f.groups.csA.id,
        teacherId: f.teachers.teacherA.id,
      }),
    );
    const validated = await ok(f.admin.post(`/timetables/${version.id}/validate`, {}));
    expect(validated.conflicts).toEqual([]);
  });

  it('detects students scheduled in two groups at once and blocks publication', async () => {
    const draft = await ok(f.admin.post('/timetables', { academicYearId: f.academicYear.id, name: 'Clash test', copyFromVersionId: version.id }));
    await ok(f.admin.post(`/timetables/${draft.id}/lessons`, { weekday: weekday(), periodDefinitionId: periods[2].id, teachingGroupId: f.groups.mathsA.id }));
    const withClash = await ok(
      f.admin.post(`/timetables/${draft.id}/lessons`, {
        weekday: weekday(),
        periodDefinitionId: periods[2].id,
        teachingGroupId: f.groups.bioA.id,
      }),
    );
    const res = await f.admin.post(`/timetables/${draft.id}/publish`, { effectiveFrom: TODAY, version: withClash.version });
    expect(res.statusCode).toBe(422);
    expect(res.data.details.conflicts[0].kind).toBe('student');
    await ok(f.admin.delete(`/timetables/${draft.id}`));
  });

  it('publishes and serves day views to students and teachers', async () => {
    const current = await ok(f.admin.get(`/timetables/${version.id}`));
    const published = await ok(f.admin.post(`/timetables/${version.id}/publish`, { effectiveFrom: TODAY, version: current.version }));
    expect(published.status).toBe('published');
    const aliDay = await ok(f.students.ali.client.get(`/schedule/day?date=${TODAY}`));
    expect(aliDay.lessons.map((l: any) => l.subjectName)).toEqual(['Mathematics', 'Biology']);
    const saraDay = await ok(f.students.sara.client.get(`/schedule/day?date=${TODAY}`));
    expect(saraDay.lessons.map((l: any) => l.subjectName)).toEqual(['Mathematics', 'Computer Science']);
    const teacherDay = await ok(f.teachers.teacherA.client.get(`/schedule/day?date=${TODAY}`));
    expect(teacherDay.lessons.map((l: any) => l.periodName)).toEqual(['P1', 'P2']);
    const notifications = await ok(f.students.ali.client.get('/notifications'));
    expect(notifications.items.some((n: any) => n.kind === 'timetable.published')).toBe(true);
  });

  it('rejects membership changes that would clash in the published timetable', async () => {
    // Moving Ali into CS 9A would put him in Biology and CS in the same period.
    await ok(f.admin.post(`/students/${f.students.ali.id}/subject-enrollments`, { effectiveDate: TODAY, add: [f.course(f.subjects.cs.id).id] })).catch(() => null);
    const res = await f.admin.post(`/teaching-groups/${f.groups.csA.id}/members`, { effectiveDate: TODAY, add: [f.students.ali.id] });
    expect([409, 422]).toContain(res.statusCode);
  });

  it('applies substitutions to the day view', async () => {
    const tt = await ok(f.admin.get(`/timetables/${version.id}`));
    const bioLesson = tt.lessons.find((l: any) => l.teachingGroupId === f.groups.bioA.id);
    await ok(f.admin.post('/lesson-exceptions', { timetableLessonId: bioLesson.id, date: TODAY, kind: 'substitution', substituteTeacherId: f.teachers.teacherA.id }));
    const day = await ok(f.students.ali.client.get(`/schedule/day?date=${TODAY}`));
    const bio = day.lessons.find((l: any) => l.subjectName === 'Biology');
    expect(bio.status).toBe('substituted');
    expect(bio.teacherName).toBe('Ayesha Khan');
  });
});

describe('daily roll call', () => {
  let rc: any;

  it('lets the class teacher load the roster; others are refused', async () => {
    const tasks = await ok(f.teachers.teacherA.client.get('/attendance/roll-call-tasks'));
    expect(tasks.items.map((x: any) => x.sectionId)).toContain(f.sectionA.id);
    rc = await ok(f.teachers.teacherA.client.get(`/attendance/sections/${f.sectionA.id}/${TODAY}`));
    expect(rc.state).toBe('not_started');
    expect(rc.entries.map((e: any) => e.displayName)).toEqual(['Ali Raza', 'Sara Iqbal']);
    const other = await f.teachers.teacherB.client.get(`/attendance/sections/${f.sectionA.id}/${TODAY}`);
    expect(other.statusCode).toBe(403);
  });

  it('keeps partial roll calls as drafts and rejects incomplete or stale submissions', async () => {
    const [ali, sara] = rc.entries;
    rc = await ok(
      f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, {
        rosterRevision: rc.rosterRevision,
        version: rc.version,
        entries: [{ studentId: ali.studentId, status: 'present' }],
      }),
    );
    expect(rc.state).toBe('draft');
    const incomplete = await f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, {
      rosterRevision: rc.rosterRevision,
      version: rc.version,
      entries: [{ studentId: ali.studentId, status: 'present' }],
      submit: true,
    });
    expect(incomplete.statusCode).toBe(422);
    const stale = await f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, {
      rosterRevision: 'stale-revision-000',
      version: rc.version,
      entries: [
        { studentId: ali.studentId, status: 'present' },
        { studentId: sara.studentId, status: 'absent' },
      ],
      submit: true,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.data.details.reason).toBe('roster_changed');
  });

  it('submits idempotently, then allows a same-day correction with history', async () => {
    const [ali, sara] = rc.entries;
    const body = {
      rosterRevision: rc.rosterRevision,
      version: rc.version,
      entries: [
        { studentId: ali.studentId, status: 'present' },
        { studentId: sara.studentId, status: 'absent' },
      ],
      submit: true,
    };
    const key = { 'idempotency-key': 'rollcall-submit-0001' };
    const first = await ok(f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, body, key));
    const replay = await ok(f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, body, key));
    expect(first.state).toBe('submitted');
    expect(replay.version).toBe(first.version);

    const corrected = await ok(
      f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${TODAY}`, {
        ...body,
        version: first.version,
        entries: [
          { studentId: ali.studentId, status: 'present' },
          { studentId: sara.studentId, status: 'late' },
        ],
      }),
    );
    expect(corrected.entries.find((e: any) => e.studentId === sara.studentId).status).toBe('late');
  });

  it('reports attendance rate, excluding excused days, and "no data" when nothing is recorded', async () => {
    const ali = await ok(f.students.ali.client.get(`/attendance/students/${f.students.ali.id}/report?from=${TODAY}&to=${TODAY}`));
    expect(ali.summary).toMatchObject({ present: 1, rate: '100.00' });
    const hamza = await ok(f.admin.get(`/attendance/students/${f.students.hamza.id}/report?from=${TODAY}&to=${TODAY}`));
    expect(hamza.summary.rate).toBeNull();
    expect(hamza.summary.completeness).toBe('0.00');
    const section = await ok(f.teachers.teacherA.client.get(`/attendance/sections/${f.sectionA.id}/report?from=${TODAY}&to=${TODAY}`));
    expect(section.overall).toMatchObject({ present: 1, late: 1, rate: '100.00', completeness: '100.00' });
  });

  it('lets a delegated substitute take another section’s roll call', async () => {
    const before = await f.teachers.teacherB.client.get(`/attendance/sections/${f.sectionB.id}/${TODAY}`);
    expect(before.statusCode).toBe(403);
    await ok(f.admin.post('/attendance-delegations', { sectionId: f.sectionB.id, teacherId: f.teachers.teacherB.id, startDate: TODAY, lastDate: TODAY }));
    const after = await ok(f.teachers.teacherB.client.get(`/attendance/sections/${f.sectionB.id}/${TODAY}`));
    expect(after.entries.map((e: any) => e.displayName)).toEqual(['Hamza Tariq']);
  });

  it('refuses teacher edits of past days but allows audited administrator corrections', async () => {
    const past = await f.teachers.teacherA.client.put(`/attendance/sections/${f.sectionA.id}/${addDays(TODAY, -1)}`, {
      rosterRevision: rc.rosterRevision,
      version: null,
      entries: [],
    });
    expect(past.statusCode).toBe(403);
    const noReason = await f.admin.post('/attendance/students/corrections', { studentId: f.students.sara.id, date: TODAY, status: 'present' });
    expect(noReason.statusCode).toBe(400);
    await ok(f.admin.post('/attendance/students/corrections', { studentId: f.students.sara.id, date: TODAY, status: 'present', reason: 'Arrived before bell' }));
  });
});

describe('leave', () => {
  it('approves leave as excused days without overwriting recorded attendance, and reverses only its own records on cancel', async () => {
    const types = await ok(f.students.sara.client.get('/leave-types'));
    const sick = types.items.find((x: any) => x.code === 'SICK');
    const request = await ok(
      f.students.sara.client.post('/leave-requests', { leaveTypeId: sick.id, startDate: TODAY, endDate: addDays(TODAY, 1), reason: 'Fever' }),
    );
    expect(request.state).toBe('pending');
    const adminInbox = await ok(f.admin.get('/notifications'));
    expect(adminInbox.items.some((n: any) => n.kind === 'leave.requested')).toBe(true);

    const decision = await ok(f.admin.post(`/leave-requests/${request.id}/decision`, { decision: 'approve', version: request.version }));
    expect(decision.request.state).toBe('approved');
    // Today already has a present record: kept and flagged. Tomorrow becomes excused.
    expect(decision.conflicts).toEqual([{ date: TODAY, status: 'present' }]);
    expect(decision.excusedDaysCreated).toBe(1);
    const report = await ok(f.admin.get(`/attendance/students/${f.students.sara.id}/report?from=${TODAY}&to=${addDays(TODAY, 1)}`));
    expect(report.days.map((d: any) => d.status)).toEqual(['present', 'excused']);

    const cancelled = await ok(f.admin.post(`/leave-requests/${request.id}/cancel`));
    expect(cancelled.state).toBe('cancelled');
    const after = await ok(f.admin.get(`/attendance/students/${f.students.sara.id}/report?from=${TODAY}&to=${addDays(TODAY, 1)}`));
    expect(after.days.map((d: any) => d.status)).toEqual(['present']);
    const saraInbox = await ok(f.students.sara.client.get('/notifications'));
    expect(saraInbox.items.some((n: any) => n.kind === 'leave.decided')).toBe(true);
  });

  it('rejects overlapping requests and lets teachers request their own leave', async () => {
    const types = await ok(f.teachers.teacherB.client.get('/leave-types'));
    const casual = types.items.find((x: any) => x.code === 'CASUAL');
    await ok(f.teachers.teacherB.client.post('/leave-requests', { leaveTypeId: casual.id, startDate: addDays(TODAY, 2), endDate: addDays(TODAY, 2), reason: 'Family' }));
    const overlap = await f.teachers.teacherB.client.post('/leave-requests', { leaveTypeId: casual.id, startDate: addDays(TODAY, 2), endDate: addDays(TODAY, 3), reason: 'Again' });
    expect(overlap.statusCode).toBe(409);
    const mine = await ok(f.teachers.teacherB.client.get('/leave-requests'));
    expect(mine.items).toHaveLength(1);
  });
});

describe('teacher attendance', () => {
  it('is recorded by administrators and summarized in the daily overview', async () => {
    const day = await ok(f.admin.get(`/attendance/teachers?date=${TODAY}`));
    expect(day.entries.length).toBeGreaterThanOrEqual(2);
    await ok(
      f.admin.put('/attendance/teachers', {
        date: TODAY,
        entries: day.entries.map((e: any) => ({ teacherId: e.teacherId, status: e.teacherId === f.teachers.teacherB.id ? 'absent' : 'present' })),
      }),
    );
    const overview = await ok(f.admin.get(`/attendance/overview?date=${TODAY}`));
    expect(overview.teachers.absent).toBe(1);
    const a = overview.sections.find((s: any) => s.sectionId === f.sectionA.id);
    expect(a.state).toBe('submitted');
    const teacherCannot = await f.teachers.teacherA.client.get(`/attendance/teachers?date=${TODAY}`);
    expect(teacherCannot.statusCode).toBe(403);
  });
});
