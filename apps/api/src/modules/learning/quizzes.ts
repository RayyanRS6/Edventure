import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { QuizAttempt, QuizSummary } from '@edventure/contracts';
import { createQuizRequest, markAnswerRequest, quizListQuery, saveAnswerRequest, updateQuizRequest, type z } from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  courseOfferings,
  quizAnswers,
  quizAssignments,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
  students,
  subjects,
  teachingGroupMemberships,
  teachingGroups,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { dec, sum } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { activeOn, assertCanTeachGroup, teacherGroupIds, today } from '../../platform/scope';
import { studentAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';

type QuizRow = typeof quizzes.$inferSelect;
type AttemptRow = typeof quizAttempts.$inferSelect;
type QuestionInput = z.infer<typeof createQuizRequest>['questions'][number];

/** Seconds of grace after the deadline for answers already in flight. */
const GRACE_MS = 15_000;

/**
 * Quizzes need connectivity. Timing is server-authoritative: the deadline is fixed when an attempt
 * starts, reconnecting resumes the same attempt, and question versions become immutable once an
 * attempt has used them.
 */
export class QuizService {
  constructor(
    private readonly db: Db,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  private async insertQuestions(tx: Tx, actor: Actor, quizId: string, contentVersion: number, questions: QuestionInput[]) {
    for (const [i, q] of questions.entries()) {
      const [row] = await tx
        .insert(quizQuestions)
        .values({
          schoolId: actor.schoolId,
          quizId,
          contentVersion,
          sequence: i + 1,
          kind: q.kind,
          prompt: q.prompt,
          promptUr: q.promptUr ?? null,
          points: q.points,
          guidance: q.guidance ?? null,
        })
        .returning();
      if (q.kind === 'mcq') {
        await tx.insert(quizOptions).values(
          q.options.map((o, j) => ({ schoolId: actor.schoolId, questionId: row!.id, sequence: j + 1, text: o.text, textUr: o.textUr ?? null, isCorrect: o.isCorrect })),
        );
      }
    }
  }

  async create(actor: Actor, raw: z.input<typeof createQuizRequest>) {
    const input = createQuizRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      await assertCanTeachGroup(tx, actor, input.teachingGroupId);
      if (input.availableFrom && input.availableUntil && input.availableUntil <= input.availableFrom) {
        throw errors.field('availableUntil', 'The closing time must be after the opening time');
      }
      const [quiz] = await tx
        .insert(quizzes)
        .values({
          schoolId: actor.schoolId,
          teachingGroupId: input.teachingGroupId,
          title: input.title,
          titleUr: input.titleUr ?? null,
          instructions: input.instructions ?? null,
          availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
          availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
          timeLimitMinutes: input.timeLimitMinutes ?? null,
          maxAttempts: input.maxAttempts,
          createdByAccountId: actor.accountId,
        })
        .returning();
      await this.insertQuestions(tx, actor, quiz!.id, 1, input.questions);
      await audit(tx, actor, { action: 'quiz.created', entityType: 'quiz', entityId: quiz!.id });
      return quiz!.id;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, raw: z.input<typeof updateQuizRequest>) {
    const input = updateQuizRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id)).for('update');
      const quiz = required(row, 'Quiz');
      await assertCanTeachGroup(tx, actor, quiz.teachingGroupId);
      if (quiz.version !== input.version) throw errors.version();
      let contentVersion = quiz.contentVersion;
      if (input.questions) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: count() })
          .from(quizAttempts)
          .innerJoin(quizAssignments, eq(quizAssignments.id, quizAttempts.quizAssignmentId))
          .where(and(eq(quizAssignments.quizId, id), eq(quizAttempts.contentVersion, quiz.contentVersion)));
        if (n > 0) {
          contentVersion = quiz.contentVersion + 1; // attempts pin the old version; it stays untouched
        } else {
          const old = await tx.select({ id: quizQuestions.id }).from(quizQuestions).where(and(eq(quizQuestions.quizId, id), eq(quizQuestions.contentVersion, quiz.contentVersion)));
          if (old.length) {
            await tx.delete(quizOptions).where(inArray(quizOptions.questionId, old.map((o) => o.id)));
            await tx.delete(quizQuestions).where(inArray(quizQuestions.id, old.map((o) => o.id)));
          }
        }
        await this.insertQuestions(tx, actor, id, contentVersion, input.questions);
      }
      await tx
        .update(quizzes)
        .set({
          ...(input.title ? { title: input.title } : {}),
          ...(input.titleUr !== undefined ? { titleUr: input.titleUr } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
          ...(input.availableFrom !== undefined ? { availableFrom: input.availableFrom ? new Date(input.availableFrom) : null } : {}),
          ...(input.availableUntil !== undefined ? { availableUntil: input.availableUntil ? new Date(input.availableUntil) : null } : {}),
          ...(input.timeLimitMinutes !== undefined ? { timeLimitMinutes: input.timeLimitMinutes } : {}),
          ...(input.maxAttempts ? { maxAttempts: input.maxAttempts } : {}),
          contentVersion,
          version: quiz.version + 1,
        })
        .where(eq(quizzes.id, id));
      await audit(tx, actor, { action: 'quiz.updated', entityType: 'quiz', entityId: id, summary: { contentVersion } });
    });
    return this.get(actor, id);
  }

  async publish(actor: Actor, id: string) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id)).for('update');
      const quiz = required(row, 'Quiz');
      await assertCanTeachGroup(tx, actor, quiz.teachingGroupId);
      if (quiz.state !== 'draft') throw errors.rule('Only draft quizzes can be published.');
      const members = await tx
        .select({ studentId: teachingGroupMemberships.studentId, sce: teachingGroupMemberships.studentCourseEnrollmentId })
        .from(teachingGroupMemberships)
        .where(and(eq(teachingGroupMemberships.teachingGroupId, quiz.teachingGroupId), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, today(actor))));
      if (members.length) {
        await tx
          .insert(quizAssignments)
          .values(members.map((m) => ({ schoolId: actor.schoolId, quizId: id, studentId: m.studentId, studentCourseEnrollmentId: m.sce })))
          .onConflictDoNothing();
      }
      await tx.update(quizzes).set({ state: 'published', version: quiz.version + 1 }).where(eq(quizzes.id, id));
      const subject = await this.subjectOf(tx, quiz.teachingGroupId);
      await this.comms.notify(tx, actor, {
        kind: 'quiz.published',
        data: { subject, title: quiz.title },
        recipients: await studentAccountIds(tx, members.map((m) => m.studentId)),
        entityType: 'quiz',
        entityId: id,
        link: `/quizzes/${id}`,
        dedupeKey: `quiz:${id}`,
      });
      await audit(tx, actor, { action: 'quiz.published', entityType: 'quiz', entityId: id, summary: { students: members.length } });
    });
    return this.get(actor, id);
  }

  async close(actor: Actor, id: string) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id));
      const quiz = required(row, 'Quiz');
      await assertCanTeachGroup(tx, actor, quiz.teachingGroupId);
      await tx.update(quizzes).set({ state: 'closed', version: quiz.version + 1 }).where(eq(quizzes.id, id));
      await audit(tx, actor, { action: 'quiz.closed', entityType: 'quiz', entityId: id });
    });
  }

  async releaseResults(actor: Actor, id: string) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id)).for('update');
      const quiz = required(row, 'Quiz');
      await assertCanTeachGroup(tx, actor, quiz.teachingGroupId);
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(quizAttempts)
        .innerJoin(quizAssignments, eq(quizAssignments.id, quizAttempts.quizAssignmentId))
        .where(and(eq(quizAssignments.quizId, id), eq(quizAttempts.state, 'submitted')));
      if (n > 0) throw errors.rule(`${n} attempt(s) still need marking before results can be released.`);
      await tx.update(quizzes).set({ resultsReleasedAt: new Date(), version: quiz.version + 1 }).where(eq(quizzes.id, id));
      const assigned = await tx.select({ studentId: quizAssignments.studentId }).from(quizAssignments).where(eq(quizAssignments.quizId, id));
      await this.comms.notify(tx, actor, {
        kind: 'quiz.results_released',
        data: { title: quiz.title },
        recipients: await studentAccountIds(tx, assigned.map((a) => a.studentId)),
        entityType: 'quiz',
        entityId: id,
        link: `/quizzes/${id}`,
        dedupeKey: `quiz-results:${id}`,
      });
      await audit(tx, actor, { action: 'quiz.results_released', entityType: 'quiz', entityId: id });
    });
  }

  async grantRetake(actor: Actor, id: string, studentId: string) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id));
      await assertCanTeachGroup(tx, actor, required(row, 'Quiz').teachingGroupId);
      const updated = await tx
        .update(quizAssignments)
        .set({ extraAttempts: sql`${quizAssignments.extraAttempts} + 1` })
        .where(and(eq(quizAssignments.quizId, id), eq(quizAssignments.studentId, studentId)))
        .returning({ id: quizAssignments.id });
      if (!updated.length) throw errors.notFound('Assignment');
      await audit(tx, actor, { action: 'quiz.retake_granted', entityType: 'quiz', entityId: id, summary: { studentId } });
    });
  }

  private async subjectOf(tx: Tx, groupId: string) {
    const [g] = await tx
      .select({ name: subjects.name })
      .from(teachingGroups)
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .where(eq(teachingGroups.id, groupId));
    return g?.name ?? '';
  }

  private isStudentView(actor: Actor) {
    return !!actor.studentId && !isAdmin(actor);
  }

  async list(actor: Actor, raw: z.input<typeof quizListQuery>) {
    const q = quizListQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      if (this.isStudentView(actor)) {
        conditions.push(sql`exists (select 1 from app.quiz_assignments a where a.quiz_id = ${quizzes.id} and a.student_id = ${actor.studentId})`);
        conditions.push(inArray(quizzes.state, ['published', 'closed']));
      } else if (!isAdmin(actor)) {
        if (!actor.teacherId) throw errors.forbidden();
        const groups = await teacherGroupIds(tx, actor.teacherId, today(actor));
        conditions.push(groups.length ? inArray(quizzes.teachingGroupId, groups) : sql`false`);
      }
      if (q.teachingGroupId) conditions.push(eq(quizzes.teachingGroupId, q.teachingGroupId));
      if (q.state) conditions.push(eq(quizzes.state, q.state));
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(sql`(${quizzes.createdAt}, ${quizzes.id}) < (${cursor[0]}::timestamptz, ${cursor[1]}::uuid)`);
      const rows = await tx.select().from(quizzes).where(and(...conditions)).orderBy(desc(quizzes.createdAt), desc(quizzes.id)).limit(q.limit + 1);
      const pageRows = rows.slice(0, q.limit);
      const last = pageRows[pageRows.length - 1];
      return {
        items: await Promise.all(pageRows.map((r) => this.summary(tx, actor, r))),
        nextCursor: rows.length > q.limit && last ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
      };
    });
  }

  private async summary(tx: Tx, actor: Actor, quiz: QuizRow): Promise<QuizSummary> {
    const [g] = await tx
      .select({ name: teachingGroups.name, subject: subjects.name })
      .from(teachingGroups)
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .where(eq(teachingGroups.id, quiz.teachingGroupId));
    const questions = await tx.select({ points: quizQuestions.points }).from(quizQuestions).where(and(eq(quizQuestions.quizId, quiz.id), eq(quizQuestions.contentVersion, quiz.contentVersion)));
    const studentView = this.isStudentView(actor);
    let myAttempt: QuizSummary['myAttempt'] = null;
    let attemptsRemaining: number | null = null;
    let attemptsSubmitted: number | null = null;
    let toMark: number | null = null;
    if (studentView) {
      const [assignment] = await tx.select().from(quizAssignments).where(and(eq(quizAssignments.quizId, quiz.id), eq(quizAssignments.studentId, actor.studentId!)));
      if (assignment) {
        const attempts = await tx.select().from(quizAttempts).where(eq(quizAttempts.quizAssignmentId, assignment.id)).orderBy(desc(quizAttempts.attemptNumber));
        const latest = attempts[0];
        if (latest) {
          myAttempt = {
            id: latest.id,
            state: latest.state,
            score: quiz.resultsReleasedAt && latest.state === 'marked' ? latest.score : null,
            deadlineAt: latest.deadlineAt?.toISOString() ?? null,
          };
        }
        attemptsRemaining = Math.max(0, quiz.maxAttempts + assignment.extraAttempts - attempts.length);
      }
    } else {
      const [counts] = await tx.execute<{ submitted: number; to_mark: number }>(sql`
        select count(*) filter (where t.state in ('submitted', 'marked'))::int as submitted,
               count(*) filter (where t.state = 'submitted')::int as to_mark
        from app.quiz_attempts t join app.quiz_assignments a on a.id = t.quiz_assignment_id where a.quiz_id = ${quiz.id}`);
      attemptsSubmitted = counts?.submitted ?? 0;
      toMark = counts?.to_mark ?? 0;
    }
    return {
      id: quiz.id,
      teachingGroupId: quiz.teachingGroupId,
      groupName: g?.name ?? '',
      subjectName: g?.subject ?? '',
      title: quiz.title,
      titleUr: quiz.titleUr,
      state: quiz.state,
      availableFrom: quiz.availableFrom?.toISOString() ?? null,
      availableUntil: quiz.availableUntil?.toISOString() ?? null,
      timeLimitMinutes: quiz.timeLimitMinutes,
      maxAttempts: quiz.maxAttempts,
      questionCount: questions.length,
      totalPoints: sum(questions.map((q) => q.points)).toFixed(2),
      resultsReleased: quiz.resultsReleasedAt !== null,
      attemptsSubmitted,
      toMark,
      myAttempt,
      attemptsRemaining,
      version: quiz.version,
    };
  }

  private async questionsFor(tx: Tx, quizId: string, contentVersion: number, revealAnswers: boolean) {
    const qs = await tx
      .select()
      .from(quizQuestions)
      .where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.contentVersion, contentVersion)))
      .orderBy(asc(quizQuestions.sequence));
    const opts = qs.length ? await tx.select().from(quizOptions).where(inArray(quizOptions.questionId, qs.map((q) => q.id))).orderBy(asc(quizOptions.sequence)) : [];
    return qs.map((q) => ({
      id: q.id,
      sequence: q.sequence,
      kind: q.kind,
      prompt: q.prompt,
      promptUr: q.promptUr,
      points: q.points,
      options: opts
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, text: o.text, textUr: o.textUr, ...(revealAnswers ? { isCorrect: o.isCorrect } : {}) })),
      ...(revealAnswers ? { guidance: q.guidance } : {}),
    }));
  }

  private async loadQuiz(tx: Tx, actor: Actor, id: string) {
    const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, id));
    const quiz = required(row, 'Quiz');
    if (this.isStudentView(actor)) {
      const [a] = await tx.select({ id: quizAssignments.id }).from(quizAssignments).where(and(eq(quizAssignments.quizId, id), eq(quizAssignments.studentId, actor.studentId!)));
      if (!a || quiz.state === 'draft') throw errors.notFound('Quiz');
    } else {
      await assertCanTeachGroup(tx, actor, quiz.teachingGroupId);
    }
    return quiz;
  }

  /** Teachers see the answer key; students only see questions once they start an attempt. */
  async get(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const quiz = await this.loadQuiz(tx, actor, id);
      const studentView = this.isStudentView(actor);
      return {
        ...(await this.summary(tx, actor, quiz)),
        instructions: quiz.instructions,
        questions: studentView ? [] : await this.questionsFor(tx, id, quiz.contentVersion, true),
      };
    });
  }

  /* ---------------- Attempts ---------------- */

  async start(actor: Actor, quizId: string): Promise<QuizAttempt> {
    if (!actor.studentId) throw errors.forbidden('Only students take quizzes');
    const attemptId = await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, quizId));
      const quiz = required(row, 'Quiz');
      const [assignment] = await tx
        .select()
        .from(quizAssignments)
        .where(and(eq(quizAssignments.quizId, quizId), eq(quizAssignments.studentId, actor.studentId!)))
        .for('update');
      if (!assignment || quiz.state === 'draft') throw errors.notFound('Quiz');
      const attempts = await tx.select().from(quizAttempts).where(eq(quizAttempts.quizAssignmentId, assignment.id)).orderBy(desc(quizAttempts.attemptNumber));
      const current = attempts[0];
      if (current?.state === 'in_progress') {
        if (!this.expired(current)) return current.id; // reconnect resumes the same attempt and timer
        await this.finalize(tx, actor, current, true);
      }
      const now = new Date();
      if (quiz.state !== 'published') throw errors.rule('This quiz is closed.');
      if (quiz.availableFrom && now < quiz.availableFrom) throw errors.rule('This quiz has not opened yet.');
      if (quiz.availableUntil && now > quiz.availableUntil) throw errors.rule('This quiz has closed.');
      if (attempts.length >= quiz.maxAttempts + assignment.extraAttempts) throw errors.rule('You have used all your attempts.');
      const limit = quiz.timeLimitMinutes ? new Date(now.getTime() + quiz.timeLimitMinutes * 60_000) : null;
      const deadline = limit && quiz.availableUntil ? (limit < quiz.availableUntil ? limit : quiz.availableUntil) : (limit ?? quiz.availableUntil);
      const [attempt] = await tx
        .insert(quizAttempts)
        .values({
          schoolId: actor.schoolId,
          quizAssignmentId: assignment.id,
          attemptNumber: (attempts[0]?.attemptNumber ?? 0) + 1,
          contentVersion: quiz.contentVersion,
          startedAt: now,
          deadlineAt: deadline,
        })
        .returning();
      await audit(tx, actor, { action: 'quiz.attempt_started', entityType: 'quiz', entityId: quizId, summary: { attemptId: attempt!.id } });
      return attempt!.id;
    });
    return this.attempt(actor, attemptId);
  }

  private expired(a: AttemptRow) {
    return !!a.deadlineAt && Date.now() > a.deadlineAt.getTime() + GRACE_MS;
  }

  private async attemptFor(tx: Tx, actor: Actor, attemptId: string) {
    // Lock only the attempt row (FOR UPDATE OF cannot take schema-qualified names).
    const [locked] = await tx.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).for('update');
    const t = required(locked, 'Attempt');
    const [row] = await tx
      .select({ a: quizAssignments, q: quizzes })
      .from(quizAssignments)
      .innerJoin(quizzes, eq(quizzes.id, quizAssignments.quizId))
      .where(eq(quizAssignments.id, t.quizAssignmentId));
    const found = { t, ...required(row, 'Attempt') };
    if (this.isStudentView(actor)) {
      if (found.a.studentId !== actor.studentId) throw errors.notFound('Attempt');
    } else {
      await assertCanTeachGroup(tx, actor, found.q.teachingGroupId);
    }
    return found;
  }

  async attempt(actor: Actor, attemptId: string): Promise<QuizAttempt> {
    return this.run(actor, async (tx) => {
      let found = await this.attemptFor(tx, actor, attemptId);
      if (found.t.state === 'in_progress' && this.expired(found.t)) {
        await this.finalize(tx, actor, found.t, true);
        found = await this.attemptFor(tx, actor, attemptId);
      }
      const studentView = this.isStudentView(actor);
      const released = found.q.resultsReleasedAt !== null;
      const reveal = !studentView || (released && found.t.state === 'marked');
      const answers = await tx.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attemptId));
      return {
        id: found.t.id,
        quizId: found.q.id,
        attemptNumber: found.t.attemptNumber,
        state: found.t.state,
        startedAt: found.t.startedAt.toISOString(),
        deadlineAt: found.t.deadlineAt?.toISOString() ?? null,
        submittedAt: found.t.submittedAt?.toISOString() ?? null,
        serverTime: new Date().toISOString(),
        score: reveal ? found.t.score : null,
        maxScore: found.t.maxScore,
        resultsReleased: released,
        questions: await this.questionsFor(tx, found.q.id, found.t.contentVersion, reveal),
        answers: answers.map((a) => ({
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          textAnswer: a.textAnswer,
          score: reveal ? (a.manualScore ?? a.autoScore) : null,
          feedback: reveal ? a.feedback : null,
        })),
      };
    });
  }

  /** Incremental answer saving. Rejected once the server deadline has passed. */
  async saveAnswer(actor: Actor, attemptId: string, raw: z.input<typeof saveAnswerRequest>) {
    const input = saveAnswerRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const found = await this.attemptFor(tx, actor, attemptId);
      if (found.a.studentId !== actor.studentId) throw errors.forbidden();
      if (found.t.state !== 'in_progress') throw errors.rule('This attempt has been submitted.');
      if (this.expired(found.t)) {
        await this.finalize(tx, actor, found.t, true);
        throw errors.rule('Time is up. Your attempt was submitted automatically.');
      }
      const [question] = await tx
        .select()
        .from(quizQuestions)
        .where(and(eq(quizQuestions.id, input.questionId), eq(quizQuestions.quizId, found.q.id), eq(quizQuestions.contentVersion, found.t.contentVersion)));
      const q = required(question, 'Question');
      if (q.kind === 'mcq') {
        if (!input.selectedOptionId) throw errors.field('selectedOptionId', 'Choose an answer');
        const [opt] = await tx.select({ id: quizOptions.id }).from(quizOptions).where(and(eq(quizOptions.id, input.selectedOptionId), eq(quizOptions.questionId, q.id)));
        if (!opt) throw errors.field('selectedOptionId', 'Choose one of the listed answers');
      }
      await tx
        .insert(quizAnswers)
        .values({
          schoolId: actor.schoolId,
          attemptId,
          questionId: q.id,
          selectedOptionId: q.kind === 'mcq' ? input.selectedOptionId! : null,
          textAnswer: q.kind === 'short' ? (input.textAnswer ?? '') : null,
        })
        .onConflictDoUpdate({
          target: [quizAnswers.schoolId, quizAnswers.attemptId, quizAnswers.questionId],
          set: {
            selectedOptionId: q.kind === 'mcq' ? input.selectedOptionId! : null,
            textAnswer: q.kind === 'short' ? (input.textAnswer ?? '') : null,
            savedAt: new Date(),
          },
        });
    });
  }

  async submit(actor: Actor, attemptId: string) {
    await this.run(actor, async (tx) => {
      const found = await this.attemptFor(tx, actor, attemptId);
      if (found.a.studentId !== actor.studentId) throw errors.forbidden();
      if (found.t.state !== 'in_progress') return;
      await this.finalize(tx, actor, found.t, this.expired(found.t));
    });
    return this.attempt(actor, attemptId);
  }

  /** Submits the attempt and auto-marks multiple-choice answers. */
  private async finalize(tx: Tx, actor: Actor, attempt: AttemptRow, auto: boolean) {
    const [assignment] = await tx.select().from(quizAssignments).where(eq(quizAssignments.id, attempt.quizAssignmentId));
    const questions = await tx
      .select()
      .from(quizQuestions)
      .where(and(eq(quizQuestions.quizId, assignment!.quizId), eq(quizQuestions.contentVersion, attempt.contentVersion)));
    const answers = await tx.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attempt.id));
    const correct = await tx
      .select({ id: quizOptions.id, questionId: quizOptions.questionId })
      .from(quizOptions)
      .where(and(inArray(quizOptions.questionId, questions.map((q) => q.id)), eq(quizOptions.isCorrect, true)));
    for (const q of questions.filter((x) => x.kind === 'mcq')) {
      const a = answers.find((x) => x.questionId === q.id);
      const right = correct.find((c) => c.questionId === q.id)?.id;
      const autoScore = a && a.selectedOptionId === right ? q.points : '0';
      if (a) await tx.update(quizAnswers).set({ autoScore }).where(eq(quizAnswers.id, a.id));
      else await tx.insert(quizAnswers).values({ schoolId: actor.schoolId, attemptId: attempt.id, questionId: q.id, autoScore: '0' });
    }
    const needsManual = questions.some((q) => q.kind === 'short');
    const maxScore = sum(questions.map((q) => q.points)).toFixed(2);
    const updatedAnswers = await tx.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attempt.id));
    await tx
      .update(quizAttempts)
      .set({
        state: needsManual ? 'submitted' : 'marked',
        submittedAt: attempt.deadlineAt && auto ? attempt.deadlineAt : new Date(),
        autoSubmitted: auto,
        maxScore,
        score: needsManual ? null : sum(updatedAnswers.map((a) => a.autoScore)).toFixed(2),
      })
      .where(eq(quizAttempts.id, attempt.id));
  }

  async attemptsFor(actor: Actor, quizId: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(quizzes).where(eq(quizzes.id, quizId));
      await assertCanTeachGroup(tx, actor, required(row, 'Quiz').teachingGroupId);
      const rows = await tx
        .select({ t: quizAttempts, a: quizAssignments, name: accounts.displayName })
        .from(quizAttempts)
        .innerJoin(quizAssignments, eq(quizAssignments.id, quizAttempts.quizAssignmentId))
        .innerJoin(students, eq(students.id, quizAssignments.studentId))
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .where(eq(quizAssignments.quizId, quizId))
        .orderBy(asc(accounts.displayName), asc(quizAttempts.attemptNumber));
      // Server-side expiry for abandoned attempts.
      for (const r of rows.filter((x) => x.t.state === 'in_progress' && this.expired(x.t))) await this.finalize(tx, actor, r.t, true);
      const fresh = await tx
        .select({ t: quizAttempts })
        .from(quizAttempts)
        .where(inArray(quizAttempts.id, rows.map((r) => r.t.id).length ? rows.map((r) => r.t.id) : ['00000000-0000-0000-0000-000000000000']));
      return rows.map((r) => {
        const t = fresh.find((f) => f.t.id === r.t.id)?.t ?? r.t;
        return {
          id: t.id,
          studentId: r.a.studentId,
          displayName: r.name,
          attemptNumber: t.attemptNumber,
          state: t.state,
          submittedAt: t.submittedAt?.toISOString() ?? null,
          score: t.score,
          maxScore: t.maxScore,
          needsMarking: t.state === 'submitted',
        };
      });
    });
  }

  /** Teacher marks a short answer; the attempt becomes "marked" once all are scored. */
  async markAnswer(actor: Actor, attemptId: string, questionId: string, raw: z.input<typeof markAnswerRequest>) {
    const input = markAnswerRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const found = await this.attemptFor(tx, actor, attemptId);
      if (this.isStudentView(actor)) throw errors.forbidden();
      if (found.t.state === 'in_progress') throw errors.rule('The attempt has not been submitted yet.');
      const [q] = await tx.select().from(quizQuestions).where(and(eq(quizQuestions.id, questionId), eq(quizQuestions.quizId, found.q.id)));
      const question = required(q, 'Question');
      if (question.kind !== 'short') throw errors.rule('Multiple-choice answers are marked automatically.');
      if (dec(input.score).gt(question.points)) throw errors.field('score', `The score cannot exceed ${question.points}`);
      await tx
        .insert(quizAnswers)
        .values({ schoolId: actor.schoolId, attemptId, questionId, textAnswer: '', manualScore: input.score, feedback: input.feedback ?? null, markedByAccountId: actor.accountId, markedAt: new Date() })
        .onConflictDoUpdate({
          target: [quizAnswers.schoolId, quizAnswers.attemptId, quizAnswers.questionId],
          set: { manualScore: input.score, feedback: input.feedback ?? null, markedByAccountId: actor.accountId, markedAt: new Date() },
        });
      const questions = await tx.select().from(quizQuestions).where(and(eq(quizQuestions.quizId, found.q.id), eq(quizQuestions.contentVersion, found.t.contentVersion)));
      const answers = await tx.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attemptId));
      const unmarked = questions.filter((qq) => qq.kind === 'short' && !answers.some((a) => a.questionId === qq.id && a.manualScore !== null));
      if (!unmarked.length) {
        await tx
          .update(quizAttempts)
          .set({ state: 'marked', score: sum(answers.map((a) => a.manualScore ?? a.autoScore)).toFixed(2) })
          .where(eq(quizAttempts.id, attemptId));
      }
      await audit(tx, actor, { action: 'quiz.answer_marked', entityType: 'quiz', entityId: found.q.id, summary: { attemptId } });
    });
    return this.attempt(actor, attemptId);
  }
}
