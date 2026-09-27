import { and, desc, eq, gte, lt, lte, or, sql, type SQL } from 'drizzle-orm';
import type { ActionItem, AdminDashboard, StudentDashboard, TeacherDashboard } from '@edventure/contracts';
import { auditQuery, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import { accounts, auditEvents } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { addDays } from '../../platform/dates';
import { dec } from '../../platform/decimal';
import { errors } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { activeAcademicYear, requireAdmin, teacherGroupIds, today } from '../../platform/scope';
import type { AttendanceService } from '../attendance/service';
import type { FeesService } from '../finance/fees';
import type { TimetableService } from '../timetable/service';

const byPriority = (a: ActionItem, b: ActionItem) => a.priority - b.priority;

/**
 * Dashboards summarize work and link to detail screens; they deliberately do not show every module.
 */
export class InsightsService {
  constructor(
    private readonly db: Db,
    private readonly deps: { attendance: AttendanceService; fees: FeesService; timetable: TimetableService },
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn, { readOnly: true });
  }

  private async upcomingExams(tx: Tx, from: string, to: string, studentId?: string) {
    return tx.execute<{ date: string; start_time: string; subject_name: string; grade_name: string; section_name: string | null; cycle_name: string }>(sql`
      select s.date::text as date, to_char(s.start_time, 'HH24:MI') as start_time, sub.name as subject_name, g.name as grade_name, sec.name as section_name, c.name as cycle_name
      from app.exam_sittings s join app.exam_papers p on p.id = s.exam_paper_id join app.exam_cycles c on c.id = p.exam_cycle_id and c.state <> 'draft'
      join app.course_offerings co on co.id = p.course_offering_id join app.subjects sub on sub.id = co.subject_id
      join app.class_offerings cls on cls.id = co.class_offering_id join app.grade_levels g on g.id = cls.grade_level_id
      left join app.sections sec on sec.id = s.section_id
      where s.status = 'scheduled' and s.date between ${from} and ${to}
      ${studentId ? sql`and exists (select 1 from app.exam_registrations r where r.exam_paper_id = p.id and r.student_id = ${studentId} and (s.section_id is null or r.section_id = s.section_id))` : sql``}
      order by s.date, s.start_time limit 8`);
  }

  private async announcements(tx: Tx, actor: Actor) {
    return tx.execute<{ id: string; title: string; title_ur: string | null; category: string; published_at: string | null }>(sql`
      select a.id, a.title, a.title_ur, a.category::text as category, a.published_at::text as published_at from app.announcements a
      where a.state = 'published' ${isAdmin(actor) ? sql`` : sql`and exists (select 1 from app.notifications n join app.notification_recipients r on r.notification_id = n.id
        where n.entity_type = 'announcement' and n.entity_id = a.id and r.account_id = ${actor.accountId})`}
      order by a.published_at desc limit 5`);
  }

  private mapExams(rows: Awaited<ReturnType<InsightsService['upcomingExams']>>) {
    return rows.map((r) => ({ date: r.date, startTime: r.start_time, subjectName: r.subject_name, gradeName: r.grade_name, sectionName: r.section_name, examCycleName: r.cycle_name }));
  }

  private mapAnnouncements(rows: Awaited<ReturnType<InsightsService['announcements']>>) {
    return rows.map((r) => ({ id: r.id, title: r.title, titleUr: r.title_ur, category: r.category, publishedAt: r.published_at ? new Date(r.published_at).toISOString() : null }));
  }

  async admin(actor: Actor): Promise<AdminDashboard> {
    requireAdmin(actor);
    const date = today(actor);
    const overview = await this.deps.attendance.dailyOverview(actor, date);
    const fees = await this.deps.fees.summary(actor);
    return this.run(actor, async (tx) => {
      const year = await activeAcademicYear(tx);
      const [counts] = await tx.execute<Record<string, number>>(sql`
        select
          (select count(*)::int from app.student_enrollments e where e.status = 'active' ${year ? sql`and e.academic_year_id = ${year.id}` : sql``}) as students,
          (select count(*)::int from app.employment_records er where er.start_date <= ${date} and (er.end_date is null or er.end_date > ${date})) as teachers,
          (select count(*)::int from app.leave_requests where state = 'pending') as leave,
          (select count(*)::int from app.accounts where provisioning_state = 'failed' and status <> 'pending_deletion') as provisioning,
          (select count(*)::int from app.import_batches where state in ('validated') ) as imports,
          (select count(*)::int from app.result_publications where state = 'draft') as results,
          (select count(*)::int from app.exam_cycles where state = 'review') as exams`);
      const missingRollCalls = overview.instructional ? overview.sections.filter((s) => s.state !== 'submitted' && s.rosterSize > 0).length : 0;
      const actions: ActionItem[] = [
        { kind: 'roll_call_missing' as const, count: missingRollCalls, link: '/attendance', priority: 1 },
        { kind: 'leave_pending' as const, count: counts?.['leave'] ?? 0, link: '/leave?state=pending', priority: 2 },
        { kind: 'provisioning_failed' as const, count: counts?.['provisioning'] ?? 0, link: '/students?accountStatus=pending', priority: 3 },
        { kind: 'import_review' as const, count: counts?.['imports'] ?? 0, link: '/imports', priority: 4 },
        { kind: 'exam_review' as const, count: counts?.['exams'] ?? 0, link: '/exams', priority: 5 },
        { kind: 'results_draft' as const, count: counts?.['results'] ?? 0, link: '/results', priority: 6 },
        { kind: 'unallocated_receipts' as const, count: dec(fees.unallocatedReceipts).gt(0) ? 1 : 0, link: '/fees/payments?unallocated=true', priority: 7 },
      ]
        .filter((a) => a.count > 0)
        .sort(byPriority);
      return {
        date,
        academicYear: year ? { id: year.id, code: year.code, name: year.name } : null,
        metrics: {
          enrollment: { active: counts?.['students'] ?? 0, teachers: counts?.['teachers'] ?? 0 },
          attendanceToday: { rate: overview.overall.rate, completeness: overview.overall.completeness, instructional: overview.instructional },
          outstandingFees: { amount: fees.outstanding, overdue: fees.overdue, studentsOverdue: fees.studentsOverdue, currency: fees.currency },
          pendingApprovals: { total: counts?.['leave'] ?? 0, leave: counts?.['leave'] ?? 0 },
        },
        actions,
        upcomingExams: this.mapExams(await this.upcomingExams(tx, date, addDays(date, 14))),
        recentAnnouncements: this.mapAnnouncements(await this.announcements(tx, actor)),
      };
    });
  }

  async teacher(actor: Actor): Promise<TeacherDashboard> {
    if (!actor.teacherId) throw errors.forbidden();
    const date = today(actor);
    const [day, rollCalls] = await Promise.all([this.deps.timetable.day(actor, date), this.deps.attendance.rollCallTasks(actor, date)]);
    return this.run(actor, async (tx) => {
      const groups = await teacherGroupIds(tx, actor.teacherId!, date);
      const [c] = groups.length
        ? await tx.execute<{ homework: number; quizzes: number; marks: number }>(sql`
            select
              (select count(*)::int from app.homework_recipients r join app.homework h on h.id = r.homework_id
                 where h.teaching_group_id in ${groups} and r.completion_state = 'submitted') as homework,
              (select count(*)::int from app.quiz_attempts t join app.quiz_assignments a on a.id = t.quiz_assignment_id join app.quizzes q on q.id = a.quiz_id
                 where q.teaching_group_id in ${groups} and t.state = 'submitted') as quizzes,
              (select count(distinct p.id)::int from app.exam_papers p join app.exam_cycles c on c.id = p.exam_cycle_id and c.state in ('scheduled', 'marking')
                 join app.teaching_groups g on g.course_offering_id = p.course_offering_id and g.id in ${groups}
                 join app.teaching_group_memberships m on m.teaching_group_id = g.id
                 join app.exam_registrations r on r.exam_paper_id = p.id and r.student_id = m.student_id
                 where not exists (select 1 from app.marks mk where mk.exam_registration_id = r.id)) as marks`)
        : [{ homework: 0, quizzes: 0, marks: 0 }];
      const tasks: ActionItem[] = [
        { kind: 'homework_to_review' as const, count: c?.homework ?? 0, link: '/work/homework', priority: 2 },
        { kind: 'quiz_to_mark' as const, count: c?.quizzes ?? 0, link: '/work/quizzes', priority: 3 },
        { kind: 'marks_to_enter' as const, count: c?.marks ?? 0, link: '/work/marks', priority: 1 },
      ]
        .filter((t) => t.count > 0)
        .sort(byPriority);
      return {
        date,
        today: day,
        rollCalls: rollCalls.map((r) => ({ sectionId: r.sectionId, sectionName: r.sectionName, gradeName: r.gradeName, state: r.state, delegated: r.delegated })),
        tasks,
        recentAnnouncements: this.mapAnnouncements(await this.announcements(tx, actor)),
      };
    });
  }

  async student(actor: Actor): Promise<StudentDashboard> {
    if (!actor.studentId) throw errors.forbidden();
    const studentId = actor.studentId;
    const date = today(actor);
    const day = await this.deps.timetable.day(actor, date);
    const statement = await this.deps.fees.statement(actor, studentId);
    const data = await this.run(actor, async (tx) => {
      const homeworkRows = await tx.execute<{ id: string; title: string; subject: string; due_date: string; status: string }>(sql`
        select h.id, h.title, s.name as subject, h.due_date::text as due_date, r.completion_state::text as status
        from app.homework_recipients r join app.homework h on h.id = r.homework_id and h.state = 'published'
        join app.teaching_groups g on g.id = h.teaching_group_id join app.course_offerings c on c.id = g.course_offering_id join app.subjects s on s.id = c.subject_id
        where r.student_id = ${studentId} and r.completion_state = 'pending' and h.due_date >= ${addDays(date, -7)}
        order by h.due_date limit 6`);
      const quizRows = await tx.execute<{ id: string; title: string; subject: string; available_until: string | null; remaining: number }>(sql`
        select q.id, q.title, s.name as subject, q.available_until::text as available_until,
          (q.max_attempts + a.extra_attempts - (select count(*) from app.quiz_attempts t where t.quiz_assignment_id = a.id))::int as remaining
        from app.quiz_assignments a join app.quizzes q on q.id = a.quiz_id and q.state = 'published'
        join app.teaching_groups g on g.id = q.teaching_group_id join app.course_offerings c on c.id = g.course_offering_id join app.subjects s on s.id = c.subject_id
        where a.student_id = ${studentId} and (q.available_until is null or q.available_until > now())
        order by q.available_until nulls last limit 5`);
      const [latest] = await tx.execute<{ id: string; name: string; percentage: string | null; grade_label: string | null; outcome: string }>(sql`
        select p.id, c.name, sr.percentage::text as percentage, sr.grade_label, sr.outcome::text as outcome
        from app.student_results sr join app.result_publications p on p.id = sr.publication_id and p.state = 'published'
        join app.exam_cycles c on c.id = p.exam_cycle_id where sr.student_id = ${studentId} order by p.published_at desc limit 1`);
      const [alerts] = await tx.execute<{ unread: number; suspended: boolean }>(sql`
        select (select count(*)::int from app.notification_recipients r where r.account_id = ${actor.accountId} and r.read_at is null and r.archived_at is null) as unread,
               exists (select 1 from app.disciplinary_suspensions d where d.student_id = ${studentId} and d.revoked_at is null and d.start_date <= ${date} and d.end_date >= ${date}) as suspended`);
      const year = await activeAcademicYear(tx);
      return {
        homeworkRows,
        quizRows,
        latest,
        alerts,
        year,
        exams: this.mapExams(await this.upcomingExams(tx, date, addDays(date, 30), studentId)),
      };
    });
    const attendance = data.year
      ? (await this.deps.attendance.studentReport(actor, studentId, data.year.startDate, date < data.year.endDate ? date : data.year.endDate)).summary
      : null;
    const nextDue = statement.invoices.filter((i) => dec(i.balance).gt(0)).map((i) => i.dueDate).sort()[0] ?? null;
    return {
      date,
      today: day,
      upcomingHomework: data.homeworkRows.map((h) => ({ id: h.id, title: h.title, subjectName: h.subject, dueDate: h.due_date, status: h.status })),
      openQuizzes: data.quizRows.map((q) => ({ id: q.id, title: q.title, subjectName: q.subject, availableUntil: q.available_until ? new Date(q.available_until).toISOString() : null, attemptsRemaining: q.remaining })),
      upcomingExams: data.exams,
      latestResult: data.latest ? { publicationId: data.latest.id, examCycleName: data.latest.name, percentage: data.latest.percentage, gradeLabel: data.latest.grade_label, outcome: data.latest.outcome } : null,
      attendance,
      fees: { balance: statement.totals.balance, overdue: statement.totals.overdue, nextDueDate: nextDue, currency: statement.currency },
      alerts: { unreadNotifications: data.alerts?.unread ?? 0, suspended: data.alerts?.suspended ?? false },
    };
  }

  /** Staff search. Teachers only find students on their roster. */
  async search(actor: Actor, q: string) {
    const term = q.trim();
    if (term.length < 2) return { students: [], teachers: [] };
    const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const date = today(actor);
    return this.run(actor, async (tx) => {
      if (!isAdmin(actor) && !actor.teacherId) throw errors.forbidden();
      const studentsFound = await tx.execute<{ id: string; display_name: string; admission_number: string; detail: string | null }>(sql`
        select s.id, a.display_name, s.admission_number,
          (select g.name || ' ' || sec.name from app.student_placements p join app.sections sec on sec.id = p.section_id
             join app.class_offerings co on co.id = sec.class_offering_id join app.grade_levels g on g.id = co.grade_level_id
             where p.student_id = s.id order by p.start_date desc limit 1) as detail
        from app.students s join app.accounts a on a.id = s.account_id
        where a.status <> 'pending_deletion' and (a.display_name ilike ${like} or a.display_name_ur ilike ${like} or s.admission_number ilike ${like})
        ${isAdmin(actor) ? sql`` : sql`and (exists (select 1 from app.teaching_group_memberships m join app.teacher_assignments ta on ta.teaching_group_id = m.teaching_group_id
            where m.student_id = s.id and ta.teacher_id = ${actor.teacherId} and (m.end_date is null or m.end_date > ${date}) and (ta.end_date is null or ta.end_date > ${date}))
          or exists (select 1 from app.student_placements p join app.class_teacher_assignments c on c.section_id = p.section_id
            where p.student_id = s.id and c.teacher_id = ${actor.teacherId} and (p.end_date is null or p.end_date > ${date}) and (c.end_date is null or c.end_date > ${date})))`}
        order by a.display_name limit 8`);
      const teachersFound = isAdmin(actor)
        ? await tx.execute<{ id: string; display_name: string; employee_number: string }>(sql`
            select t.id, a.display_name, t.employee_number from app.teachers t join app.accounts a on a.id = t.account_id
            where a.status <> 'pending_deletion' and (a.display_name ilike ${like} or a.display_name_ur ilike ${like} or t.employee_number ilike ${like})
            order by a.display_name limit 8`)
        : [];
      return {
        students: studentsFound.map((s) => ({ id: s.id, displayName: s.display_name, admissionNumber: s.admission_number, detail: s.detail })),
        teachers: teachersFound.map((t) => ({ id: t.id, displayName: t.display_name, employeeNumber: t.employee_number })),
      };
    });
  }

  async audit(actor: Actor, raw: z.input<typeof auditQuery>) {
    requireAdmin(actor);
    const q = auditQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      if (q.entityType) conditions.push(eq(auditEvents.entityType, q.entityType));
      if (q.entityId) conditions.push(eq(auditEvents.entityId, q.entityId));
      if (q.actorAccountId) conditions.push(eq(auditEvents.actorAccountId, q.actorAccountId));
      if (q.action) conditions.push(sql`${auditEvents.action} like ${`${q.action.replace(/[%_\\]/g, '')}%`}`);
      if (q.from) conditions.push(gte(auditEvents.occurredAt, new Date(`${q.from}T00:00:00Z`)));
      if (q.to) conditions.push(lte(auditEvents.occurredAt, new Date(`${addDays(q.to, 1)}T00:00:00Z`)));
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(lt(auditEvents.occurredAt, new Date(cursor[0])), and(eq(auditEvents.occurredAt, new Date(cursor[0])), lt(auditEvents.id, cursor[1])))!);
      const rows = await tx
        .select({ e: auditEvents, actorName: accounts.displayName })
        .from(auditEvents)
        .leftJoin(accounts, eq(accounts.id, auditEvents.actorAccountId))
        .where(and(...conditions))
        .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
        .limit(q.limit + 1);
      const page = rows.slice(0, q.limit);
      const last = page[page.length - 1];
      return {
        items: page.map(({ e, actorName }) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          actor: actorName ?? (e.actorAccountId ? null : 'System'),
          summary: e.summary,
          reason: e.reason,
          requestId: e.requestId,
          occurredAt: e.occurredAt.toISOString(),
        })),
        nextCursor: rows.length > q.limit && last ? encodeCursor([last.e.occurredAt.toISOString(), last.e.id]) : null,
      };
    });
  }
}
