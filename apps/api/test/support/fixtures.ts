import { expect } from 'vitest';
import { todayIn } from '../../src/platform/dates';
import { bootstrapSchool, signIn, type Client, type TestApp } from './app';

export const TODAY = todayIn('Asia/Karachi');
const year = Number(TODAY.slice(0, 4));
const month = Number(TODAY.slice(5, 7));
/** An academic year (Apr–Mar, Pakistan style) that contains today. */
export const YEAR_START = month >= 4 ? `${year}-04-01` : `${year - 1}-04-01`;
export const YEAR_END = month >= 4 ? `${year + 1}-03-31` : `${year}-03-31`;

export async function ok<T = any>(res: Promise<{ statusCode: number; data: T; body: string }>, status = 200): Promise<T> {
  const r = await res;
  if (r.statusCode !== status) throw new Error(`Expected ${status}, got ${r.statusCode}: ${r.body}`);
  return r.data;
}

/**
 * A realistic pilot school: one active year, Class 9 with sections A and B, compulsory Maths and
 * English, Biology/Computer Science streams, two teachers, and three students.
 */
export async function schoolFixture(t: TestApp, code = 'PILOT') {
  const boot = await bootstrapSchool(t, code);
  const admin = boot.admin;

  const academicYear = await ok(admin.post('/academic-years', { code: 'Y1', name: 'Academic year', startDate: YEAR_START, endDate: YEAR_END }));
  await ok(admin.post(`/academic-years/${academicYear.id}/activate`));

  const g10 = await ok(admin.post('/grade-levels', { code: 'G10', name: 'Class 10', nameUr: 'جماعت دہم', sortOrder: 10, isTerminal: true }));
  const g9 = await ok(admin.post('/grade-levels', { code: 'G9', name: 'Class 9', nameUr: 'جماعت نہم', sortOrder: 9, nextGradeLevelId: g10.id }));

  const maths = await ok(admin.post('/subjects', { code: 'MATH', name: 'Mathematics', nameUr: 'ریاضی' }));
  const english = await ok(admin.post('/subjects', { code: 'ENG', name: 'English' }));
  const biology = await ok(admin.post('/subjects', { code: 'BIO', name: 'Biology' }));
  const cs = await ok(admin.post('/subjects', { code: 'CS', name: 'Computer Science' }));
  const bioStream = await ok(admin.post('/streams', { code: 'BIO', name: 'Biology group' }));
  const csStream = await ok(admin.post('/streams', { code: 'CS', name: 'Computer group' }));

  const curriculum = await ok(
    admin.post('/curricula', {
      gradeLevelId: g9.id,
      name: 'Class 9 (Matric)',
      subjects: [
        { subjectId: maths.id, requirement: 'compulsory' },
        { subjectId: english.id, requirement: 'compulsory' },
        { subjectId: biology.id, requirement: 'elective', streamId: bioStream.id },
        { subjectId: cs.id, requirement: 'elective', streamId: csStream.id },
      ],
    }),
  );
  await ok(admin.patch(`/curricula/${curriculum.id}`, { state: 'active' }));

  const class9 = await ok(
    admin.post('/classes', {
      academicYearId: academicYear.id,
      gradeLevelId: g9.id,
      sections: [
        { code: 'A', name: 'A' },
        { code: 'B', name: 'B' },
      ],
    }),
  );
  const sectionA = class9.sections.find((s: any) => s.code === 'A');
  const sectionB = class9.sections.find((s: any) => s.code === 'B');
  const course = (subjectId: string) => class9.courses.find((c: any) => c.subjectId === subjectId);

  const createTeacher = async (username: string, name: string, employeeNumber: string) => {
    const res = await ok(
      admin.post('/teachers', { username, displayName: name, employeeNumber, employmentStartDate: YEAR_START }),
    );
    const session = await signIn(t, code, username, res.credential.temporaryPassword);
    return { ...res.teacher, client: session.client as Client };
  };
  const teacherA = await createTeacher('t.ayesha', 'Ayesha Khan', 'E-100');
  const teacherB = await createTeacher('t.bilal', 'Bilal Ahmed', 'E-101');

  const createStudent = async (username: string, name: string, admissionNumber: string, sectionId: string, streamId?: string) => {
    const res = await ok(
      admin.post('/students', {
        username,
        displayName: name,
        admissionNumber,
        admissionDate: YEAR_START,
        enrollment: { classOfferingId: class9.id, sectionId, streamId },
        guardians: [{ name: `${name} Sr.`, relationship: 'Father', phone: '+92 300 1234567', isPrimary: true }],
      }),
    );
    expect(res.credential?.temporaryPassword).toBeTruthy();
    const session = await signIn(t, code, username, res.credential.temporaryPassword);
    return { ...res.student, client: session.client as Client };
  };
  const ali = await createStudent('s.ali', 'Ali Raza', 'A-001', sectionA.id, bioStream.id);
  const sara = await createStudent('s.sara', 'Sara Iqbal', 'A-002', sectionA.id, csStream.id);
  const hamza = await createStudent('s.hamza', 'Hamza Tariq', 'B-001', sectionB.id, bioStream.id);

  // Teaching groups: Maths per section, Biology and CS electives in section A.
  const group = async (courseId: string, sectionId: string, groupCode: string, name: string, teacherId: string) => {
    const g = await ok(admin.post('/teaching-groups', { courseOfferingId: courseId, sectionId, code: groupCode, name, effectiveDate: YEAR_START }));
    await ok(admin.post('/teacher-assignments', { teacherId, teachingGroupId: g.id, startDate: YEAR_START }));
    return g;
  };
  const mathsA = await group(course(maths.id).id, sectionA.id, 'MATH-9A', 'Maths 9A', teacherA.id);
  const mathsB = await group(course(maths.id).id, sectionB.id, 'MATH-9B', 'Maths 9B', teacherA.id);
  const bioA = await group(course(biology.id).id, sectionA.id, 'BIO-9A', 'Biology 9A', teacherB.id);
  const csA = await group(course(cs.id).id, sectionA.id, 'CS-9A', 'Computer Science 9A', teacherB.id);

  await ok(admin.post('/class-teacher-assignments', { teacherId: teacherA.id, sectionId: sectionA.id, startDate: YEAR_START }));

  return {
    ...boot,
    code,
    academicYear,
    grades: { g9, g10 },
    subjects: { maths, english, biology, cs },
    streams: { bioStream, csStream },
    class9,
    sectionA,
    sectionB,
    course,
    teachers: { teacherA, teacherB },
    students: { ali, sara, hamza },
    groups: { mathsA, mathsB, bioA, csA },
  };
}

export type SchoolFixture = Awaited<ReturnType<typeof schoolFixture>>;
