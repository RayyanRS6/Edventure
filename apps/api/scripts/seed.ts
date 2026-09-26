/**
 * DEVELOPMENT ONLY: creates a realistic demo school (code DEMO) so the website and the app can be
 * explored immediately. Refuses to run in production. All demo accounts share DEMO_PASSWORD and
 * skip the first-login password change; the demo administrator also skips MFA.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { loadEnvFile, readConfig } from '../src/config';
import { createContainer } from '../src/container';
import { accounts, schools } from '../src/db/schema';
import { actorForAccount } from '../src/platform/actor-loader';
import { addDays, isoWeekday, todayIn } from '../src/platform/dates';

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo-Pass-2026';

loadEnvFile();
const config = readConfig();
if (config.isProduction || config.AUTH_PROVIDER !== 'local') {
  console.error('The demo seed only runs against the local development stack.');
  process.exit(1);
}
const c = await createContainer(config, { role: 'api' });
try {
  const existing = await c.owner.db.select().from(schools).where(eq(schools.code, 'DEMO'));
  if (existing.length) {
    console.log('Demo school already exists. Delete .data/postgres to start over.');
    process.exit(0);
  }
  const { school, credential } = await c.platform.provisionSchool(
    { code: 'DEMO', name: 'Edventure Demo School', nameUr: 'ایڈوینچر ڈیمو اسکول', admin: { username: 'admin', displayName: 'Farah Siddiqui' } },
    'seed',
  );
  const admin = await actorForAccount(c.app.db, school.id, credential.accountId, 'seed');
  const today = todayIn('Asia/Karachi');
  const y = Number(today.slice(0, 4));
  const startYear = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  const year = await c.school.createYear(admin, { code: `${startYear}-${String(startYear + 1).slice(2)}`, name: `Academic year ${startYear}–${startYear + 1}`, startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31` });
  await c.school.activateYear(admin, year.id);
  await c.school.createTerm(admin, year.id, { name: 'First term', nameUr: 'پہلی ٹرم', sequence: 1, startDate: `${startYear}-04-01`, endDate: `${startYear}-09-30` });
  await c.school.createTerm(admin, year.id, { name: 'Second term', nameUr: 'دوسری ٹرم', sequence: 2, startDate: `${startYear}-10-01`, endDate: `${startYear + 1}-03-31` });

  // Classes 1–10 with explicit progression.
  const gradeNames = ['اول', 'دوم', 'سوم', 'چہارم', 'پنجم', 'ششم', 'ہفتم', 'ہشتم', 'نہم', 'دہم'];
  const grades: Record<number, { id: string }> = {};
  for (let n = 10; n >= 1; n--) {
    grades[n] = await c.academics.createGradeLevel(admin, {
      code: `G${n}`,
      name: `Class ${n}`,
      nameUr: `جماعت ${gradeNames[n - 1]}`,
      sortOrder: n,
      isTerminal: n === 10,
      nextGradeLevelId: n === 10 ? null : grades[n + 1]!.id,
    });
  }
  const subjectDefs: Array<[string, string, string]> = [
    ['ENG', 'English', 'انگریزی'],
    ['URDU', 'Urdu', 'اردو'],
    ['MATH', 'Mathematics', 'ریاضی'],
    ['SCI', 'General Science', 'جنرل سائنس'],
    ['ISL', 'Islamiyat', 'اسلامیات'],
    ['PST', 'Pakistan Studies', 'مطالعہ پاکستان'],
    ['COMP', 'Computer', 'کمپیوٹر'],
    ['CHEM', 'Chemistry', 'کیمسٹری'],
    ['PHY', 'Physics', 'فزکس'],
    ['BIO', 'Biology', 'حیاتیات'],
    ['CS', 'Computer Science', 'کمپیوٹر سائنس'],
  ];
  const subj: Record<string, { id: string }> = {};
  for (const [code, name, nameUr] of subjectDefs) subj[code] = await c.academics.createSubject(admin, { code, name, nameUr });
  const bio = await c.academics.createStream(admin, { code: 'BIO', name: 'Biology group', nameUr: 'بائیولوجی گروپ' });
  const csStream = await c.academics.createStream(admin, { code: 'CS', name: 'Computer group', nameUr: 'کمپیوٹر گروپ' });

  const primary = ['ENG', 'URDU', 'MATH', 'SCI', 'ISL', 'COMP'].map((code, i) => ({ subjectId: subj[code]!.id, requirement: 'compulsory' as const, sortOrder: i }));
  const matric = [
    ...['ENG', 'URDU', 'MATH', 'ISL', 'PST', 'CHEM', 'PHY'].map((code, i) => ({ subjectId: subj[code]!.id, requirement: 'compulsory' as const, sortOrder: i })),
    { subjectId: subj['BIO']!.id, requirement: 'elective' as const, streamId: bio.id, sortOrder: 7 },
    { subjectId: subj['CS']!.id, requirement: 'elective' as const, streamId: csStream.id, sortOrder: 8 },
  ];
  for (const [g, subjects] of [[5, primary], [9, matric], [10, matric]] as const) {
    const cur = await c.academics.createCurriculum(admin, { gradeLevelId: grades[g]!.id, name: `Class ${g}`, subjects: [...subjects] });
    await c.academics.updateCurriculum(admin, cur.id, { state: 'active' });
  }
  const class5 = await c.academics.createClassOffering(admin, { academicYearId: year.id, gradeLevelId: grades[5]!.id, sections: [{ code: 'A', name: 'A' }] });
  const class9 = await c.academics.createClassOffering(admin, { academicYearId: year.id, gradeLevelId: grades[9]!.id, sections: [{ code: 'A', name: 'A' }, { code: 'B', name: 'B' }] });
  const class10 = await c.academics.createClassOffering(admin, { academicYearId: year.id, gradeLevelId: grades[10]!.id, sections: [{ code: 'A', name: 'A' }] });

  const teacherDefs: Array<[string, string, string]> = [
    ['t.ayesha', 'Ayesha Khan', 'عائشہ خان'],
    ['t.bilal', 'Bilal Ahmed', 'بلال احمد'],
    ['t.sana', 'Sana Malik', 'ثناء ملک'],
    ['t.imran', 'Imran Qureshi', 'عمران قریشی'],
    ['t.nadia', 'Nadia Hussain', 'نادیہ حسین'],
  ];
  const teacherIds: string[] = [];
  const demoAccountIds: string[] = [credential.accountId];
  for (const [i, [username, name, nameUr]] of teacherDefs.entries()) {
    const res = await c.people.createTeacher(admin, { username, displayName: name, displayNameUr: nameUr, employeeNumber: `E-${101 + i}`, employmentStartDate: year.startDate, jobTitle: 'Teacher' });
    teacherIds.push(res.teacher.id);
    demoAccountIds.push(res.teacher.accountId);
  }

  const first = ['Ali', 'Sara', 'Hamza', 'Zainab', 'Usman', 'Fatima', 'Ahmed', 'Hira', 'Bilal', 'Maryam', 'Hassan', 'Ayesha', 'Omar', 'Iqra', 'Saad', 'Noor'];
  const firstUr = ['علی', 'سارہ', 'حمزہ', 'زینب', 'عثمان', 'فاطمہ', 'احمد', 'حرا', 'بلال', 'مریم', 'حسن', 'عائشہ', 'عمر', 'اقراء', 'سعد', 'نور'];
  const last = ['Raza', 'Iqbal', 'Tariq', 'Noor', 'Farooq', 'Sheikh'];
  const lastUr = ['رضا', 'اقبال', 'طارق', 'نور', 'فاروق', 'شیخ'];
  let n = 0;
  const offerings = [
    { co: class5, perSection: 8 },
    { co: class9, perSection: 8 },
    { co: class10, perSection: 6 },
  ];
  for (const { co, perSection } of offerings) {
    for (const section of co.sections) {
      for (let i = 0; i < perSection; i++) {
        const fi = n % first.length;
        const li = (n * 7) % last.length;
        const matricClass = co.id !== class5.id;
        const res = await c.people.createStudent(admin, {
          username: `${first[fi]!.toLowerCase()}.${last[li]!.toLowerCase()}${n + 1}`,
          displayName: `${first[fi]} ${last[li]}`,
          displayNameUr: `${firstUr[fi]} ${lastUr[li]}`,
          admissionNumber: `S-${String(1001 + n)}`,
          admissionDate: year.startDate,
          gender: fi % 2 === 0 ? 'male' : 'female',
          enrollment: { classOfferingId: co.id, sectionId: section.id, streamId: matricClass ? (i % 2 === 0 ? bio.id : csStream.id) : null },
          guardians: [{ name: `Guardian of ${first[fi]}`, relationship: 'Father', phone: `+92 300 ${String(1000000 + n).slice(0, 7)}`, isPrimary: true }],
        });
        demoAccountIds.push(res.student.accountId);
        n++;
      }
    }
  }

  // Teaching groups per section and subject, assigned round-robin; class teachers per section.
  let t = 0;
  for (const co of [class5, class9, class10]) {
    for (const section of co.sections) {
      for (const course of co.courses) {
        const g = await c.teaching.createGroup(admin, {
          courseOfferingId: course.id,
          sectionId: section.id,
          code: `${course.subjectCode}-${section.code}`,
          name: `${course.subjectName} ${co.gradeName.replace('Class ', '')}${section.code}`,
          effectiveDate: year.startDate,
        });
        await c.teaching.assignTeacher(admin, { teacherId: teacherIds[t % teacherIds.length]!, teachingGroupId: g.id, startDate: year.startDate });
        t++;
      }
    }
  }
  let ct = 0;
  for (const co of [class5, class9, class10]) {
    for (const section of co.sections) {
      await c.teaching.assignClassTeacher(admin, { teacherId: teacherIds[ct % teacherIds.length]!, sectionId: section.id, startDate: year.startDate });
      ct++;
    }
  }

  // Bell schedule and a published, conflict-free timetable (lessons that would clash are skipped).
  const times: Array<[string, string, 'lesson' | 'break']> = [
    ['08:00', '08:40', 'lesson'],
    ['08:40', '09:20', 'lesson'],
    ['09:20', '10:00', 'lesson'],
    ['10:00', '10:30', 'break'],
    ['10:30', '11:10', 'lesson'],
    ['11:10', '11:50', 'lesson'],
    ['11:50', '12:30', 'lesson'],
  ];
  const periods: Array<Awaited<ReturnType<typeof c.timetable.createPeriod>>> = [];
  for (const [i, [start, end, kind]] of times.entries()) {
    periods.push(await c.timetable.createPeriod(admin, { academicYearId: year.id, sequence: i + 1, name: kind === 'break' ? 'Break' : `Period ${periods.filter((p) => p.kind === 'lesson').length + 1}`, startTime: start, endTime: end, kind }));
  }
  const tt = await c.timetable.createVersion(admin, { academicYearId: year.id, name: 'Main timetable' });
  const lessonPeriods = periods.filter((p) => p.kind === 'lesson');
  const groups = await c.teaching.listGroups(admin, { academicYearId: year.id });
  for (const co of [class5, class9, class10]) {
    for (const section of co.sections) {
      const own = groups.filter((g) => g.sectionId === section.id);
      const bioGroup = own.find((g) => g.subjectName === 'Biology');
      const csGroup = own.find((g) => g.subjectName === 'Computer Science');
      const regular = own.filter((g) => g !== bioGroup && g !== csGroup);
      let k = 0;
      for (let weekday = 1; weekday <= 6; weekday++) {
        for (const [pi, period] of lessonPeriods.entries()) {
          // Elective groups (disjoint students) share the last period on alternate days.
          const slot = bioGroup && csGroup && pi === lessonPeriods.length - 1 && weekday % 2 === 1 ? [bioGroup, csGroup] : [regular[k++ % regular.length]!];
          for (const g of slot) {
            await c.timetable.addLesson(admin, tt.id, { weekday, periodDefinitionId: period.id, teachingGroupId: g.id }).catch(() => undefined);
          }
        }
      }
    }
  }
  const draft = await c.timetable.validate(admin, tt.id, year.startDate);
  await c.timetable.publish(admin, tt.id, { effectiveFrom: year.startDate, version: draft.version });

  // Two weeks of roll calls (roughly 92% present) so dashboards and reports have data.
  const allSections = [class5, class9, class10].flatMap((co) => co.sections);
  for (let d = 14; d >= 1; d--) {
    const date = addDays(today, -d);
    if (date < year.startDate || isoWeekday(date) === 7) continue;
    for (const section of allSections) {
      const rc = await c.attendance.getRollCall(admin, section.id, date);
      if (!rc.instructional) continue;
      await c.attendance.saveRollCall(admin, section.id, date, {
        rosterRevision: rc.rosterRevision,
        version: rc.version,
        submit: true,
        entries: rc.entries.map((e, i) => ({ studentId: e.studentId, status: (i + d) % 13 === 0 ? 'absent' : (i + d) % 17 === 0 ? 'late' : 'present' })),
      });
    }
  }

  // Homework, a quiz and a learning announcement.
  const mathsGroup = groups.find((g) => g.subjectName === 'Mathematics' && g.gradeName === 'Class 9' && g.sectionName === 'A')!;
  const mathsTeacher = await actorForAccount(c.app.db, school.id, demoAccountIds[teacherIds.indexOf(mathsGroup.teachers[0]!.teacherId) + 1]!, 'seed');
  await c.homework.create(mathsTeacher, { teachingGroupId: mathsGroup.id, title: 'Quadratic equations — Exercise 2.3', titleUr: 'دو درجی مساواتیں — مشق 2.3', instructions: 'Solve questions 1–10. Show your working.', dueDate: addDays(today, 3), submissionPolicy: 'required', maxScore: '10' });
  await c.homework.create(mathsTeacher, { teachingGroupId: mathsGroup.id, title: 'Revision worksheet', dueDate: addDays(today, 7), submissionPolicy: 'optional' });
  const quiz = await c.quizzes.create(mathsTeacher, {
    teachingGroupId: mathsGroup.id,
    title: 'Algebra check-in',
    timeLimitMinutes: 15,
    questions: [
      { kind: 'mcq', prompt: 'What is the value of x if 2x + 3 = 11?', points: '2', options: [{ text: '3' }, { text: '4', isCorrect: true }, { text: '5' }] },
      { kind: 'mcq', prompt: 'x² − 9 factorises as…', points: '2', options: [{ text: '(x−3)(x+3)', isCorrect: true }, { text: '(x−9)(x+1)' }] },
      { kind: 'short', prompt: 'Explain what a root of an equation is.', points: '3' },
    ],
  });
  await c.quizzes.publish(mathsTeacher, quiz.id);
  await c.comms.createAnnouncement(admin, {
    title: 'Welcome to Edventure',
    titleUr: 'ایڈوینچر میں خوش آمدید',
    body: 'Timetables, homework, results and fee statements are now available in the app.',
    bodyUr: 'ٹائم ٹیبل، ہوم ورک، نتائج اور فیس گوشوارے اب ایپ میں دستیاب ہیں۔',
    category: 'general',
    audiences: [{ target: 'everyone' }],
  });

  // Fees: a monthly plan, this month's invoices, some payments.
  const feeTypes = await c.fees.listFeeTypes(admin);
  const tuition = feeTypes.find((f) => f.code === 'TUITION')!;
  const plan = await c.fees.createPlan(admin, { academicYearId: year.id, name: 'Monthly tuition', frequency: 'monthly', items: [{ feeTypeId: tuition.id, amount: '4500' }] });
  for (const co of [class5, class9, class10]) await c.fees.assignPlan(admin, plan.id, { classOfferingId: co.id, startDate: year.startDate });
  await c.fees.generateInvoices(admin, plan.id, { periodLabel: today.slice(0, 7), issueDate: addDays(today, -15), dueDate: addDays(today, -5) });
  const open = await c.fees.listInvoices(admin, { feeStatus: 'outstanding', limit: 100 });
  for (const [i, inv] of open.items.entries()) {
    if (i % 3 === 0) continue; // a third remain unpaid (and overdue)
    await c.fees.recordPayment(admin, { studentId: inv.studentId, method: i % 2 ? 'bank' : 'cash', amount: i % 5 === 0 ? '2000' : '4500', receivedOn: addDays(today, -2) });
  }
  await c.results.createPolicy(admin, {
    name: 'Demo grading policy',
    passRequirement: { minOverallPercentage: '33', requireAllCompulsoryPass: true, maxFailedSubjects: null },
    bands: [
      { label: 'A+', minPercentage: '80', maxPercentage: '100', gradePoints: '4' },
      { label: 'A', minPercentage: '70', maxPercentage: '80', gradePoints: '3.5' },
      { label: 'B', minPercentage: '60', maxPercentage: '70', gradePoints: '3' },
      { label: 'C', minPercentage: '50', maxPercentage: '60', gradePoints: '2.5' },
      { label: 'D', minPercentage: '33', maxPercentage: '50', gradePoints: '2' },
      { label: 'F', minPercentage: '0', maxPercentage: '33', gradePoints: '0', isPassing: false },
    ],
  });

  // Known development passwords; no forced change; demo admin without MFA.
  const rows = await c.app.db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.school_id', ${school.id}, true)`);
    await tx.update(accounts).set({ mustChangePassword: false, mfaRequired: false }).where(inArray(accounts.id, demoAccountIds));
    return tx.select({ id: accounts.id, authUserId: accounts.authUserId, username: accounts.username }).from(accounts).where(inArray(accounts.id, demoAccountIds));
  });
  for (const r of rows) if (r.authUserId) await c.auth.setPassword(r.authUserId, DEMO_PASSWORD);

  console.log('\nDemo school ready.');
  console.log(`  School code: DEMO    Password for every demo account: ${DEMO_PASSWORD}`);
  console.log('  Administrator: admin');
  console.log(`  Teachers:      ${teacherDefs.map((x) => x[0]).join(', ')}`);
  console.log(`  Students:      e.g. ${rows.filter((r) => /^[a-z]+\.[a-z]+\d+$/.test(r.username)).slice(0, 3).map((r) => r.username).join(', ')}\n`);
} finally {
  await c.close();
}
