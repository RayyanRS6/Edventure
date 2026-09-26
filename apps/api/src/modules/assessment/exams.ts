import { and, asc, count, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { ExamCycle, ExamPaper } from '@edventure/contracts';
import {
  createExamCycleRequest,
  createPapersRequest,
  dateSheetQuery,
  examCycleTransition,
  rescheduleSittingRequest,
  saveMarksRequest,
  scheduleSittingRequest,
  updatePaperRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  classOfferings,
  courseOfferings,
  examCycles,
  examPapers,
  examRegistrations,
  examSittings,
  gradeLevels,
  markRevisions,
  marksTable,
  rooms,
  sections,
  students,
  subjects,
  teacherAssignments,
  teachingGroupMemberships,
  teachingGroups,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { dec } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { activeOn, assertCanViewStudent, requireAdmin, today } from '../../platform/scope';
import { studentAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';
import { assertYearWritable } from '../school/service';

type CycleRow = typeof examCycles.$inferSelect;
const hhmm = (t: string) => t.slice(0, 5);

const transitions: Record<string, string[]> = {
  draft: ['scheduled'],
  scheduled: ['marking', 'draft'],
  marking: ['review', 'scheduled'],
  review: ['marking'],
  published: ['closed'],
};

/**
 * Exams: administrators create cycles and papers, schedule sittings and register eligible students;
 * teachers enter marks for the students they teach; administrators review, correct and publish.
 */
export class ExamService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  private async toCycle(tx: Tx, c: CycleRow): Promise<ExamCycle> {
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(examPapers).where(eq(examPapers.examCycleId, c.id));
    return { id: c.id, academicYearId: c.academicYearId, termId: c.termId, name: c.name, nameUr: c.nameUr, kind: c.kind, isFinal: c.isFinal, state: c.state, paperCount: n, version: c.version };
  }

  async listCycles(actor: Actor, academicYearId: string) {
    return this.run(actor, async (tx) => {
      const rows = await tx.select().from(examCycles).where(eq(examCycles.academicYearId, academicYearId)).orderBy(asc(examCycles.createdAt));
      // Students and teachers only see cycles once the date sheet is scheduled.
      const visible = isAdmin(actor) ? rows : rows.filter((r) => r.state !== 'draft');
      return Promise.all(visible.map((c) => this.toCycle(tx, c)));
    });
  }

  async createCycle(actor: Actor, raw: z.input<typeof createExamCycleRequest>) {
    requireAdmin(actor);
    const input = createExamCycleRequest.parse(raw);
    return this.run(actor, async (tx) => {
      await assertYearWritable(tx, input.academicYearId);
      const [c] = await tx
        .insert(examCycles)
        .values({ schoolId: actor.schoolId, ...input, termId: input.termId ?? null, nameUr: input.nameUr ?? null })
        .returning();
      await audit(tx, actor, { action: 'exam_cycle.created', entityType: 'exam_cycle', entityId: c!.id });
      return this.toCycle(tx, c!);
    });
  }

  async transition(actor: Actor, cycleId: string, raw: z.input<typeof examCycleTransition>) {
    requireAdmin(actor);
    const input = examCycleTransition.parse(raw);
    return this.run(actor, async (tx) => {
      const [c] = await tx.select().from(examCycles).where(eq(examCycles.id, cycleId)).for('update');
      const cycle = required(c, 'Exam');
      if (cycle.version !== input.version) throw errors.version();
      if (!(transitions[cycle.state] ?? []).includes(input.state)) throw errors.rule(`An exam in "${cycle.state}" cannot move to "${input.state}".`);
      const [updated] = await tx.update(examCycles).set({ state: input.state, version: cycle.version + 1 }).where(eq(examCycles.id, cycleId)).returning();
      await audit(tx, actor, { action: 'exam_cycle.state_changed', entityType: 'exam_cycle', entityId: cycleId, summary: { from: cycle.state, to: input.state } });
      return this.toCycle(tx, updated!);
    });
  }

  /* ---------------- Papers and registrations ---------------- */

  async listPapers(actor: Actor, cycleId: string, classOfferingId?: string): Promise<ExamPaper[]> {
    return this.run(actor, (tx) => this.loadPapers(tx, { cycleId, classOfferingId }));
  }

  private async loadPapers(tx: Tx, f: { cycleId?: string; classOfferingId?: string; ids?: string[] }): Promise<ExamPaper[]> {
    const rows = await tx
      .select({ p: examPapers, c: courseOfferings, s: subjects, g: gradeLevels })
      .from(examPapers)
      .innerJoin(courseOfferings, eq(courseOfferings.id, examPapers.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .innerJoin(classOfferings, eq(classOfferings.id, courseOfferings.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .where(
        and(
          f.cycleId ? eq(examPapers.examCycleId, f.cycleId) : undefined,
          f.classOfferingId ? eq(courseOfferings.classOfferingId, f.classOfferingId) : undefined,
          f.ids ? inArray(examPapers.id, f.ids) : undefined,
        ),
      )
      .orderBy(asc(gradeLevels.sortOrder), asc(courseOfferings.sortOrder), asc(subjects.name));
    const ids = rows.map((r) => r.p.id);
    if (!ids.length) return [];
    const [regs, marked, sits] = await Promise.all([
      tx.select({ paperId: examRegistrations.examPaperId, n: count() }).from(examRegistrations).where(inArray(examRegistrations.examPaperId, ids)).groupBy(examRegistrations.examPaperId),
      tx
        .select({ paperId: examRegistrations.examPaperId, n: count() })
        .from(marksTable)
        .innerJoin(examRegistrations, eq(examRegistrations.id, marksTable.examRegistrationId))
        .where(and(inArray(examRegistrations.examPaperId, ids), ne(marksTable.outcome, 'missing')))
        .groupBy(examRegistrations.examPaperId),
      tx
        .select({ s: examSittings, sectionName: sections.name, roomName: rooms.name })
        .from(examSittings)
        .leftJoin(sections, eq(sections.id, examSittings.sectionId))
        .leftJoin(rooms, eq(rooms.id, examSittings.roomId))
        .where(inArray(examSittings.examPaperId, ids))
        .orderBy(asc(examSittings.date), asc(examSittings.startTime)),
    ]);
    return rows.map(({ p, c, s, g }) => ({
      id: p.id,
      examCycleId: p.examCycleId,
      courseOfferingId: c.id,
      classOfferingId: c.classOfferingId,
      subjectName: s.name,
      subjectNameUr: s.nameUr,
      gradeName: g.name,
      maxMarks: p.maxMarks,
      passMarks: p.passMarks,
      locked: p.locked,
      registrationCount: regs.find((r) => r.paperId === p.id)?.n ?? 0,
      markedCount: marked.find((r) => r.paperId === p.id)?.n ?? 0,
      sittings: sits
        .filter((x) => x.s.examPaperId === p.id)
        .map((x) => ({
          id: x.s.id,
          sectionId: x.s.sectionId,
          sectionName: x.sectionName,
          date: x.s.date,
          startTime: hhmm(x.s.startTime),
          endTime: hhmm(x.s.endTime),
          roomId: x.s.roomId,
          roomName: x.roomName,
          status: x.s.status,
          note: x.s.note,
        })),
      version: p.version,
    }));
  }

  async createPapers(actor: Actor, cycleId: string, raw: z.input<typeof createPapersRequest>) {
    requireAdmin(actor);
    const input = createPapersRequest.parse(raw);
    const ids = await this.run(actor, async (tx) => {
      const [c] = await tx.select().from(examCycles).where(eq(examCycles.id, cycleId));
      const cycle = required(c, 'Exam');
      await assertYearWritable(tx, cycle.academicYearId);
      if (!['draft', 'scheduled'].includes(cycle.state)) throw errors.rule('Papers can only be added before marking starts.');
      const courses = await tx
        .select()
        .from(courseOfferings)
        .where(and(eq(courseOfferings.classOfferingId, input.classOfferingId), inArray(courseOfferings.id, input.papers.map((p) => p.courseOfferingId))));
      if (courses.length !== input.papers.length) throw errors.field('papers', 'Every paper must be a subject offered to the class');
      const created: string[] = [];
      for (const p of input.papers) {
        if (dec(p.passMarks).gt(p.maxMarks)) throw errors.field('papers', 'Pass marks cannot exceed maximum marks');
        const [row] = await tx
          .insert(examPapers)
          .values({ schoolId: actor.schoolId, examCycleId: cycleId, courseOfferingId: p.courseOfferingId, maxMarks: p.maxMarks, passMarks: p.passMarks })
          .returning();
        created.push(row!.id);
        await this.syncRegistrationsInTx(tx, actor, row!.id);
      }
      await audit(tx, actor, { action: 'exam_papers.created', entityType: 'exam_cycle', entityId: cycleId, summary: { papers: created.length } });
      return created;
    });
    return this.run(actor, (tx) => this.loadPapers(tx, { ids }));
  }

  async updatePaper(actor: Actor, paperId: string, raw: z.input<typeof updatePaperRequest>) {
    requireAdmin(actor);
    const input = updatePaperRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(examPapers).where(eq(examPapers.id, paperId)).for('update');
      const paper = required(p, 'Paper');
      if (paper.version !== input.version) throw errors.version();
      if (input.maxMarks || input.passMarks) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: count() })
          .from(marksTable)
          .innerJoin(examRegistrations, eq(examRegistrations.id, marksTable.examRegistrationId))
          .where(and(eq(examRegistrations.examPaperId, paperId), eq(marksTable.outcome, 'score')));
        if (n > 0 && input.maxMarks && !dec(input.maxMarks).eq(paper.maxMarks)) throw errors.rule('Maximum marks cannot change after scores are entered.');
        const max = input.maxMarks ?? paper.maxMarks;
        const pass = input.passMarks ?? paper.passMarks;
        if (dec(pass).gt(max)) throw errors.field('passMarks', 'Pass marks cannot exceed maximum marks');
      }
      await tx
        .update(examPapers)
        .set({
          ...(input.maxMarks ? { maxMarks: input.maxMarks } : {}),
          ...(input.passMarks ? { passMarks: input.passMarks } : {}),
          ...(input.locked !== undefined ? { locked: input.locked } : {}),
          version: paper.version + 1,
        })
        .where(eq(examPapers.id, paperId));
      await audit(tx, actor, { action: 'exam_paper.updated', entityType: 'exam_paper', entityId: paperId, summary: { locked: input.locked } });
      return (await this.loadPapers(tx, { ids: [paperId] }))[0]!;
    });
  }

  /** Registers every student actively taking the subject; removes unmarked registrations of leavers. */
  async syncRegistrations(actor: Actor, paperId: string) {
    requireAdmin(actor);
    return this.run(actor, async (tx) => {
      const result = await this.syncRegistrationsInTx(tx, actor, paperId);
      await audit(tx, actor, { action: 'exam_paper.registrations_synced', entityType: 'exam_paper', entityId: paperId, summary: result });
      return result;
    });
  }

  private async syncRegistrationsInTx(tx: Tx, actor: Actor, paperId: string) {
    const date = today(actor);
    const [p] = await tx.select().from(examPapers).where(eq(examPapers.id, paperId));
    const paper = required(p, 'Paper');
    const added = await tx.execute<{ id: string }>(sql`
      insert into app.exam_registrations (school_id, exam_paper_id, student_id, enrollment_id, student_course_enrollment_id, section_id)
      select ${actor.schoolId}, ${paperId}, ce.student_id, ce.enrollment_id, ce.id,
        (select pl.section_id from app.student_placements pl where pl.enrollment_id = ce.enrollment_id
          and pl.start_date <= ${date} and (pl.end_date is null or pl.end_date > ${date}) limit 1)
      from app.student_course_enrollments ce
      join app.student_enrollments e on e.id = ce.enrollment_id and e.status = 'active'
      where ce.course_offering_id = ${paper.courseOfferingId} and ce.status = 'active'
        and ce.start_date <= ${date} and (ce.end_date is null or ce.end_date > ${date})
      on conflict do nothing returning id`);
    const removed = await tx.execute<{ id: string }>(sql`
      delete from app.exam_registrations r
      where r.exam_paper_id = ${paperId}
        and not exists (select 1 from app.marks m where m.exam_registration_id = r.id)
        and not exists (select 1 from app.student_course_enrollments ce join app.student_enrollments e on e.id = ce.enrollment_id and e.status = 'active'
          where ce.id = r.student_course_enrollment_id and ce.status = 'active' and (ce.end_date is null or ce.end_date > ${date}))
      returning id`);
    return { added: added.length, removed: removed.length };
  }

  /* ---------------- Sittings and date sheets ---------------- */

  async scheduleSitting(actor: Actor, raw: z.input<typeof scheduleSittingRequest>) {
    requireAdmin(actor);
    const input = scheduleSittingRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [p] = await tx.select().from(examPapers).where(eq(examPapers.id, input.examPaperId));
      required(p, 'Paper');
      await tx.insert(examSittings).values({
        schoolId: actor.schoolId,
        examPaperId: input.examPaperId,
        sectionId: input.sectionId ?? null,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        roomId: input.roomId ?? null,
        note: input.note ?? null,
      });
      await audit(tx, actor, { action: 'exam_sitting.scheduled', entityType: 'exam_paper', entityId: input.examPaperId, summary: { date: input.date } });
      return (await this.loadPapers(tx, { ids: [input.examPaperId] }))[0]!;
    });
  }

  /** Keeps schedule history: the old sitting is marked rescheduled and linked to its replacement. */
  async reschedule(actor: Actor, sittingId: string, raw: z.input<typeof rescheduleSittingRequest>) {
    requireAdmin(actor);
    const input = rescheduleSittingRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [s] = await tx.select().from(examSittings).where(eq(examSittings.id, sittingId)).for('update');
      const sitting = required(s, 'Sitting');
      if (sitting.status !== 'scheduled') throw errors.rule('Only scheduled sittings can be moved.');
      const [next] = await tx
        .insert(examSittings)
        .values({
          schoolId: actor.schoolId,
          examPaperId: sitting.examPaperId,
          sectionId: sitting.sectionId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          roomId: input.roomId ?? sitting.roomId,
          note: input.note ?? null,
        })
        .returning();
      await tx.update(examSittings).set({ status: 'rescheduled', replacedBySittingId: next!.id }).where(eq(examSittings.id, sittingId));
      const [paper] = await this.loadPapers(tx, { ids: [sitting.examPaperId] });
      const regs = await tx
        .select({ studentId: examRegistrations.studentId })
        .from(examRegistrations)
        .where(and(eq(examRegistrations.examPaperId, sitting.examPaperId), sitting.sectionId ? eq(examRegistrations.sectionId, sitting.sectionId) : undefined));
      await this.comms.notify(tx, actor, {
        kind: 'exam.rescheduled',
        data: { subject: paper?.subjectName ?? '', date: input.date },
        recipients: await studentAccountIds(tx, regs.map((r) => r.studentId)),
        entityType: 'exam_sitting',
        entityId: next!.id,
        link: '/exams/date-sheet',
      });
      await audit(tx, actor, { action: 'exam_sitting.rescheduled', entityType: 'exam_paper', entityId: sitting.examPaperId, summary: { from: sitting.date, to: input.date } });
      return paper!;
    });
  }

  async cancelSitting(actor: Actor, sittingId: string) {
    requireAdmin(actor);
    await this.run(actor, async (tx) => {
      const rows = await tx.update(examSittings).set({ status: 'cancelled' }).where(and(eq(examSittings.id, sittingId), eq(examSittings.status, 'scheduled'))).returning({ id: examSittings.id });
      if (!rows.length) throw errors.notFound('Sitting');
      await audit(tx, actor, { action: 'exam_sitting.cancelled', entityType: 'exam_sitting', entityId: sittingId });
    });
  }

  async dateSheet(actor: Actor, raw: z.input<typeof dateSheetQuery>) {
    const q = dateSheetQuery.parse(raw);
    return this.run(actor, async (tx) => {
      let studentId = q.studentId;
      if (!isAdmin(actor) && actor.studentId) studentId = actor.studentId;
      if (studentId) await assertCanViewStudent(tx, actor, studentId);
      const rows = await tx
        .select({ s: examSittings, p: examPapers, subject: subjects, grade: gradeLevels.name, sectionName: sections.name, roomName: rooms.name, cycleState: examCycles.state })
        .from(examSittings)
        .innerJoin(examPapers, eq(examPapers.id, examSittings.examPaperId))
        .innerJoin(examCycles, eq(examCycles.id, examPapers.examCycleId))
        .innerJoin(courseOfferings, eq(courseOfferings.id, examPapers.courseOfferingId))
        .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
        .innerJoin(classOfferings, eq(classOfferings.id, courseOfferings.classOfferingId))
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .leftJoin(sections, eq(sections.id, examSittings.sectionId))
        .leftJoin(rooms, eq(rooms.id, examSittings.roomId))
        .where(
          and(
            q.examCycleId ? eq(examPapers.examCycleId, q.examCycleId) : undefined,
            q.classOfferingId ? eq(courseOfferings.classOfferingId, q.classOfferingId) : undefined,
            q.sectionId ? sql`(${examSittings.sectionId} = ${q.sectionId} or ${examSittings.sectionId} is null)` : undefined,
            isAdmin(actor) ? undefined : ne(examCycles.state, 'draft'),
            studentId
              ? sql`exists (select 1 from app.exam_registrations r where r.exam_paper_id = ${examPapers.id} and r.student_id = ${studentId}
                  and (${examSittings.sectionId} is null or r.section_id = ${examSittings.sectionId}))`
              : undefined,
          ),
        )
        .orderBy(asc(examSittings.date), asc(examSittings.startTime));
      return rows.map((r) => ({
        sittingId: r.s.id,
        examPaperId: r.p.id,
        date: r.s.date,
        startTime: hhmm(r.s.startTime),
        endTime: hhmm(r.s.endTime),
        subjectName: r.subject.name,
        subjectNameUr: r.subject.nameUr,
        gradeName: r.grade,
        sectionName: r.sectionName,
        roomName: r.roomName,
        maxMarks: r.p.maxMarks,
        status: r.s.status,
      }));
    });
  }

  /* ---------------- Marks ---------------- */

  /** Registrations a teacher may mark: students in groups of this subject that the teacher teaches. */
  private async markableRegistrationIds(tx: Tx, actor: Actor, paperId: string): Promise<string[] | 'all'> {
    if (isAdmin(actor)) return 'all';
    if (!actor.teacherId) throw errors.forbidden();
    const date = today(actor);
    const rows = await tx
      .selectDistinct({ id: examRegistrations.id })
      .from(examRegistrations)
      .innerJoin(examPapers, eq(examPapers.id, examRegistrations.examPaperId))
      .innerJoin(teachingGroups, eq(teachingGroups.courseOfferingId, examPapers.courseOfferingId))
      .innerJoin(teacherAssignments, eq(teacherAssignments.teachingGroupId, teachingGroups.id))
      .innerJoin(
        teachingGroupMemberships,
        and(eq(teachingGroupMemberships.teachingGroupId, teachingGroups.id), eq(teachingGroupMemberships.studentId, examRegistrations.studentId)),
      )
      .where(
        and(
          eq(examRegistrations.examPaperId, paperId),
          eq(teacherAssignments.teacherId, actor.teacherId),
          activeOn(teacherAssignments.startDate, teacherAssignments.endDate, date),
          isNull(teachingGroups.archivedAt),
        ),
      );
    if (!rows.length) throw errors.forbidden('You do not teach this subject to any registered students');
    return rows.map((r) => r.id);
  }

  async markSheet(actor: Actor, paperId: string, sectionId?: string) {
    return this.run(actor, async (tx) => {
      const [paper] = await this.loadPapers(tx, { ids: [paperId] });
      const p = required(paper, 'Paper');
      const allowed = await this.markableRegistrationIds(tx, actor, paperId);
      const [cycle] = await tx.select().from(examCycles).where(eq(examCycles.id, p.examCycleId));
      const rows = await tx
        .select({ r: examRegistrations, m: marksTable, name: accounts.displayName, adm: students.admissionNumber, sectionName: sections.name })
        .from(examRegistrations)
        .innerJoin(students, eq(students.id, examRegistrations.studentId))
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .leftJoin(marksTable, eq(marksTable.examRegistrationId, examRegistrations.id))
        .leftJoin(sections, eq(sections.id, examRegistrations.sectionId))
        .where(
          and(
            eq(examRegistrations.examPaperId, paperId),
            sectionId ? eq(examRegistrations.sectionId, sectionId) : undefined,
            allowed === 'all' ? undefined : inArray(examRegistrations.id, allowed),
          ),
        )
        .orderBy(asc(sections.code), asc(accounts.displayName));
      return {
        paper: p,
        canEdit: this.canEdit(actor, cycle!.state, p.locked),
        rows: rows.map(({ r, m, name, adm, sectionName }) => ({
          registrationId: r.id,
          studentId: r.studentId,
          displayName: name,
          admissionNumber: adm,
          sectionName,
          outcome: m?.outcome ?? null,
          score: m?.score ?? null,
          note: m?.note ?? null,
          version: m?.version ?? null,
        })),
      };
    });
  }

  private canEdit(actor: Actor, cycleState: string, locked: boolean) {
    if (isAdmin(actor)) return ['scheduled', 'marking', 'review'].includes(cycleState);
    return ['scheduled', 'marking'].includes(cycleState) && !locked;
  }

  /**
   * Saves marks with per-mark optimistic concurrency. Stale versions return 409. Changes to existing
   * marks are kept in mark revisions; scores above the paper maximum are rejected (also by a trigger).
   */
  async saveMarks(actor: Actor, paperId: string, raw: z.input<typeof saveMarksRequest>) {
    const input = saveMarksRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [p] = await tx.select().from(examPapers).where(eq(examPapers.id, paperId)).for('share');
      const paper = required(p, 'Paper');
      const [cycle] = await tx.select().from(examCycles).where(eq(examCycles.id, paper.examCycleId));
      if (!this.canEdit(actor, cycle!.state, paper.locked)) {
        throw errors.rule(paper.locked ? 'This paper is locked for review.' : 'Marks cannot be changed at this stage. Published results are corrected through a new revision.');
      }
      const allowed = await this.markableRegistrationIds(tx, actor, paperId);
      const regIds = input.entries.map((e) => e.registrationId);
      const regs = await tx.select().from(examRegistrations).where(and(eq(examRegistrations.examPaperId, paperId), inArray(examRegistrations.id, regIds)));
      if (regs.length !== new Set(regIds).size) throw errors.field('entries', 'A student is not registered for this paper');
      if (allowed !== 'all' && regIds.some((r) => !allowed.includes(r))) throw errors.forbidden('You can only enter marks for students you teach');
      const existing = await tx.select().from(marksTable).where(inArray(marksTable.examRegistrationId, regIds)).for('update');
      let changed = 0;
      for (const e of input.entries) {
        if (e.score && dec(e.score).gt(paper.maxMarks)) throw errors.field('entries', `A score is above the maximum of ${paper.maxMarks}`);
        const prev = existing.find((m) => m.examRegistrationId === e.registrationId);
        if ((prev?.version ?? null) !== e.version) throw errors.version();
        const score = e.outcome === 'score' ? dec(e.score!).toFixed(2) : null;
        if (!prev) {
          await tx.insert(marksTable).values({
            schoolId: actor.schoolId,
            examRegistrationId: e.registrationId,
            outcome: e.outcome,
            score,
            note: e.note ?? null,
            recordedByAccountId: actor.accountId,
          });
          continue;
        }
        if (prev.outcome === e.outcome && (prev.score ?? null) === score && (prev.note ?? null) === (e.note ?? null)) continue;
        changed++;
        await tx
          .update(marksTable)
          .set({ outcome: e.outcome, score, note: e.note ?? null, recordedByAccountId: actor.accountId, recordedAt: new Date(), version: prev.version + 1 })
          .where(eq(marksTable.id, prev.id));
        await tx.insert(markRevisions).values({
          schoolId: actor.schoolId,
          markId: prev.id,
          previousOutcome: prev.outcome,
          previousScore: prev.score,
          newOutcome: e.outcome,
          newScore: score,
          reason: input.reason ?? null,
          changedByAccountId: actor.accountId,
        });
      }
      if (cycle!.state === 'scheduled') await tx.update(examCycles).set({ state: 'marking' }).where(eq(examCycles.id, cycle!.id));
      await audit(tx, actor, { action: 'marks.saved', entityType: 'exam_paper', entityId: paperId, reason: input.reason ?? null, summary: { entries: input.entries.length, changed } });
    });
    return this.markSheet(actor, paperId);
  }
}
