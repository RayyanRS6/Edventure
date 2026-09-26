import { and, desc, eq, sql } from 'drizzle-orm';
import type { ReportJob } from '@edventure/contracts';
import { createReportRequest, type ReportKind, type z } from '@edventure/contracts';
import { translate, type AppLocale } from '@edventure/i18n';
import type { Db, Tx } from '../../db/client';
import { reportJobs, schoolPolicies, schools } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import type { JobQueue } from '../../jobs/queue';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { toCsv } from '../../platform/csv';
import { errors, required } from '../../platform/errors';
import { today } from '../../platform/scope';
import type { PdfRenderer } from '../../reports/pdf';
import { feeStatementBody, layout, reportCardBody, tableBody } from '../../reports/templates';
import type { AttendanceService } from '../attendance/service';
import type { ExamService } from '../assessment/exams';
import type { ResultsService } from '../assessment/results';
import type { CommunicationsService } from '../communications/service';
import type { FeesService } from '../finance/fees';
import type { FilesService } from '../files/service';
import type { HomeworkService } from '../learning/homework';

type Row = typeof reportJobs.$inferSelect;
interface Output {
  name: string;
  csv?: { header: string[]; rows: unknown[][] };
  html?: string;
  landscape?: boolean;
}

const need = (p: Record<string, unknown>, key: string) => {
  const v = p[key];
  if (typeof v !== 'string' || !v) throw errors.field(`parameters.${key}`, `${key} is required`);
  return v;
};

/**
 * Exports and PDF reports run in the background worker. The job executes with the requester's own
 * authority (the same service checks as the API), and downloads expire (24 hours by default).
 */
export class ReportsService {
  constructor(
    private readonly db: Db,
    private readonly jobs: JobQueue,
    private readonly files: FilesService,
    private readonly comms: CommunicationsService,
    private readonly pdf: PdfRenderer,
    private readonly deps: {
      attendance: AttendanceService;
      exams: ExamService;
      results: ResultsService;
      fees: FeesService;
      homework: HomeworkService;
    },
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  private toJob(r: Row): ReportJob {
    return {
      id: r.id,
      kind: r.kind,
      format: r.format,
      parameters: r.parameters,
      state: r.expiresAt && r.expiresAt < new Date() && r.state === 'succeeded' ? 'expired' : r.state,
      error: r.error,
      fileId: r.fileId,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
    };
  }

  async request(actor: Actor, raw: z.input<typeof createReportRequest>) {
    const input = createReportRequest.parse(raw);
    const pdfKinds: ReportKind[] = ['report_card', 'date_sheet', 'mark_sheet', 'fee_statement'];
    if (input.format === 'pdf' && !pdfKinds.includes(input.kind)) throw errors.field('format', 'This report is available as CSV');
    const adminOnly: ReportKind[] = ['students', 'attendance_daily', 'teacher_attendance', 'leave', 'fee_balances'];
    if (adminOnly.includes(input.kind) && !isAdmin(actor)) throw errors.forbidden();
    return this.run(actor, async (tx) => {
      const [row] = await tx
        .insert(reportJobs)
        .values({ schoolId: actor.schoolId, kind: input.kind, format: input.format, parameters: { ...input.parameters, locale: input.locale }, requestedByAccountId: actor.accountId })
        .returning();
      await this.jobs.enqueue(tx, 'reportGenerate', { schoolId: actor.schoolId, reportJobId: row!.id });
      await audit(tx, actor, { action: 'report.requested', entityType: 'report_job', entityId: row!.id, summary: { kind: input.kind, format: input.format } });
      return this.toJob(row!);
    });
  }

  async get(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(reportJobs).where(and(eq(reportJobs.id, id), eq(reportJobs.requestedByAccountId, actor.accountId)));
      return this.toJob(required(row, 'Report'));
    });
  }

  async list(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(reportJobs).where(eq(reportJobs.requestedByAccountId, actor.accountId)).orderBy(desc(reportJobs.createdAt)).limit(50)).map((r) => this.toJob(r)),
    );
  }

  /** Worker entry point. `actor` is the requester, rebuilt from the database. */
  async generate(actor: Actor, jobId: string) {
    const job = await this.run(actor, async (tx) => {
      const [row] = await tx.update(reportJobs).set({ state: 'running', startedAt: new Date() }).where(eq(reportJobs.id, jobId)).returning();
      return required(row, 'Report');
    });
    try {
      const locale = (job.parameters['locale'] as AppLocale | undefined) ?? 'en';
      const out = await this.build(actor, job.kind as ReportKind, job.parameters, locale);
      const body = job.format === 'pdf' ? await this.pdf.render(out.html!, { landscape: out.landscape }) : toCsv(out.csv!.header, out.csv!.rows);
      await this.run(actor, async (tx) => {
        const [policy] = await tx.select({ retention: schoolPolicies.retention }).from(schoolPolicies);
        const hours = policy?.retention.exportDownloadHours ?? 24;
        const file = await this.files.storeGenerated(tx, actor, {
          purpose: job.format === 'pdf' ? 'report' : 'export',
          name: `${out.name}.${job.format}`,
          mimeType: job.format === 'pdf' ? 'application/pdf' : 'text/csv',
          body,
          expiresInHours: hours,
        });
        await tx
          .update(reportJobs)
          .set({ state: 'succeeded', fileId: file.id, completedAt: new Date(), expiresAt: file.expiresAt })
          .where(eq(reportJobs.id, jobId));
        await this.comms.notify(tx, { ...actor }, {
          kind: 'report.ready',
          data: { name: out.name },
          recipients: [actor.accountId],
          entityType: 'report_job',
          entityId: jobId,
          link: `/reports/${jobId}`,
        });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Report failed';
      await this.run(actor, (tx) => tx.update(reportJobs).set({ state: 'failed', error: message.slice(0, 500), completedAt: new Date() }).where(eq(reportJobs.id, jobId)));
      throw e;
    }
    return this.get(actor, jobId);
  }

  private async school(actor: Actor) {
    const [s] = await this.run(actor, (tx) => tx.select().from(schools).where(eq(schools.id, actor.schoolId)));
    return { name: s!.name, nameUr: s!.nameUr };
  }

  private async build(actor: Actor, kind: ReportKind, p: Record<string, unknown>, locale: AppLocale): Promise<Output> {
    const tr = (k: string) => translate(locale, k);
    switch (kind) {
      case 'students': {
        const rows = await this.run(actor, (tx) =>
          tx.execute<Record<string, string | null>>(sql`
            select s.admission_number, a.display_name, a.display_name_ur, a.username, a.status::text as account_status,
              g.name as grade, sec.name as section, st.name as stream, e.status::text as enrollment_status
            from app.students s join app.accounts a on a.id = s.account_id
            left join lateral (select * from app.student_enrollments e where e.student_id = s.id order by (e.status = 'active') desc, e.start_date desc limit 1) e on true
            left join app.class_offerings co on co.id = e.class_offering_id left join app.grade_levels g on g.id = co.grade_level_id
            left join lateral (select p.section_id from app.student_placements p where p.enrollment_id = e.id order by p.start_date desc limit 1) pl on true
            left join app.sections sec on sec.id = pl.section_id
            left join lateral (select sa.stream_id from app.student_stream_assignments sa where sa.enrollment_id = e.id order by sa.start_date desc limit 1) sa on true
            left join app.streams st on st.id = sa.stream_id
            where a.status <> 'pending_deletion'
              ${typeof p['classOfferingId'] === 'string' ? sql`and e.class_offering_id = ${p['classOfferingId']}` : sql``}
              ${typeof p['sectionId'] === 'string' ? sql`and pl.section_id = ${p['sectionId']}` : sql``}
            order by g.sort_order nulls last, sec.code, a.display_name`),
        );
        const header = ['admission_number', 'display_name', 'display_name_ur', 'username', 'class', 'section', 'stream', 'enrollment_status', 'account_status'];
        return {
          name: `students-${today(actor)}`,
          csv: { header, rows: rows.map((r) => [r['admission_number'], r['display_name'], r['display_name_ur'], r['username'], r['grade'], r['section'], r['stream'], r['enrollment_status'], r['account_status']]) },
        };
      }
      case 'attendance_section': {
        const r = await this.deps.attendance.sectionReport(actor, need(p, 'sectionId'), need(p, 'from'), need(p, 'to'));
        return {
          name: `attendance-${r.sectionName.replace(/\s+/g, '-')}-${r.from}-${r.to}`,
          csv: {
            header: ['admission_number', 'student', 'present', 'late', 'absent', 'excused', 'recorded_days', 'expected_days', 'attendance_rate', 'completeness'],
            rows: r.students.map((s) => [s.admissionNumber, s.displayName, s.summary.present, s.summary.late, s.summary.absent, s.summary.excused, s.summary.recordedDays, s.summary.expectedDays, s.summary.rate ?? 'No data', s.summary.completeness ?? '']),
          },
        };
      }
      case 'attendance_daily': {
        const r = await this.deps.attendance.dailyOverview(actor, need(p, 'date'));
        return {
          name: `attendance-daily-${r.date}`,
          csv: {
            header: ['class', 'section', 'roll_call', 'present', 'late', 'absent', 'excused', 'roster'],
            rows: r.sections.map((s) => [s.gradeName, s.sectionName, s.state, s.present, s.late, s.absent, s.excused, s.rosterSize]),
          },
        };
      }
      case 'teacher_attendance': {
        const rows = await this.run(actor, (tx) =>
          tx.execute<Record<string, string>>(sql`
            select t.employee_number, a.display_name, ta.date::text as date, ta.status::text as status, coalesce(ta.note, '') as note
            from app.teacher_attendance ta join app.teachers t on t.id = ta.teacher_id join app.accounts a on a.id = t.account_id
            where ta.date between ${need(p, 'from')} and ${need(p, 'to')} order by ta.date, a.display_name`),
        );
        return { name: `teacher-attendance-${p['from']}-${p['to']}`, csv: { header: ['employee_number', 'teacher', 'date', 'status', 'note'], rows: rows.map((r) => [r['employee_number'], r['display_name'], r['date'], r['status'], r['note']]) } };
      }
      case 'leave': {
        const rows = await this.run(actor, (tx) =>
          tx.execute<Record<string, string>>(sql`
            select coalesce(sa.display_name, ta.display_name) as person, case when l.student_id is not null then 'student' else 'teacher' end as kind,
              lt.name as leave_type, l.start_date::text as start_date, l.end_date::text as end_date, l.state::text as state, l.reason
            from app.leave_requests l join app.leave_types lt on lt.id = l.leave_type_id
            left join app.students s on s.id = l.student_id left join app.accounts sa on sa.id = s.account_id
            left join app.teachers t on t.id = l.teacher_id left join app.accounts ta on ta.id = t.account_id
            where l.end_date >= ${need(p, 'from')} and l.start_date <= ${need(p, 'to')} order by l.start_date`),
        );
        return { name: `leave-${p['from']}-${p['to']}`, csv: { header: ['person', 'kind', 'leave_type', 'first_day', 'last_day', 'state', 'reason'], rows: rows.map((r) => [r['person'], r['kind'], r['leave_type'], r['start_date'], r['end_date'], r['state'], r['reason']]) } };
      }
      case 'homework_completion': {
        const r = await this.deps.homework.sectionSummary(actor, need(p, 'sectionId'), need(p, 'from'), need(p, 'to'));
        return { name: `homework-${r.from}-${r.to}`, csv: { header: ['due_date', 'subject', 'title', 'done', 'total'], rows: r.items.map((i) => [i.dueDate, i.subjectName, i.title, i.done, i.total]) } };
      }
      case 'exam_results': {
        const pub = await this.deps.results.get(actor, need(p, 'publicationId'));
        const subjectNames = [...new Set(pub.results.flatMap((r) => r.subjects.map((s) => s.subjectName)))];
        return {
          name: `results-${pub.gradeName.replace(/\s+/g, '-')}-${pub.examCycleName.replace(/\s+/g, '-')}-rev${pub.revision}`,
          csv: {
            header: ['admission_number', 'student', 'section', ...subjectNames, 'obtained', 'total', 'percentage', 'grade', 'gpa', 'outcome', 'remarks'],
            rows: pub.results.map((r) => [
              r.admissionNumber,
              r.displayName,
              r.sectionName,
              ...subjectNames.map((n) => {
                const s = r.subjects.find((x) => x.subjectName === n);
                return s ? (s.obtainedMarks ?? s.outcome) : '';
              }),
              r.obtainedMarks,
              r.totalMarks,
              r.percentage,
              r.gradeLabel,
              r.gpa,
              r.outcome,
              r.remarks,
            ]),
          },
        };
      }
      case 'fee_balances': {
        const rows = await this.run(actor, (tx) =>
          tx.execute<Record<string, string>>(sql`
            select s.admission_number, a.display_name,
              sum(i.total_amount)::text as charged, sum(i.paid_amount)::text as paid, sum(i.adjusted_amount)::text as adjusted,
              sum(i.total_amount - i.paid_amount - i.adjusted_amount)::text as balance,
              coalesce(sum(i.total_amount - i.paid_amount - i.adjusted_amount) filter (where i.due_date < ${today(actor)}), 0)::text as overdue
            from app.invoices i join app.students s on s.id = i.student_id join app.accounts a on a.id = s.account_id
            where i.status = 'open' group by s.admission_number, a.display_name order by a.display_name`),
        );
        return {
          name: `fee-balances-${today(actor)}`,
          csv: { header: ['admission_number', 'student', 'charged', 'paid', 'adjusted', 'balance', 'overdue'], rows: rows.map((r) => [r['admission_number'], r['display_name'], r['charged'], r['paid'], r['adjusted'], r['balance'], r['overdue']]) },
        };
      }
      case 'report_card': {
        const publicationId = need(p, 'publicationId');
        const studentIds = typeof p['studentId'] === 'string' ? [p['studentId']] : (await this.deps.results.get(actor, publicationId)).results.map((r) => r.studentId);
        const cards = [];
        for (const id of studentIds) cards.push(await this.deps.results.reportCard(actor, publicationId, id));
        const first = cards[0];
        if (!first) throw errors.rule('No report cards to print.');
        return { name: `report-cards-${first.gradeName.replace(/\s+/g, '-')}`, html: layout(locale, `${tr('exams.reportCard')} · ${first.examCycleName}`, cards.map((c) => reportCardBody(c, locale)).join(''), await this.school(actor)) };
      }
      case 'date_sheet': {
        const rows = await this.deps.exams.dateSheet(actor, { examCycleId: p['examCycleId'] as string | undefined, classOfferingId: p['classOfferingId'] as string | undefined, sectionId: p['sectionId'] as string | undefined });
        const live = rows.filter((r) => r.status === 'scheduled');
        const table = tableBody(
          [tr('common.date'), tr('nav.subjects'), tr('nav.classes'), tr('common.from'), tr('common.to'), tr('exams.maxMarks')],
          live.map((r) => [r.date, r.subjectName, `${r.gradeName} ${r.sectionName ?? ''}`, r.startTime, r.endTime, r.maxMarks]),
          [0, 3, 4, 5],
        );
        return { name: 'date-sheet', html: layout(locale, tr('exams.dateSheet'), table, await this.school(actor)), csv: { header: ['date', 'subject', 'class', 'start', 'end', 'max_marks'], rows: live.map((r) => [r.date, r.subjectName, r.gradeName, r.startTime, r.endTime, r.maxMarks]) } };
      }
      case 'mark_sheet': {
        const sheet = await this.deps.exams.markSheet(actor, need(p, 'examPaperId'), p['sectionId'] as string | undefined);
        const blank = p['blank'] === 'true';
        const table = tableBody(
          ['#', tr('nav.students'), tr('nav.classes'), `${tr('exams.marks')} / ${sheet.paper.maxMarks}`, tr('common.status')],
          sheet.rows.map((r) => [r.admissionNumber, r.displayName, r.sectionName ?? '', blank ? '' : (r.score ?? ''), blank ? '' : (r.outcome ?? '')]),
          [0, 3],
        );
        return { name: `mark-sheet-${sheet.paper.subjectName.replace(/\s+/g, '-')}`, html: layout(locale, `${sheet.paper.gradeName} · ${sheet.paper.subjectName}`, table, await this.school(actor)) };
      }
      case 'fee_statement': {
        const s = await this.deps.fees.statement(actor, need(p, 'studentId'));
        return { name: `fee-statement-${s.admissionNumber}`, html: layout(locale, tr('fees.statement'), feeStatementBody(s, locale), await this.school(actor)) };
      }
    }
  }
}
