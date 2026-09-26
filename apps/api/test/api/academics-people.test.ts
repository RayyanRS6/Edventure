import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../../src/platform/dates';
import { client, createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, type SchoolFixture } from '../support/fixtures';

let t: TestApp;
let f: SchoolFixture;

beforeAll(async () => {
  t = await createTestApp();
  f = await schoolFixture(t);
});
afterAll(async () => {
  await t?.close();
});

describe('academic structure and enrollment', () => {
  it('copies the active curriculum into subject offerings and enrolls students by stream', async () => {
    expect(f.class9.courses.map((c: any) => c.subjectCode).sort()).toEqual(['BIO', 'CS', 'ENG', 'MATH']);
    const aliSubjects = await ok(f.admin.get(`/students/${f.students.ali.id}/subject-enrollments`));
    expect(aliSubjects.items.map((s: any) => s.subjectName).sort()).toEqual(['Biology', 'English', 'Mathematics']);
    const saraSubjects = await ok(f.admin.get(`/students/${f.students.sara.id}/subject-enrollments`));
    expect(saraSubjects.items.map((s: any) => s.subjectName).sort()).toEqual(['Computer Science', 'English', 'Mathematics']);
  });

  it('populates teaching groups from subject enrollments and section placement', async () => {
    const bio = await ok(f.admin.get(`/teaching-groups/${f.groups.bioA.id}/members`));
    expect(bio.items.map((m: any) => m.displayName)).toEqual(['Ali Raza']);
    const mathsA = await ok(f.admin.get(`/teaching-groups/${f.groups.mathsA.id}/members`));
    expect(mathsA.items.map((m: any) => m.displayName).sort()).toEqual(['Ali Raza', 'Sara Iqbal']);
  });

  it('shows class sections with student counts and class teachers', async () => {
    const cls = await ok(f.admin.get(`/classes/${f.class9.id}`));
    const a = cls.sections.find((s: any) => s.code === 'A');
    expect(a.studentCount).toBe(2);
    expect(a.classTeacher.displayName).toBe('Ayesha Khan');
  });

  it('allows only one class teacher per section unless replacing', async () => {
    const dup = await f.admin.post('/class-teacher-assignments', { teacherId: f.teachers.teacherB.id, sectionId: f.sectionA.id, startDate: TODAY });
    expect(dup.statusCode).toBe(409);
    // A teacher may lead several sections.
    await ok(f.admin.post('/class-teacher-assignments', { teacherId: f.teachers.teacherA.id, sectionId: f.sectionB.id, startDate: TODAY }));
    const me = await ok(f.teachers.teacherA.client.get('/me'));
    expect(me.me.classTeacherSectionIds.sort()).toEqual([f.sectionA.id, f.sectionB.id].sort());
  });

  it('previews and applies a stream change without losing history', async () => {
    const effectiveDate = addDays(TODAY, 1);
    const preview = await ok(f.admin.post(`/students/${f.students.hamza.id}/stream-change`, { streamId: f.streams.csStream.id, effectiveDate }));
    expect(preview.applied).toBe(false);
    expect(preview.dropSubjects.map((s: any) => s.subjectName)).toEqual(['Biology']);
    expect(preview.addSubjects.map((s: any) => s.subjectName)).toEqual(['Computer Science']);
    const applied = await ok(f.admin.post(`/students/${f.students.hamza.id}/stream-change`, { streamId: f.streams.csStream.id, effectiveDate, apply: true }));
    expect(applied.applied).toBe(true);
    const subjects = await ok(f.admin.get(`/students/${f.students.hamza.id}/subject-enrollments`));
    const bio = subjects.items.find((s: any) => s.subjectName === 'Biology');
    expect(bio.status).toBe('dropped');
    expect(bio.endDate).toBe(effectiveDate);
  });

  it('moves a student between sections with an effective date and keeps placement history', async () => {
    const effectiveDate = addDays(TODAY, 1);
    await ok(f.admin.post(`/students/${f.students.sara.id}/section-change`, { sectionId: f.sectionB.id, effectiveDate }));
    const history = await ok(f.admin.get(`/students/${f.students.sara.id}/placements`));
    expect(history.items).toHaveLength(2);
    expect(history.items[0]).toMatchObject({ sectionId: f.sectionB.id, startDate: effectiveDate, reason: 'transfer' });
    expect(history.items[1]).toMatchObject({ sectionId: f.sectionA.id, endDate: effectiveDate });
    const mathsB = await ok(f.admin.get(`/teaching-groups/${f.groups.mathsB.id}/members?date=${effectiveDate}`));
    expect(mathsB.items.map((m: any) => m.displayName)).toContain('Sara Iqbal');
  });
});

describe('people and permissions', () => {
  it('searches and filters students', async () => {
    const byName = await ok(f.admin.get('/students?q=ali'));
    expect(byName.items.map((s: any) => s.displayName)).toEqual(['Ali Raza']);
    const bySection = await ok(f.admin.get(`/students?sectionId=${f.sectionA.id}`));
    expect(bySection.items.length).toBeGreaterThanOrEqual(1);
    const paged = await ok(f.admin.get('/students?limit=2'));
    expect(paged.items).toHaveLength(2);
    const next = await ok(f.admin.get(`/students?limit=2&cursor=${paged.nextCursor}`));
    expect(next.items).toHaveLength(1);
  });

  it('gives teachers a minimal roster and hides guardian contacts from non-class-teachers', async () => {
    const roster = await ok(f.teachers.teacherB.client.get('/students'));
    expect(roster.items.map((s: any) => s.displayName).sort()).toEqual(['Ali Raza', 'Sara Iqbal']);
    const detail = await ok(f.teachers.teacherB.client.get(`/students/${f.students.ali.id}`));
    expect(detail.guardians).toEqual([]);
    const asClassTeacher = await ok(f.teachers.teacherA.client.get(`/students/${f.students.ali.id}`));
    expect(asClassTeacher.guardians).toHaveLength(1);
  });

  it('stops students from reading other students or admin data', async () => {
    const other = await f.students.ali.client.get(`/students/${f.students.sara.id}`);
    expect(other.statusCode).toBe(403);
    const own = await f.students.ali.client.get(`/students/${f.students.ali.id}`);
    expect(own.statusCode).toBe(200);
    const list = await f.students.ali.client.get('/students');
    expect(list.statusCode).toBe(403);
    const teachers = await f.students.ali.client.get('/teachers');
    expect(teachers.statusCode).toBe(403);
  });

  it('keeps salary records administrator-only', async () => {
    await ok(f.admin.post(`/teachers/${f.teachers.teacherA.id}/compensation`, { effectiveFrom: TODAY, amount: '95000' }));
    const list = await ok(f.admin.get(`/teachers/${f.teachers.teacherA.id}/compensation`));
    expect(list.items[0].amount).toBe('95000.00');
    const asTeacher = await f.teachers.teacherA.client.get(`/teachers/${f.teachers.teacherA.id}/compensation`);
    expect(asTeacher.statusCode).toBe(403);
  });

  it('suspends app access immediately and reactivates it', async () => {
    const accountId = f.students.hamza.accountId;
    await ok(f.admin.post(`/accounts/${accountId}/suspend`, { reason: 'Parent request' }));
    const blocked = await f.students.hamza.client.get('/me');
    expect(blocked.statusCode).toBe(401);
    await ok(f.admin.post(`/accounts/${accountId}/reactivate`, { reason: 'Resolved' }));
    const login = await client(t.app).post('/auth/login', { schoolCode: f.code, username: 's.hamza', password: 'Str0ng-Passw0rd!' });
    expect(login.statusCode).toBe(200);
  });

  it('keeps a disciplinary suspension separate from app access', async () => {
    await ok(f.admin.post(`/students/${f.students.ali.id}/suspensions`, { startDate: TODAY, endDate: addDays(TODAY, 2), reason: 'Conduct' }));
    const me = await f.students.ali.client.get('/me');
    expect(me.statusCode).toBe(200);
    const detail = await ok(f.admin.get(`/students/${f.students.ali.id}`));
    expect(detail.suspended).toBe(true);
    expect(detail.enrollment.status).toBe('active');
  });

  it('deletes with a recovery window and restores within it', async () => {
    const extra = await ok(
      f.admin.post('/students', {
        username: 's.temp',
        displayName: 'Temporary Student',
        admissionNumber: 'T-900',
        admissionDate: f.academicYear.startDate,
        enrollment: { classOfferingId: f.class9.id, sectionId: f.sectionB.id, streamId: f.streams.bioStream.id },
      }),
    );
    const accountId = extra.student.accountId;
    const preview = await ok(f.admin.get(`/accounts/${accountId}/deletion-preview`));
    const days = (new Date(preview.recoverUntil).getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    const missingConfirm = await f.admin.post(`/accounts/${accountId}/delete`, {});
    expect(missingConfirm.statusCode).toBe(400);
    await ok(f.admin.post(`/accounts/${accountId}/delete`, { confirm: true, reason: 'Admission cancelled' }));
    const hidden = await ok(f.admin.get('/students?q=Temporary'));
    expect(hidden.items).toHaveLength(0);
    // The admission number stays reserved during recovery.
    const reuse = await f.admin.post('/students', {
      username: 's.temp2',
      displayName: 'Another',
      admissionNumber: 'T-900',
      admissionDate: f.academicYear.startDate,
      enrollment: { classOfferingId: f.class9.id, sectionId: f.sectionB.id },
    });
    expect(reuse.statusCode).toBe(409);
    expect(reuse.data.fieldErrors.admissionNumber).toBeDefined();

    const restored = await ok(f.admin.post(`/accounts/${accountId}/restore`));
    expect(restored.restored).toBe(true);
    const detail = await ok(f.admin.get(`/students/${extra.student.id}`));
    expect(detail.accountStatus).toBe('active');
    expect(detail.deletion).toBeNull();
  });

  it('refuses to delete the last administrator', async () => {
    const res = await f.admin.post(`/accounts/${f.adminAccountId}/delete`, { confirm: true });
    expect(res.statusCode).toBe(422);
  });

  it('ends a teacher’s employment, disables access and lists duties to reassign', async () => {
    const created = await ok(f.admin.post('/teachers', { username: 't.leaving', displayName: 'Leaving Teacher', employeeNumber: 'E-900', employmentStartDate: f.academicYear.startDate }));
    await ok(f.admin.post('/teacher-assignments', { teacherId: created.teacher.id, teachingGroupId: f.groups.csA.id, startDate: f.academicYear.startDate }));
    const res = await ok(f.admin.post(`/teachers/${created.teacher.id}/end-employment`, { endDate: TODAY, reason: 'Resigned' }));
    expect(res.unassignedDuties.map((d: any) => d.kind)).toContain('teaching_group');
    const detail = await ok(f.admin.get(`/teachers/${created.teacher.id}`));
    expect(detail.accountStatus).toBe('disabled');
    expect(detail.employmentStatus).toBe('ended');
  });
});
