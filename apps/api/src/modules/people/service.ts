import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import type { IssuedCredential, StudentDetail, StudentListItem, TeacherDetail, TeacherListItem } from '@edventure/contracts';
import {
  createAdminRequest,
  createCompensationRequest,
  createStudentRequest,
  createTeacherRequest,
  endEmploymentRequest,
  studentListQuery,
  suspensionRequest,
  teacherListQuery,
  updateStudentRequest,
  updateTeacherRequest,
  type GuardianInput,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accountRoles,
  accounts,
  appSessions,
  classOfferings,
  classTeacherAssignments,
  compensationRecords,
  courseOfferings,
  deletionRequests,
  disciplinarySuspensions,
  employmentRecords,
  gradeLevels,
  guardians,
  schoolPolicies,
  sections,
  studentCourseEnrollments,
  studentEnrollments,
  studentGuardians,
  studentPlacements,
  students,
  subjects,
  teacherAssignments,
  teachers,
  teachingGroups,
  timetableLessons,
  timetableVersions,
  attendanceDelegations,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import type { AuthProvider } from '../../auth/provider';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { addDays } from '../../platform/dates';
import { dec } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { activeOn, assertCanViewStudent, requireAdmin, today } from '../../platform/scope';
import type { EnrollmentService } from '../academics/enrollment';
import { toAccountSummary, type AccountService } from './accounts';

type GuardianParsed = z.infer<typeof createStudentRequest>['guardians'][number];

export class PeopleService {
  constructor(
    private readonly db: Db,
    private readonly accounts: AccountService,
    private readonly enrollment: EnrollmentService,
    private readonly auth: AuthProvider,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ======================= Students ======================= */

  async createStudent(actor: Actor, raw: z.input<typeof createStudentRequest>) {
    requireAdmin(actor);
    const input = createStudentRequest.parse(raw);
    const { studentId, accountId } = await this.run(actor, async (tx) => {
      const account = await this.accounts.createPending(tx, actor, {
        username: input.username,
        displayName: input.displayName,
        displayNameUr: input.displayNameUr,
        roles: ['student'],
      });
      const [student] = await tx
        .insert(students)
        .values({
          schoolId: actor.schoolId,
          accountId: account.id,
          admissionNumber: input.admissionNumber,
          admissionDate: input.admissionDate,
          gender: input.gender ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      await this.replaceGuardians(tx, actor, student!.id, input.guardians);
      await this.enrollment.enroll(tx, actor, student!.id, {
        classOfferingId: input.enrollment.classOfferingId,
        sectionId: input.enrollment.sectionId,
        streamId: input.enrollment.streamId ?? null,
        startDate: input.enrollment.startDate ?? input.admissionDate,
      });
      await audit(tx, actor, {
        action: 'student.created',
        entityType: 'student',
        entityId: student!.id,
        summary: { admissionNumber: input.admissionNumber },
      });
      return { studentId: student!.id, accountId: account.id };
    });
    const { credential, provisioningError } = await this.issueInitial(actor, accountId);
    return { student: await this.getStudent(actor, studentId), credential, provisioningError };
  }

  private async issueInitial(actor: Actor, accountId: string): Promise<{ credential: IssuedCredential | null; provisioningError: string | null }> {
    try {
      return { credential: await this.accounts.issueCredential(actor, accountId), provisioningError: null };
    } catch (e) {
      return { credential: null, provisioningError: e instanceof Error ? e.message : 'Sign-in could not be set up yet' };
    }
  }

  private async replaceGuardians(tx: Tx, actor: Actor, studentId: string, list: GuardianParsed[] | GuardianInput[]) {
    const existing = await tx.select().from(studentGuardians).where(eq(studentGuardians.studentId, studentId));
    await tx.delete(studentGuardians).where(eq(studentGuardians.studentId, studentId));
    for (const g of list as GuardianParsed[]) {
      let guardianId = g.id;
      if (guardianId && existing.some((e) => e.guardianId === guardianId)) {
        await tx
          .update(guardians)
          .set({
            name: g.name,
            nameUr: g.nameUr ?? null,
            phone: g.phone ?? null,
            altPhone: g.altPhone ?? null,
            email: g.email ?? null,
            address: g.address ?? null,
            occupation: g.occupation ?? null,
          })
          .where(eq(guardians.id, guardianId));
      } else {
        const [row] = await tx
          .insert(guardians)
          .values({
            schoolId: actor.schoolId,
            name: g.name,
            nameUr: g.nameUr ?? null,
            phone: g.phone ?? null,
            altPhone: g.altPhone ?? null,
            email: g.email ?? null,
            address: g.address ?? null,
            occupation: g.occupation ?? null,
          })
          .returning();
        guardianId = row!.id;
      }
      await tx.insert(studentGuardians).values({
        schoolId: actor.schoolId,
        studentId,
        guardianId,
        relationship: g.relationship,
        isPrimary: g.isPrimary ?? false,
        isEmergency: g.isEmergency ?? false,
      });
    }
  }

  async updateStudent(actor: Actor, studentId: string, raw: z.input<typeof updateStudentRequest>) {
    requireAdmin(actor);
    const input = updateStudentRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx
        .update(students)
        .set({
          ...(input.admissionNumber ? { admissionNumber: input.admissionNumber } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          version: sql`${students.version} + 1`,
        })
        .where(and(eq(students.id, studentId), eq(students.version, input.version)))
        .returning();
      if (!row) throw errors.version();
      if (input.displayName || input.displayNameUr !== undefined) {
        await tx
          .update(accounts)
          .set({
            ...(input.displayName ? { displayName: input.displayName } : {}),
            ...(input.displayNameUr !== undefined ? { displayNameUr: input.displayNameUr } : {}),
          })
          .where(eq(accounts.id, row.accountId));
      }
      if (input.guardians) await this.replaceGuardians(tx, actor, studentId, input.guardians);
      await audit(tx, actor, {
        action: 'student.updated',
        entityType: 'student',
        entityId: studentId,
        summary: { fields: Object.keys(input).filter((k) => k !== 'version') },
      });
    });
    return this.getStudent(actor, studentId);
  }

  async listStudents(actor: Actor, rawQuery: z.input<typeof studentListQuery>) {
    const q = studentListQuery.parse(rawQuery);
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const conditions: SQL[] = [];
      if (!isAdmin(actor)) {
        // Teachers see the minimal roster: students they teach or whose section they lead.
        if (!actor.teacherId) throw errors.forbidden();
        conditions.push(sql`(exists (
            select 1 from app.teaching_group_memberships m join app.teacher_assignments a on a.teaching_group_id = m.teaching_group_id
            where m.student_id = ${students.id} and a.teacher_id = ${actor.teacherId}
              and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date})
              and a.start_date <= ${date} and (a.end_date is null or a.end_date > ${date}))
          or exists (
            select 1 from app.student_placements p join app.class_teacher_assignments c on c.section_id = p.section_id
            where p.student_id = ${students.id} and c.teacher_id = ${actor.teacherId}
              and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date})
              and c.start_date <= ${date} and (c.end_date is null or c.end_date > ${date})))`);
      }
      if (q.includeDeleted !== 'true' || !isAdmin(actor)) conditions.push(sql`${accounts.status} <> 'pending_deletion'`);
      if (q.q) {
        const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        conditions.push(
          sql`(${accounts.displayName} ilike ${like} or ${accounts.displayNameUr} ilike ${like} or ${students.admissionNumber} ilike ${like} or ${accounts.username} ilike ${like})`,
        );
      }
      if (q.accountStatus) conditions.push(eq(accounts.status, q.accountStatus));
      if (q.academicYearId || q.classOfferingId || q.enrollmentStatus) {
        conditions.push(sql`exists (select 1 from app.student_enrollments e where e.student_id = ${students.id}
          ${q.academicYearId ? sql`and e.academic_year_id = ${q.academicYearId}` : sql``}
          ${q.classOfferingId ? sql`and e.class_offering_id = ${q.classOfferingId}` : sql``}
          ${q.enrollmentStatus ? sql`and e.status = ${q.enrollmentStatus}::app.enrollment_status` : sql``})`);
      }
      if (q.sectionId) {
        conditions.push(sql`exists (select 1 from app.student_placements p where p.student_id = ${students.id} and p.section_id = ${q.sectionId}
          and (p.end_date is null or p.end_date > ${date} or not exists (select 1 from app.student_placements p2 where p2.student_id = p.student_id and p2.start_date > p.start_date)))`);
      }
      if (q.streamId) {
        conditions.push(sql`exists (select 1 from app.student_stream_assignments sa join app.student_enrollments e on e.id = sa.enrollment_id
          where e.student_id = ${students.id} and sa.stream_id = ${q.streamId} and sa.start_date <= ${date} and (sa.end_date is null or sa.end_date > ${date}))`);
      }
      if (q.fees) {
        const balance = sql`(i.total_amount - i.paid_amount - i.adjusted_amount)`;
        if (q.fees === 'outstanding') {
          conditions.push(sql`exists (select 1 from app.invoices i where i.student_id = ${students.id} and i.status = 'open' and ${balance} > 0)`);
        } else if (q.fees === 'overdue') {
          conditions.push(sql`exists (select 1 from app.invoices i where i.student_id = ${students.id} and i.status = 'open' and ${balance} > 0 and i.due_date < ${date})`);
        } else {
          conditions.push(sql`not exists (select 1 from app.invoices i where i.student_id = ${students.id} and i.status = 'open' and ${balance} > 0)`);
        }
      }
      if (q.minPercentage || q.maxPercentage || q.gradeLabel) {
        const latest = sql`(select sr.percentage from app.student_results sr join app.result_publications rp on rp.id = sr.publication_id and rp.state = 'published'
          where sr.student_id = ${students.id} order by rp.published_at desc limit 1)`;
        const latestGrade = sql`(select sr.grade_label from app.student_results sr join app.result_publications rp on rp.id = sr.publication_id and rp.state = 'published'
          where sr.student_id = ${students.id} order by rp.published_at desc limit 1)`;
        if (q.minPercentage) conditions.push(sql`${latest} >= ${q.minPercentage}::numeric`);
        if (q.maxPercentage) conditions.push(sql`${latest} <= ${q.maxPercentage}::numeric`);
        if (q.gradeLabel) conditions.push(sql`${latestGrade} = ${q.gradeLabel}`);
      }
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) {
        conditions.push(or(gt(accounts.displayName, cursor[0]), and(eq(accounts.displayName, cursor[0]), gt(students.id, cursor[1])))!);
      }
      const rows = await tx
        .select({ s: students, a: accounts })
        .from(students)
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .where(and(...conditions))
        .orderBy(asc(accounts.displayName), asc(students.id))
        .limit(q.limit + 1);
      const pageRows = rows.slice(0, q.limit);
      const items = await this.toStudentItems(tx, pageRows, date);
      const last = pageRows[pageRows.length - 1];
      return {
        items,
        nextCursor: rows.length > q.limit && last ? encodeCursor([last.a.displayName, last.s.id]) : null,
      };
    });
  }

  private async toStudentItems(tx: Tx, rows: Array<{ s: typeof students.$inferSelect; a: typeof accounts.$inferSelect }>, date: string): Promise<StudentListItem[]> {
    const ids = rows.map((r) => r.s.id);
    const enrollments = await this.enrollment.enrollmentSummaries(tx, ids, date);
    const suspended = ids.length
      ? await tx
          .select({ studentId: disciplinarySuspensions.studentId })
          .from(disciplinarySuspensions)
          .where(
            and(
              inArray(disciplinarySuspensions.studentId, ids),
              isNull(disciplinarySuspensions.revokedAt),
              lte(disciplinarySuspensions.startDate, date),
              sql`${disciplinarySuspensions.endDate} >= ${date}`,
            ),
          )
      : [];
    const suspendedSet = new Set(suspended.map((s) => s.studentId));
    return rows.map(({ s, a }) => {
      const list = enrollments.get(s.id) ?? [];
      return {
        id: s.id,
        accountId: a.id,
        admissionNumber: s.admissionNumber,
        displayName: a.displayName,
        displayNameUr: a.displayNameUr,
        username: a.username,
        accountStatus: a.status,
        enrollment: list.find((e) => e.status === 'active') ?? list[0] ?? null,
        suspended: suspendedSet.has(s.id),
      };
    });
  }

  async getStudent(actor: Actor, studentId: string): Promise<StudentDetail> {
    return this.run(actor, async (tx) => {
      await assertCanViewStudent(tx, actor, studentId);
      const date = today(actor);
      const [row] = await tx.select({ s: students, a: accounts }).from(students).innerJoin(accounts, eq(accounts.id, students.accountId)).where(eq(students.id, studentId));
      const found = required(row, 'Student');
      const [item] = await this.toStudentItems(tx, [found], date);
      const roles = await this.accounts.rolesOf(tx, [found.a.id]);
      // Teachers get a limited view: no guardian contacts unless they are the class teacher.
      const canSeeContacts =
        isAdmin(actor) ||
        actor.studentId === studentId ||
        (!!actor.teacherId &&
          !!item!.enrollment?.sectionId &&
          (
            await tx
              .select({ id: classTeacherAssignments.id })
              .from(classTeacherAssignments)
              .where(
                and(
                  eq(classTeacherAssignments.teacherId, actor.teacherId),
                  eq(classTeacherAssignments.sectionId, item!.enrollment.sectionId),
                  activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date),
                ),
              )
          ).length > 0);
      const guardianRows = canSeeContacts
        ? await tx
            .select({ sg: studentGuardians, g: guardians })
            .from(studentGuardians)
            .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
            .where(eq(studentGuardians.studentId, studentId))
        : [];
      const [suspension] = await tx
        .select()
        .from(disciplinarySuspensions)
        .where(and(eq(disciplinarySuspensions.studentId, studentId), isNull(disciplinarySuspensions.revokedAt), sql`${disciplinarySuspensions.endDate} >= ${date}`))
        .orderBy(asc(disciplinarySuspensions.startDate))
        .limit(1);
      const [deletion] = await tx
        .select()
        .from(deletionRequests)
        .where(and(eq(deletionRequests.accountId, found.a.id), eq(deletionRequests.state, 'pending')));
      const enrollments = (await this.enrollment.enrollmentSummaries(tx, [studentId], date)).get(studentId) ?? [];
      const s = found.s;
      return {
        ...item!,
        gender: s.gender,
        dateOfBirth: canSeeContacts ? s.dateOfBirth : null,
        phone: canSeeContacts ? s.phone : null,
        email: canSeeContacts ? s.email : null,
        address: canSeeContacts ? s.address : null,
        admissionDate: s.admissionDate,
        notes: isAdmin(actor) ? s.notes : null,
        guardians: guardianRows.map(({ sg, g }) => ({
          id: g.id,
          name: g.name,
          nameUr: g.nameUr,
          relationship: sg.relationship,
          phone: g.phone,
          altPhone: g.altPhone,
          email: g.email,
          address: g.address,
          occupation: g.occupation,
          isPrimary: sg.isPrimary,
          isEmergency: sg.isEmergency,
        })),
        account: toAccountSummary(found.a, roles.get(found.a.id) ?? []),
        enrollments,
        activeSuspension: suspension ? { id: suspension.id, startDate: suspension.startDate, endDate: suspension.endDate, reason: isAdmin(actor) || actor.studentId === studentId ? suspension.reason : 'Suspended' } : null,
        deletion: deletion ? { requestedAt: deletion.createdAt.toISOString(), recoverUntil: deletion.recoverUntil.toISOString() } : null,
        version: s.version,
      };
    });
  }

  /* ---------------- Disciplinary suspensions ---------------- */

  async suspendStudent(actor: Actor, studentId: string, raw: z.input<typeof suspensionRequest>) {
    requireAdmin(actor);
    const input = suspensionRequest.parse(raw);
    if (input.endDate < input.startDate) throw errors.field('endDate', 'The last day cannot be before the first day');
    return this.run(actor, async (tx) => {
      const [row] = await tx
        .insert(disciplinarySuspensions)
        .values({ schoolId: actor.schoolId, studentId, ...input, decidedByAccountId: actor.accountId })
        .returning();
      await audit(tx, actor, { action: 'student.suspended', entityType: 'student', entityId: studentId, reason: input.reason, summary: { startDate: input.startDate, endDate: input.endDate } });
      return this.toSuspension(row!);
    });
  }

  async listSuspensions(actor: Actor, studentId: string) {
    return this.run(actor, async (tx) => {
      await assertCanViewStudent(tx, actor, studentId);
      const rows = await tx.select().from(disciplinarySuspensions).where(eq(disciplinarySuspensions.studentId, studentId)).orderBy(desc(disciplinarySuspensions.startDate));
      return rows.map((r) => this.toSuspension(r));
    });
  }

  async revokeSuspension(actor: Actor, suspensionId: string, reason: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx
        .update(disciplinarySuspensions)
        .set({ revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(disciplinarySuspensions.id, suspensionId), isNull(disciplinarySuspensions.revokedAt)))
        .returning();
      const row = required(rows[0], 'Suspension');
      await audit(tx, actor, { action: 'student.suspension_revoked', entityType: 'student', entityId: row.studentId, reason });
    });
  }

  private toSuspension(r: typeof disciplinarySuspensions.$inferSelect) {
    return {
      id: r.id,
      studentId: r.studentId,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason,
      revokedAt: r.revokedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  /* ======================= Teachers ======================= */

  async createTeacher(actor: Actor, raw: z.input<typeof createTeacherRequest>) {
    requireAdmin(actor);
    const input = createTeacherRequest.parse(raw);
    const { teacherId, accountId } = await this.run(actor, async (tx) => {
      const account = await this.accounts.createPending(tx, actor, {
        username: input.username,
        displayName: input.displayName,
        displayNameUr: input.displayNameUr,
        roles: input.isAdmin ? ['teacher', 'school_admin'] : ['teacher'],
      });
      const [teacher] = await tx
        .insert(teachers)
        .values({
          schoolId: actor.schoolId,
          accountId: account.id,
          employeeNumber: input.employeeNumber,
          gender: input.gender ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          qualifications: input.qualifications ?? null,
        })
        .returning();
      await tx.insert(employmentRecords).values({
        schoolId: actor.schoolId,
        teacherId: teacher!.id,
        startDate: input.employmentStartDate,
        jobTitle: input.jobTitle ?? 'Teacher',
      });
      await audit(tx, actor, { action: 'teacher.created', entityType: 'teacher', entityId: teacher!.id, summary: { employeeNumber: input.employeeNumber } });
      return { teacherId: teacher!.id, accountId: account.id };
    });
    const { credential, provisioningError } = await this.issueInitial(actor, accountId);
    return { teacher: await this.getTeacher(actor, teacherId), credential, provisioningError };
  }

  async updateTeacher(actor: Actor, teacherId: string, raw: z.input<typeof updateTeacherRequest>) {
    if (!isAdmin(actor) && actor.teacherId !== teacherId) throw errors.forbidden();
    const input = updateTeacherRequest.parse(raw);
    if (!isAdmin(actor) && input.employeeNumber) throw errors.forbidden('Only administrators can change employee numbers');
    await this.run(actor, async (tx) => {
      const [row] = await tx
        .update(teachers)
        .set({
          ...(input.employeeNumber ? { employeeNumber: input.employeeNumber } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.qualifications !== undefined ? { qualifications: input.qualifications } : {}),
          version: sql`${teachers.version} + 1`,
        })
        .where(and(eq(teachers.id, teacherId), eq(teachers.version, input.version)))
        .returning();
      if (!row) throw errors.version();
      if (input.displayName || input.displayNameUr !== undefined) {
        await tx
          .update(accounts)
          .set({
            ...(input.displayName ? { displayName: input.displayName } : {}),
            ...(input.displayNameUr !== undefined ? { displayNameUr: input.displayNameUr } : {}),
          })
          .where(eq(accounts.id, row.accountId));
      }
      await audit(tx, actor, { action: 'teacher.updated', entityType: 'teacher', entityId: teacherId });
    });
    return this.getTeacher(actor, teacherId);
  }

  async listTeachers(actor: Actor, rawQuery: z.input<typeof teacherListQuery>) {
    requireAdmin(actor);
    const q = teacherListQuery.parse(rawQuery);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      if (q.includeDeleted !== 'true') conditions.push(sql`${accounts.status} <> 'pending_deletion'`);
      if (q.q) {
        const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        conditions.push(sql`(${accounts.displayName} ilike ${like} or ${accounts.displayNameUr} ilike ${like} or ${teachers.employeeNumber} ilike ${like} or ${accounts.username} ilike ${like})`);
      }
      if (q.accountStatus) conditions.push(eq(accounts.status, q.accountStatus));
      if (q.employmentStatus) {
        conditions.push(sql`(select er.status from app.employment_records er where er.teacher_id = ${teachers.id} order by er.start_date desc limit 1) = ${q.employmentStatus}::app.employment_status`);
      }
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(gt(accounts.displayName, cursor[0]), and(eq(accounts.displayName, cursor[0]), gt(teachers.id, cursor[1])))!);
      const rows = await tx
        .select({ t: teachers, a: accounts })
        .from(teachers)
        .innerJoin(accounts, eq(accounts.id, teachers.accountId))
        .where(and(...conditions))
        .orderBy(asc(accounts.displayName), asc(teachers.id))
        .limit(q.limit + 1);
      const pageRows = rows.slice(0, q.limit);
      const items = await this.toTeacherItems(tx, pageRows, today(actor));
      const last = pageRows[pageRows.length - 1];
      return { items, nextCursor: rows.length > q.limit && last ? encodeCursor([last.a.displayName, last.t.id]) : null };
    });
  }

  private async toTeacherItems(tx: Tx, rows: Array<{ t: typeof teachers.$inferSelect; a: typeof accounts.$inferSelect }>, date: string): Promise<TeacherListItem[]> {
    const ids = rows.map((r) => r.t.id);
    if (!ids.length) return [];
    const [employment, cts, roles] = await Promise.all([
      tx.select().from(employmentRecords).where(inArray(employmentRecords.teacherId, ids)).orderBy(desc(employmentRecords.startDate)),
      tx
        .select({ teacherId: classTeacherAssignments.teacherId, sectionId: sections.id, sectionName: sections.name, gradeName: gradeLevels.name })
        .from(classTeacherAssignments)
        .innerJoin(sections, eq(sections.id, classTeacherAssignments.sectionId))
        .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(and(inArray(classTeacherAssignments.teacherId, ids), activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date))),
      this.accounts.rolesOf(tx, rows.map((r) => r.a.id)),
    ]);
    return rows.map(({ t, a }) => {
      const current = employment.find((e) => e.teacherId === t.id);
      return {
        id: t.id,
        accountId: a.id,
        employeeNumber: t.employeeNumber,
        displayName: a.displayName,
        displayNameUr: a.displayNameUr,
        username: a.username,
        accountStatus: a.status,
        employmentStatus: current?.status ?? null,
        jobTitle: current?.jobTitle ?? null,
        classTeacherOf: cts.filter((c) => c.teacherId === t.id).map((c) => ({ sectionId: c.sectionId, sectionName: `${c.gradeName} ${c.sectionName}` })),
        isAdmin: (roles.get(a.id) ?? []).includes('school_admin'),
      };
    });
  }

  async getTeacher(actor: Actor, teacherId: string): Promise<TeacherDetail> {
    if (!isAdmin(actor) && actor.teacherId !== teacherId) throw errors.forbidden();
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const [row] = await tx.select({ t: teachers, a: accounts }).from(teachers).innerJoin(accounts, eq(accounts.id, teachers.accountId)).where(eq(teachers.id, teacherId));
      const found = required(row, 'Teacher');
      const [item] = await this.toTeacherItems(tx, [found], date);
      const roles = await this.accounts.rolesOf(tx, [found.a.id]);
      const employment = await tx.select().from(employmentRecords).where(eq(employmentRecords.teacherId, teacherId)).orderBy(desc(employmentRecords.startDate));
      const assignments = await tx
        .select({ a: teacherAssignments, groupName: teachingGroups.name, subjectName: subjects.name })
        .from(teacherAssignments)
        .innerJoin(teachingGroups, eq(teachingGroups.id, teacherAssignments.teachingGroupId))
        .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
        .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
        .where(and(eq(teacherAssignments.teacherId, teacherId), or(isNull(teacherAssignments.endDate), gt(teacherAssignments.endDate, date))))
        .orderBy(asc(subjects.name));
      const [deletion] = await tx.select().from(deletionRequests).where(and(eq(deletionRequests.accountId, found.a.id), eq(deletionRequests.state, 'pending')));
      const t = found.t;
      return {
        ...item!,
        gender: t.gender,
        phone: t.phone,
        email: t.email,
        address: t.address,
        qualifications: t.qualifications,
        account: toAccountSummary(found.a, roles.get(found.a.id) ?? []),
        employment: employment.map((e) => ({ id: e.id, startDate: e.startDate, endDate: e.endDate, status: e.status, jobTitle: e.jobTitle, notes: isAdmin(actor) ? e.notes : null })),
        assignments: assignments.map(({ a, groupName, subjectName }) => ({
          id: a.id,
          teachingGroupId: a.teachingGroupId,
          teachingGroupName: groupName,
          subjectName,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
        deletion: deletion ? { requestedAt: deletion.createdAt.toISOString(), recoverUntil: deletion.recoverUntil.toISOString() } : null,
        version: t.version,
      };
    });
  }

  /** Departure: access ends immediately and every open duty is returned for reassignment. */
  async endEmployment(actor: Actor, teacherId: string, raw: z.input<typeof endEmploymentRequest>) {
    requireAdmin(actor);
    const input = endEmploymentRequest.parse(raw);
    const result = await this.run(actor, async (tx) => {
      const [teacher] = await tx.select().from(teachers).where(eq(teachers.id, teacherId));
      const t = required(teacher, 'Teacher');
      if (t.accountId === actor.accountId) throw errors.rule('You cannot end your own employment.');
      const [current] = await tx
        .select()
        .from(employmentRecords)
        .where(and(eq(employmentRecords.teacherId, teacherId), isNull(employmentRecords.endDate)))
        .orderBy(desc(employmentRecords.startDate))
        .limit(1);
      if (current) {
        if (input.endDate <= current.startDate) throw errors.field('endDate', 'The end date must be after employment started');
        await tx.update(employmentRecords).set({ endDate: input.endDate, status: 'ended', notes: input.reason }).where(eq(employmentRecords.id, current.id));
      }
      const duties = await this.endDuties(tx, teacherId, input.endDate);
      await tx
        .update(accounts)
        .set({ status: 'disabled', statusReason: 'Employment ended', statusChangedAt: new Date(), version: sql`${accounts.version} + 1` })
        .where(eq(accounts.id, t.accountId));
      await this.accounts.revokeSessions(tx, t.accountId, 'employment_ended');
      await audit(tx, actor, { action: 'teacher.employment_ended', entityType: 'teacher', entityId: teacherId, reason: input.reason, summary: { endDate: input.endDate } });
      return { duties, accountId: t.accountId };
    });
    const [acct] = await this.run(actor, (tx) => tx.select({ authUserId: accounts.authUserId }).from(accounts).where(eq(accounts.id, result.accountId)));
    if (acct?.authUserId) await this.auth.setDisabled(acct.authUserId, true).catch(() => undefined);
    return { unassignedDuties: result.duties };
  }

  /** Ends teaching and class-teacher assignments; lists timetable lessons still pointing at the teacher. */
  private async endDuties(tx: Tx, teacherId: string, endDate: string) {
    const open = <C extends typeof teacherAssignments.endDate>(c: C) => or(isNull(c), gt(c, endDate));
    const groups = await tx
      .update(teacherAssignments)
      .set({ endDate })
      .where(and(eq(teacherAssignments.teacherId, teacherId), open(teacherAssignments.endDate), lt(teacherAssignments.startDate, endDate)))
      .returning({ id: teacherAssignments.id, groupId: teacherAssignments.teachingGroupId });
    // Assignments that had not started yet are simply withdrawn.
    await tx.delete(teacherAssignments).where(and(eq(teacherAssignments.teacherId, teacherId), gte(teacherAssignments.startDate, endDate)));
    const cts = await tx
      .update(classTeacherAssignments)
      .set({ endDate })
      .where(and(eq(classTeacherAssignments.teacherId, teacherId), or(isNull(classTeacherAssignments.endDate), gt(classTeacherAssignments.endDate, endDate)), lt(classTeacherAssignments.startDate, endDate)))
      .returning({ id: classTeacherAssignments.id, sectionId: classTeacherAssignments.sectionId });
    await tx.delete(classTeacherAssignments).where(and(eq(classTeacherAssignments.teacherId, teacherId), gte(classTeacherAssignments.startDate, endDate)));
    await tx
      .update(attendanceDelegations)
      .set({ revokedAt: new Date() })
      .where(and(eq(attendanceDelegations.teacherId, teacherId), isNull(attendanceDelegations.revokedAt)));
    const lessons = await tx
      .select({ id: timetableLessons.id, weekday: timetableLessons.weekday, groupName: teachingGroups.name, version: timetableVersions.name })
      .from(timetableLessons)
      .innerJoin(timetableVersions, eq(timetableVersions.id, timetableLessons.timetableVersionId))
      .innerJoin(teachingGroups, eq(teachingGroups.id, timetableLessons.teachingGroupId))
      .where(and(eq(timetableLessons.teacherId, teacherId), inArray(timetableVersions.status, ['draft', 'published'])));
    const groupNames = groups.length
      ? await tx.select({ id: teachingGroups.id, name: teachingGroups.name }).from(teachingGroups).where(inArray(teachingGroups.id, groups.map((g) => g.groupId)))
      : [];
    const sectionNames = cts.length
      ? await tx.select({ id: sections.id, name: sections.name, grade: gradeLevels.name }).from(sections)
          .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
          .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
          .where(inArray(sections.id, cts.map((c) => c.sectionId)))
      : [];
    const weekdays = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return [
      ...groups.map((g) => ({ kind: 'teaching_group' as const, id: g.groupId, label: groupNames.find((n) => n.id === g.groupId)?.name ?? 'Teaching group' })),
      ...cts.map((c) => {
        const s = sectionNames.find((n) => n.id === c.sectionId);
        return { kind: 'class_teacher' as const, id: c.sectionId, label: s ? `Class teacher of ${s.grade} ${s.name}` : 'Class teacher' };
      }),
      ...lessons.map((l) => ({ kind: 'timetable_lesson' as const, id: l.id, label: `${l.groupName} (${weekdays[l.weekday]}) in ${l.version}` })),
    ];
  }

  /* ---------------- Compensation (administrators only; also enforced by RLS) ---------------- */

  async listCompensation(actor: Actor, teacherId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) =>
      (await tx.select().from(compensationRecords).where(eq(compensationRecords.teacherId, teacherId)).orderBy(desc(compensationRecords.effectiveFrom))).map((c) => ({
        id: c.id,
        effectiveFrom: c.effectiveFrom,
        effectiveTo: c.effectiveTo,
        amount: c.amount,
        currency: c.currency,
        payFrequency: c.payFrequency,
        notes: c.notes,
      })),
    );
  }

  async addCompensation(actor: Actor, teacherId: string, raw: z.input<typeof createCompensationRequest>) {
    requireAdmin(actor);
    const input = createCompensationRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [open] = await tx
        .select()
        .from(compensationRecords)
        .where(and(eq(compensationRecords.teacherId, teacherId), isNull(compensationRecords.effectiveTo)));
      if (open) {
        if (open.effectiveFrom >= input.effectiveFrom) throw errors.field('effectiveFrom', 'Must be after the current salary’s start date');
        await tx.update(compensationRecords).set({ effectiveTo: input.effectiveFrom }).where(eq(compensationRecords.id, open.id));
      }
      const [row] = await tx
        .insert(compensationRecords)
        .values({
          schoolId: actor.schoolId,
          teacherId,
          effectiveFrom: input.effectiveFrom,
          amount: dec(input.amount).toFixed(2),
          payFrequency: input.payFrequency,
          notes: input.notes ?? null,
          recordedByAccountId: actor.accountId,
        })
        .returning();
      // Amounts are deliberately excluded from the audit summary.
      await audit(tx, actor, { action: 'compensation.recorded', entityType: 'teacher', entityId: teacherId, summary: { recordId: row!.id, effectiveFrom: input.effectiveFrom } });
    });
    return this.listCompensation(actor, teacherId);
  }

  /* ======================= Administrators ======================= */

  async listAdmins(actor: Actor) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ a: accounts, isTeacher: sql<boolean>`exists (select 1 from app.teachers t where t.account_id = ${accounts.id})` })
        .from(accounts)
        .innerJoin(accountRoles, and(eq(accountRoles.accountId, accounts.id), eq(accountRoles.role, 'school_admin'), isNull(accountRoles.revokedAt)))
        .where(sql`${accounts.status} <> 'pending_deletion'`)
        .orderBy(asc(accounts.displayName));
      return rows.map(({ a, isTeacher }) => ({
        accountId: a.id,
        username: a.username,
        displayName: a.displayName,
        status: a.status,
        lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
        isTeacher,
      }));
    });
  }

  async createAdmin(actor: Actor, raw: z.input<typeof createAdminRequest>) {
    requireAdmin(actor);
    const input = createAdminRequest.parse(raw);
    const accountId = await this.run(actor, async (tx) => {
      const account = await this.accounts.createPending(tx, actor, { ...input, roles: ['school_admin'] });
      await audit(tx, actor, { action: 'admin.created', entityType: 'account', entityId: account.id });
      return account.id;
    });
    const { credential, provisioningError } = await this.issueInitial(actor, accountId);
    return { account: await this.run(actor, (tx) => this.accounts.summary(tx, accountId)), credential, provisioningError };
  }

  async setRoles(actor: Actor, accountId: string, roles: Array<'school_admin' | 'teacher' | 'student'>, version: number) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const [st] = await tx.select({ id: students.id }).from(students).where(eq(students.accountId, accountId));
      const [te] = await tx.select({ id: teachers.id }).from(teachers).where(eq(teachers.accountId, accountId));
      if (st && (roles.length !== 1 || roles[0] !== 'student')) throw errors.rule('Student accounts can only hold the student role.');
      if (!st && roles.includes('student')) throw errors.rule('Only student profiles can hold the student role.');
      if (!te && roles.includes('teacher')) throw errors.rule('Create a teacher profile before granting the teacher role.');
      if (te && !roles.includes('teacher')) throw errors.rule('A teacher profile keeps the teacher role. End the employment instead.');
      if (roles.length === 0) throw errors.rule('Keep at least one role.');
    });
    await this.accounts.setRoles(actor, accountId, roles, version);
  }

  /* ======================= Deletion with 30-day recovery ======================= */

  private async recoveryDays(tx: Tx) {
    const [p] = await tx.select({ retention: schoolPolicies.retention }).from(schoolPolicies).limit(1);
    return p?.retention.recoveryDays ?? 30;
  }

  private async profileOf(tx: Tx, accountId: string) {
    const [a] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
    const account = required(a, 'Account');
    const [st] = await tx.select().from(students).where(eq(students.accountId, accountId));
    const [te] = await tx.select().from(teachers).where(eq(teachers.accountId, accountId));
    return { account, student: st ?? null, teacher: te ?? null };
  }

  async deletionPreview(actor: Actor, accountId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const { account, student, teacher } = await this.profileOf(tx, accountId);
      if (account.status === 'pending_deletion') throw errors.rule('This account is already scheduled for deletion.');
      const days = await this.recoveryDays(tx);
      const recoverUntil = new Date(Date.now() + days * 24 * 3600 * 1000);
      const date = today(actor);
      const impacts = ['Sign-in is disabled immediately and all devices are signed out.'];
      if (student) {
        impacts.push('The student is removed from class lists and future homework, quizzes and roll calls.');
        const [bal] = await tx.execute<{ balance: string | null }>(sql`
          select sum(total_amount - paid_amount - adjusted_amount)::text as balance from app.invoices where student_id = ${student.id} and status = 'open'`);
        if (bal?.balance && dec(bal.balance).gt(0)) impacts.push(`An outstanding fee balance of ${dec(bal.balance).toFixed(2)} remains on record.`);
        impacts.push('Attendance, marks, results and fee history are kept.');
      }
      if (teacher) {
        const groups = await tx.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(eq(teacherAssignments.teacherId, teacher.id), activeOn(teacherAssignments.startDate, teacherAssignments.endDate, date)));
        const cts = await tx.select({ id: classTeacherAssignments.id }).from(classTeacherAssignments).where(and(eq(classTeacherAssignments.teacherId, teacher.id), activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date)));
        if (groups.length) impacts.push(`${groups.length} teaching assignment(s) end today and will need a new teacher.`);
        if (cts.length) impacts.push(`${cts.length} section(s) will need a new class teacher.`);
      }
      impacts.push(`You can restore this account until ${recoverUntil.toUTCString()}. After that, personal details are removed according to the school's retention policy.`);
      return { accountId, displayName: account.displayName, recoverUntil: recoverUntil.toISOString(), impacts };
    });
  }

  async deleteAccount(actor: Actor, accountId: string, reason?: string) {
    requireAdmin(actor);
    if (accountId === actor.accountId) throw errors.rule('You cannot delete your own account.');
    const result = await this.run(actor, async (tx) => {
      const { account, student, teacher } = await this.profileOf(tx, accountId);
      if (account.status === 'pending_deletion') throw errors.rule('This account is already scheduled for deletion.');
      const roles = (await this.accounts.rolesOf(tx, [accountId])).get(accountId) ?? [];
      if (roles.includes('school_admin')) {
        const [other] = await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from app.accounts a join app.account_roles r on r.account_id = a.id and r.revoked_at is null and r.role = 'school_admin'
          where a.status = 'active' and a.id <> ${accountId}`);
        if (!other || other.n === 0) throw errors.rule('The last active administrator cannot be deleted.');
      }
      const date = today(actor);
      const summary: Record<string, unknown> = { previousStatus: account.status };
      if (student) {
        const [active] = await tx.select().from(studentEnrollments).where(and(eq(studentEnrollments.studentId, student.id), eq(studentEnrollments.status, 'active')));
        if (active) {
          const current = await tx.execute<{ section_id: string; course_offering_ids: string[] }>(sql`
            select p.section_id,
              coalesce((select array_agg(ce.course_offering_id::text) from app.student_course_enrollments ce
                where ce.enrollment_id = ${active.id} and ce.status = 'active' and ce.start_date <= ${date} and (ce.end_date is null or ce.end_date > ${date})), '{}') as course_offering_ids
            from app.student_placements p where p.enrollment_id = ${active.id} and p.start_date <= ${date} and (p.end_date is null or p.end_date > ${date}) limit 1`);
          summary['enrollmentId'] = active.id;
          summary['sectionId'] = current[0]?.section_id ?? null;
          summary['courseOfferingIds'] = current[0]?.course_offering_ids ?? [];
          // Effective-dated rows need end > start; an enrollment starting today closes tomorrow.
          const endDate = active.startDate < date ? date : addDays(active.startDate, 1);
          await this.enrollment.closeEnrollmentRows(tx, active.id, endDate);
          await tx.update(studentEnrollments).set({ status: 'withdrawn', endDate, statusReason: 'Account deleted' }).where(eq(studentEnrollments.id, active.id));
        }
        await tx.update(students).set({ deletedAt: new Date() }).where(eq(students.id, student.id));
      }
      if (teacher) {
        const endedGroups = await tx
          .select({ groupId: teacherAssignments.teachingGroupId, isPrimary: teacherAssignments.isPrimary })
          .from(teacherAssignments)
          .where(and(eq(teacherAssignments.teacherId, teacher.id), activeOn(teacherAssignments.startDate, teacherAssignments.endDate, date)));
        const endedSections = await tx
          .select({ sectionId: classTeacherAssignments.sectionId })
          .from(classTeacherAssignments)
          .where(and(eq(classTeacherAssignments.teacherId, teacher.id), activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date)));
        summary['teachingGroupIds'] = endedGroups.map((g) => g.groupId);
        summary['classTeacherSectionIds'] = endedSections.map((s) => s.sectionId);
        await this.endDuties(tx, teacher.id, date);
        await tx.update(teachers).set({ deletedAt: new Date() }).where(eq(teachers.id, teacher.id));
      }
      const days = await this.recoveryDays(tx);
      const recoverUntil = new Date(Date.now() + days * 24 * 3600 * 1000);
      await tx
        .update(accounts)
        .set({ status: 'pending_deletion', deletedAt: new Date(), statusChangedAt: new Date(), statusReason: reason ?? null, version: sql`${accounts.version} + 1` })
        .where(eq(accounts.id, accountId));
      await tx
        .update(appSessions)
        .set({ revokedAt: new Date(), revokedReason: 'account_deleted' })
        .where(and(eq(appSessions.accountId, accountId), isNull(appSessions.revokedAt)));
      await tx.insert(deletionRequests).values({
        schoolId: actor.schoolId,
        subjectType: student ? 'student' : teacher ? 'teacher' : 'admin',
        subjectId: student?.id ?? teacher?.id ?? accountId,
        accountId,
        reason: reason ?? null,
        requestedByAccountId: actor.accountId,
        recoverUntil,
        processingSummary: summary,
      });
      await audit(tx, actor, { action: 'account.deleted', entityType: 'account', entityId: accountId, reason: reason ?? null, summary: { recoverUntil: recoverUntil.toISOString() } });
      return { recoverUntil, authUserId: account.authUserId };
    });
    if (result.authUserId) await this.auth.setDisabled(result.authUserId, true).catch(() => undefined);
    return { accountId, recoverUntil: result.recoverUntil.toISOString() };
  }

  /**
   * Restores within the recovery window after conflict checks. Revoked sessions are never restored,
   * and replaced class-teacher/teaching assignments are not re-created automatically.
   */
  async restoreAccount(actor: Actor, accountId: string) {
    requireAdmin(actor);
    const result = await this.run(actor, async (tx) => {
      const [request] = await tx
        .select()
        .from(deletionRequests)
        .where(and(eq(deletionRequests.accountId, accountId), eq(deletionRequests.state, 'pending')))
        .for('update');
      const req = required(request, 'Pending deletion');
      if (req.recoverUntil < new Date()) throw errors.rule('The recovery period has ended for this account.');
      const { account, student, teacher } = await this.profileOf(tx, accountId);
      const summary = (req.processingSummary ?? {}) as Record<string, unknown>;
      const notRestored: string[] = [];
      const date = today(actor);

      if (student) {
        await tx.update(students).set({ deletedAt: null }).where(eq(students.id, student.id));
        const enrollmentId = summary['enrollmentId'] as string | undefined;
        const sectionId = summary['sectionId'] as string | null | undefined;
        if (enrollmentId && sectionId) {
          const [other] = await tx.select({ id: studentEnrollments.id }).from(studentEnrollments).where(and(eq(studentEnrollments.studentId, student.id), eq(studentEnrollments.status, 'active')));
          const [e] = await tx.select().from(studentEnrollments).where(eq(studentEnrollments.id, enrollmentId));
          const [section] = await tx.select().from(sections).where(and(eq(sections.id, sectionId), isNull(sections.archivedAt)));
          if (other) notRestored.push('The student already has another active enrollment.');
          else if (!e || !section) notRestored.push('The previous section is no longer available. Enroll the student again.');
          else {
            if (e.status === 'withdrawn') {
              await tx.update(studentEnrollments).set({ status: 'active', endDate: null, statusReason: null }).where(eq(studentEnrollments.id, e.id));
              await tx.insert(studentPlacements).values({
                schoolId: actor.schoolId,
                enrollmentId: e.id,
                studentId: student.id,
                sectionId,
                startDate: date,
                reason: 'correction',
                note: 'Restored after deletion',
                createdByAccountId: actor.accountId,
              });
              const courseIds = (summary['courseOfferingIds'] as string[] | undefined) ?? [];
              if (courseIds.length) {
                const courses = await tx.select().from(courseOfferings).where(inArray(courseOfferings.id, courseIds));
                if (courses.length) {
                  await tx.insert(studentCourseEnrollments).values(
                    courses.map((c) => ({ schoolId: actor.schoolId, enrollmentId: e.id, studentId: student.id, courseOfferingId: c.id, startDate: date })),
                  );
                }
                await tx.execute(sql`
                  insert into app.teaching_group_memberships (school_id, teaching_group_id, student_course_enrollment_id, student_id, start_date)
                  select ${actor.schoolId}, g.id, ce.id, ${student.id}, ${date}
                  from app.student_course_enrollments ce
                  join app.teaching_groups g on g.course_offering_id = ce.course_offering_id and g.archived_at is null
                    and (g.section_id = ${sectionId} or (g.section_id is null and not exists (
                      select 1 from app.teaching_groups g2 where g2.course_offering_id = ce.course_offering_id and g2.section_id = ${sectionId})))
                  where ce.enrollment_id = ${e.id} and ce.start_date = ${date}`);
              }
            }
          }
        }
      }
      if (teacher) {
        await tx.update(teachers).set({ deletedAt: null }).where(eq(teachers.id, teacher.id));
        for (const sectionId of (summary['classTeacherSectionIds'] as string[] | undefined) ?? []) {
          const [current] = await tx
            .select({ id: classTeacherAssignments.id })
            .from(classTeacherAssignments)
            .where(and(eq(classTeacherAssignments.sectionId, sectionId), or(isNull(classTeacherAssignments.endDate), gt(classTeacherAssignments.endDate, date))));
          if (current) notRestored.push('A class-teacher role was reassigned while the account was deleted.');
          else await tx.insert(classTeacherAssignments).values({ schoolId: actor.schoolId, teacherId: teacher.id, sectionId, startDate: date, assignedByAccountId: actor.accountId });
        }
        for (const groupId of (summary['teachingGroupIds'] as string[] | undefined) ?? []) {
          const [current] = await tx
            .select({ id: teacherAssignments.id })
            .from(teacherAssignments)
            .where(and(eq(teacherAssignments.teachingGroupId, groupId), or(isNull(teacherAssignments.endDate), gt(teacherAssignments.endDate, date))));
          if (current) notRestored.push('A teaching assignment was given to another teacher while the account was deleted.');
          else await tx.insert(teacherAssignments).values({ schoolId: actor.schoolId, teacherId: teacher.id, teachingGroupId: groupId, startDate: date, assignedByAccountId: actor.accountId });
        }
      }
      const previous = (summary['previousStatus'] as 'active' | 'pending' | 'suspended' | 'disabled' | undefined) ?? 'active';
      await tx
        .update(accounts)
        .set({ status: previous === 'disabled' ? 'disabled' : previous, deletedAt: null, statusChangedAt: new Date(), statusReason: 'Restored', mustChangePassword: true, version: sql`${accounts.version} + 1` })
        .where(eq(accounts.id, accountId));
      await tx.update(deletionRequests).set({ state: 'restored', restoredAt: new Date(), restoredByAccountId: actor.accountId }).where(eq(deletionRequests.id, req.id));
      await audit(tx, actor, { action: 'account.restored', entityType: 'account', entityId: accountId, summary: { notRestored } });
      return { notRestored: [...new Set(notRestored)], authUserId: account.authUserId, previous };
    });
    if (result.authUserId && result.previous !== 'suspended' && result.previous !== 'disabled') {
      await this.auth.setDisabled(result.authUserId, false).catch(() => undefined);
    }
    return { accountId, restored: true as const, notRestored: result.notRestored };
  }
}
