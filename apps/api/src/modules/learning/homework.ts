import { and, asc, desc, eq, gte, inArray, isNull, lte, max, or, sql, type SQL } from 'drizzle-orm';
import type { HomeworkDetail, HomeworkSummary } from '@edventure/contracts';
import {
  createHomeworkRequest,
  createMaterialRequest,
  feedbackRequest,
  homeworkListQuery,
  markCompleteRequest,
  submitHomeworkRequest,
  updateHomeworkRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  courseOfferings,
  files,
  homework,
  homeworkAttachments,
  homeworkRecipients,
  homeworkSubmissions,
  learningMaterials,
  students,
  subjects,
  submissionAttachments,
  teachingGroupMemberships,
  teachingGroups,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { isAdmin, isStudent, tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { addDays, zonedTimeToUtc } from '../../platform/dates';
import { dec } from '../../platform/decimal';
import { errors, required } from '../../platform/errors';
import { decodeCursor, encodeCursor } from '../../platform/pagination';
import { activeOn, assertCanTeachGroup, classTeacherSectionIds, teacherGroupIds, today } from '../../platform/scope';
import { studentAccountIds } from '../communications/audience';
import type { CommunicationsService } from '../communications/service';
import { toFileRef, type FilesService } from '../files/service';

type HomeworkRow = typeof homework.$inferSelect;

export function dueInstant(dueDate: string, dueTime: string | null, timezone: string) {
  return dueTime ? zonedTimeToUtc(dueDate, dueTime.slice(0, 5), timezone) : zonedTimeToUtc(addDays(dueDate, 1), '00:00', timezone);
}

/**
 * Homework: assigned to teaching groups, recipients snapshotted at publication, submission revisions
 * preserved, late submissions allowed with a visible flag, teacher feedback and optional marks.
 */
export class HomeworkService {
  constructor(
    private readonly db: Db,
    private readonly files: FilesService,
    private readonly comms: CommunicationsService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  private async groupInfo(tx: Tx, groupId: string) {
    const [g] = await tx
      .select({ g: teachingGroups, subjectName: subjects.name, subjectNameUr: subjects.nameUr })
      .from(teachingGroups)
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .where(eq(teachingGroups.id, groupId));
    return required(g, 'Teaching group');
  }

  async create(actor: Actor, raw: z.input<typeof createHomeworkRequest>) {
    const input = createHomeworkRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      await assertCanTeachGroup(tx, actor, input.teachingGroupId);
      if (input.dueDate < today(actor)) throw errors.field('dueDate', 'The due date cannot be in the past');
      await this.files.assertAttachable(tx, actor, input.attachmentFileIds, ['homework_attachment', 'material', 'document']);
      const [row] = await tx
        .insert(homework)
        .values({
          schoolId: actor.schoolId,
          teachingGroupId: input.teachingGroupId,
          title: input.title,
          titleUr: input.titleUr ?? null,
          instructions: input.instructions ?? null,
          instructionsUr: input.instructionsUr ?? null,
          dueDate: input.dueDate,
          dueTime: input.dueTime ?? null,
          submissionPolicy: input.submissionPolicy,
          maxScore: input.maxScore ?? null,
          createdByTeacherId: actor.teacherId,
          createdByAccountId: actor.accountId,
        })
        .returning();
      if (input.attachmentFileIds.length) {
        await tx.insert(homeworkAttachments).values(input.attachmentFileIds.map((fileId) => ({ schoolId: actor.schoolId, homeworkId: row!.id, fileId })));
      }
      await audit(tx, actor, { action: 'homework.created', entityType: 'homework', entityId: row!.id });
      if (input.publish) await this.publishInTx(tx, actor, row!);
      return row!.id;
    });
    return this.get(actor, id);
  }

  async publish(actor: Actor, id: string) {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id)).for('update');
      const hw = required(row, 'Homework');
      await assertCanTeachGroup(tx, actor, hw.teachingGroupId);
      if (hw.state !== 'draft') throw errors.rule('Only drafts can be published.');
      await this.publishInTx(tx, actor, hw);
    });
    return this.get(actor, id);
  }

  private async publishInTx(tx: Tx, actor: Actor, hw: HomeworkRow) {
    const date = today(actor);
    const members = await tx
      .select({ studentId: teachingGroupMemberships.studentId, sce: teachingGroupMemberships.studentCourseEnrollmentId })
      .from(teachingGroupMemberships)
      .where(and(eq(teachingGroupMemberships.teachingGroupId, hw.teachingGroupId), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, date)));
    if (members.length) {
      await tx
        .insert(homeworkRecipients)
        .values(members.map((m) => ({ schoolId: actor.schoolId, homeworkId: hw.id, studentId: m.studentId, studentCourseEnrollmentId: m.sce })))
        .onConflictDoNothing();
    }
    await tx.update(homework).set({ state: 'published', publishedAt: new Date(), version: sql`${homework.version} + 1` }).where(eq(homework.id, hw.id));
    const g = await this.groupInfo(tx, hw.teachingGroupId);
    await this.comms.notify(tx, actor, {
      kind: 'homework.published',
      data: { subject: g.subjectName, subjectUr: g.subjectNameUr, title: hw.title, dueDate: hw.dueDate },
      recipients: await studentAccountIds(tx, members.map((m) => m.studentId)),
      entityType: 'homework',
      entityId: hw.id,
      link: `/homework/${hw.id}`,
      dedupeKey: `homework:${hw.id}`,
    });
    await audit(tx, actor, { action: 'homework.published', entityType: 'homework', entityId: hw.id, summary: { recipients: members.length } });
  }

  /** Adds students who joined the group after publication (explicit, never automatic). */
  async addNewMembers(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      await assertCanTeachGroup(tx, actor, hw.teachingGroupId);
      if (hw.state !== 'published') throw errors.rule('Only published homework can gain recipients.');
      const date = today(actor);
      const added = await tx.execute<{ student_id: string }>(sql`
        insert into app.homework_recipients (school_id, homework_id, student_id, student_course_enrollment_id, added_reason)
        select ${actor.schoolId}, ${id}, m.student_id, m.student_course_enrollment_id, 'late_join'
        from app.teaching_group_memberships m
        where m.teaching_group_id = ${hw.teachingGroupId} and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date})
        on conflict do nothing returning student_id`);
      if (added.length) {
        const g = await this.groupInfo(tx, hw.teachingGroupId);
        await this.comms.notify(tx, actor, {
          kind: 'homework.published',
          data: { subject: g.subjectName, title: hw.title, dueDate: hw.dueDate },
          recipients: await studentAccountIds(tx, added.map((a) => a.student_id)),
          entityType: 'homework',
          entityId: id,
          link: `/homework/${id}`,
        });
      }
      await audit(tx, actor, { action: 'homework.recipients_added', entityType: 'homework', entityId: id, summary: { added: added.length } });
      return { added: added.length };
    });
  }

  async update(actor: Actor, id: string, raw: z.input<typeof updateHomeworkRequest>) {
    const input = updateHomeworkRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id)).for('update');
      const hw = required(row, 'Homework');
      await assertCanTeachGroup(tx, actor, hw.teachingGroupId);
      if (hw.version !== input.version) throw errors.version();
      if (hw.state === 'archived') throw errors.rule('Archived homework cannot be edited.');
      await tx
        .update(homework)
        .set({
          ...(input.title ? { title: input.title } : {}),
          ...(input.titleUr !== undefined ? { titleUr: input.titleUr } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
          ...(input.instructionsUr !== undefined ? { instructionsUr: input.instructionsUr } : {}),
          ...(input.dueDate ? { dueDate: input.dueDate } : {}),
          ...(input.dueTime !== undefined ? { dueTime: input.dueTime } : {}),
          version: sql`${homework.version} + 1`,
        })
        .where(eq(homework.id, id));
      if (input.attachmentFileIds) {
        // Existing attachments may have been uploaded by a colleague; only new ones are checked.
        const existing = (await tx.select({ fileId: homeworkAttachments.fileId }).from(homeworkAttachments).where(eq(homeworkAttachments.homeworkId, id))).map((a) => a.fileId);
        const fresh = input.attachmentFileIds.filter((f) => !existing.includes(f));
        await this.files.assertAttachable(tx, actor, fresh, ['homework_attachment', 'material', 'document']);
        await tx.delete(homeworkAttachments).where(eq(homeworkAttachments.homeworkId, id));
        if (input.attachmentFileIds.length) {
          await tx.insert(homeworkAttachments).values(input.attachmentFileIds.map((fileId) => ({ schoolId: actor.schoolId, homeworkId: id, fileId })));
        }
      }
      await audit(tx, actor, { action: 'homework.updated', entityType: 'homework', entityId: id });
    });
    return this.get(actor, id);
  }

  async setState(actor: Actor, id: string, state: 'closed' | 'archived') {
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      await assertCanTeachGroup(tx, actor, hw.teachingGroupId);
      await tx.update(homework).set({ state, version: sql`${homework.version} + 1` }).where(eq(homework.id, id));
      await audit(tx, actor, { action: `homework.${state}`, entityType: 'homework', entityId: id });
    });
  }

  async list(actor: Actor, raw: z.input<typeof homeworkListQuery>) {
    const q = homeworkListQuery.parse(raw);
    return this.run(actor, async (tx) => {
      const conditions: SQL[] = [];
      const date = today(actor);
      if (isStudent(actor) && !isAdmin(actor)) {
        conditions.push(sql`exists (select 1 from app.homework_recipients r where r.homework_id = ${homework.id} and r.student_id = ${actor.studentId}
          ${q.status ? sql`and r.completion_state = ${q.status}::app.homework_completion_state` : sql``})`);
        conditions.push(inArray(homework.state, ['published', 'closed']));
      } else if (!isAdmin(actor)) {
        if (!actor.teacherId) throw errors.forbidden();
        const groups = await teacherGroupIds(tx, actor.teacherId, date);
        let allowed = groups;
        if (q.sectionId) {
          const own = await classTeacherSectionIds(tx, actor.teacherId, date);
          if (own.includes(q.sectionId)) allowed = []; // class-teacher overview of the whole section
        }
        if (allowed.length || !q.sectionId) conditions.push(allowed.length ? inArray(homework.teachingGroupId, allowed) : sql`false`);
      }
      if (q.teachingGroupId) conditions.push(eq(homework.teachingGroupId, q.teachingGroupId));
      if (q.sectionId) conditions.push(sql`exists (select 1 from app.teaching_groups g where g.id = ${homework.teachingGroupId} and g.section_id = ${q.sectionId})`);
      if (q.state) conditions.push(eq(homework.state, q.state));
      if (q.dueFrom) conditions.push(gte(homework.dueDate, q.dueFrom));
      if (q.dueTo) conditions.push(lte(homework.dueDate, q.dueTo));
      const cursor = decodeCursor(q.cursor, 2) as [string, string] | null;
      if (cursor) conditions.push(or(sql`${homework.dueDate} < ${cursor[0]}`, and(eq(homework.dueDate, cursor[0]), sql`${homework.id} < ${cursor[1]}`))!);
      const rows = await tx.select().from(homework).where(and(...conditions)).orderBy(desc(homework.dueDate), desc(homework.id)).limit(q.limit + 1);
      const pageRows = rows.slice(0, q.limit);
      const items = await this.summaries(tx, actor, pageRows);
      const last = pageRows[pageRows.length - 1];
      return { items, nextCursor: rows.length > q.limit && last ? encodeCursor([last.dueDate, last.id]) : null };
    });
  }

  private async summaries(tx: Tx, actor: Actor, rows: HomeworkRow[]): Promise<HomeworkSummary[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const groups = await tx
      .select({ id: teachingGroups.id, name: teachingGroups.name, subjectName: subjects.name, subjectNameUr: subjects.nameUr })
      .from(teachingGroups)
      .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .where(inArray(teachingGroups.id, [...new Set(rows.map((r) => r.teachingGroupId))]));
    const creators = await tx.select({ id: accounts.id, name: accounts.displayName }).from(accounts).where(inArray(accounts.id, [...new Set(rows.map((r) => r.createdByAccountId))]));
    const studentView = isStudent(actor) && !isAdmin(actor);
    const mine = studentView
      ? await tx
          .select({ r: homeworkRecipients, late: sql<boolean>`exists (select 1 from app.homework_submissions s where s.recipient_id = ${homeworkRecipients.id} and s.is_late)` })
          .from(homeworkRecipients)
          .where(and(inArray(homeworkRecipients.homeworkId, ids), eq(homeworkRecipients.studentId, actor.studentId!)))
      : [];
    const completion = !studentView
      ? await tx.execute<{ homework_id: string; total: number; submitted: number; completed: number; late: number }>(sql`
          select r.homework_id, count(*)::int as total,
            count(*) filter (where r.completion_state = 'submitted')::int as submitted,
            count(*) filter (where r.completion_state in ('completed', 'excused'))::int as completed,
            count(*) filter (where exists (select 1 from app.homework_submissions s where s.recipient_id = r.id and s.is_late))::int as late
          from app.homework_recipients r where r.homework_id in ${ids} group by r.homework_id`)
      : [];
    return rows.map((r) => {
      const g = groups.find((x) => x.id === r.teachingGroupId);
      const m = mine.find((x) => x.r.homeworkId === r.id);
      const c = completion.find((x) => x.homework_id === r.id);
      return {
        id: r.id,
        teachingGroupId: r.teachingGroupId,
        groupName: g?.name ?? '',
        subjectName: g?.subjectName ?? '',
        subjectNameUr: g?.subjectNameUr ?? null,
        title: r.title,
        titleUr: r.titleUr,
        dueDate: r.dueDate,
        dueTime: r.dueTime ? r.dueTime.slice(0, 5) : null,
        submissionPolicy: r.submissionPolicy,
        maxScore: r.maxScore,
        state: r.state,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        createdBy: creators.find((x) => x.id === r.createdByAccountId)?.name ?? '',
        completion: studentView ? null : { total: c?.total ?? 0, submitted: c?.submitted ?? 0, completed: c?.completed ?? 0, late: c?.late ?? 0 },
        myStatus: studentView ? (m?.r.completionState ?? null) : null,
        myLate: studentView ? (m?.late ?? false) : null,
        version: r.version,
      };
    });
  }

  private async assertCanView(tx: Tx, actor: Actor, hw: HomeworkRow) {
    if (isAdmin(actor)) return;
    if (actor.studentId) {
      const [r] = await tx.select({ id: homeworkRecipients.id }).from(homeworkRecipients).where(and(eq(homeworkRecipients.homeworkId, hw.id), eq(homeworkRecipients.studentId, actor.studentId)));
      if (r && hw.state !== 'draft') return;
    }
    if (actor.teacherId) {
      const groups = await teacherGroupIds(tx, actor.teacherId, today(actor));
      if (groups.includes(hw.teachingGroupId)) return;
      const [g] = await tx.select({ sectionId: teachingGroups.sectionId }).from(teachingGroups).where(eq(teachingGroups.id, hw.teachingGroupId));
      const own = await classTeacherSectionIds(tx, actor.teacherId, today(actor));
      if (g?.sectionId && own.includes(g.sectionId)) return;
    }
    throw errors.notFound('Homework');
  }

  async get(actor: Actor, id: string): Promise<HomeworkDetail> {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      await this.assertCanView(tx, actor, hw);
      const [summary] = await this.summaries(tx, actor, [hw]);
      const attachmentIds = (await tx.select({ fileId: homeworkAttachments.fileId }).from(homeworkAttachments).where(eq(homeworkAttachments.homeworkId, id))).map((a) => a.fileId);
      let mySubmissions: HomeworkDetail['mySubmissions'] = null;
      if (actor.studentId && !isAdmin(actor)) {
        const [recipient] = await tx.select().from(homeworkRecipients).where(and(eq(homeworkRecipients.homeworkId, id), eq(homeworkRecipients.studentId, actor.studentId)));
        mySubmissions = recipient ? await this.submissionsFor(tx, recipient.id) : [];
      }
      return {
        ...summary!,
        instructions: hw.instructions,
        instructionsUr: hw.instructionsUr,
        attachments: await this.files.refs(tx, attachmentIds),
        mySubmissions,
      };
    });
  }

  private async submissionsFor(tx: Tx, recipientId: string) {
    const subs = await tx.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.recipientId, recipientId)).orderBy(desc(homeworkSubmissions.revision));
    const atts = subs.length
      ? await tx.select({ a: submissionAttachments, f: files }).from(submissionAttachments).innerJoin(files, eq(files.id, submissionAttachments.fileId)).where(inArray(submissionAttachments.submissionId, subs.map((s) => s.id)))
      : [];
    return subs.map((s) => ({
      id: s.id,
      revision: s.revision,
      body: s.body,
      submittedAt: s.submittedAt.toISOString(),
      isLate: s.isLate,
      attachments: atts.filter((a) => a.a.submissionId === s.id).map((a) => toFileRef(a.f)),
      feedback: s.feedback,
      score: s.score,
    }));
  }

  async recipients(actor: Actor, id: string) {
    return this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      if (!isAdmin(actor)) {
        if (!actor.teacherId) throw errors.forbidden();
        await this.assertCanView(tx, actor, hw);
      }
      const rows = await tx
        .select({ r: homeworkRecipients, name: accounts.displayName, adm: students.admissionNumber })
        .from(homeworkRecipients)
        .innerJoin(students, eq(students.id, homeworkRecipients.studentId))
        .innerJoin(accounts, eq(accounts.id, students.accountId))
        .where(eq(homeworkRecipients.homeworkId, id))
        .orderBy(asc(accounts.displayName));
      return Promise.all(
        rows.map(async ({ r, name, adm }) => {
          const [latest] = await this.submissionsFor(tx, r.id);
          return {
            recipientId: r.id,
            studentId: r.studentId,
            displayName: name,
            admissionNumber: adm,
            completionState: r.completionState,
            latestSubmission: latest ?? null,
            version: r.version,
          };
        }),
      );
    });
  }

  async submit(actor: Actor, id: string, raw: z.input<typeof submitHomeworkRequest>) {
    if (!actor.studentId) throw errors.forbidden('Only students submit homework');
    const input = submitHomeworkRequest.parse(raw);
    if (!input.body && !input.attachmentFileIds.length) throw errors.field('body', 'Add a note or attach your work');
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      if (hw.state !== 'published') throw errors.rule(hw.state === 'closed' ? 'This homework is closed for submissions.' : 'This homework is not open.');
      if (hw.submissionPolicy === 'none') throw errors.rule('This homework does not take submissions.');
      const [recipient] = await tx
        .select()
        .from(homeworkRecipients)
        .where(and(eq(homeworkRecipients.homeworkId, id), eq(homeworkRecipients.studentId, actor.studentId!)))
        .for('update');
      const rec = required(recipient, 'Homework');
      await this.files.assertAttachable(tx, actor, input.attachmentFileIds, ['submission']);
      const [{ last } = { last: 0 }] = await tx.select({ last: max(homeworkSubmissions.revision) }).from(homeworkSubmissions).where(eq(homeworkSubmissions.recipientId, rec.id));
      const isLate = Date.now() > dueInstant(hw.dueDate, hw.dueTime, actor.timezone).getTime();
      const [sub] = await tx
        .insert(homeworkSubmissions)
        .values({ schoolId: actor.schoolId, recipientId: rec.id, revision: (last ?? 0) + 1, body: input.body ?? null, isLate })
        .returning();
      if (input.attachmentFileIds.length) {
        await tx.insert(submissionAttachments).values(input.attachmentFileIds.map((fileId) => ({ schoolId: actor.schoolId, submissionId: sub!.id, fileId })));
      }
      await tx
        .update(homeworkRecipients)
        .set({ completionState: 'submitted', completedAt: new Date(), version: rec.version + 1 })
        .where(eq(homeworkRecipients.id, rec.id));
      await audit(tx, actor, { action: 'homework.submitted', entityType: 'homework', entityId: id, summary: { revision: sub!.revision, isLate } });
    });
    return this.get(actor, id);
  }

  async feedback(actor: Actor, submissionId: string, raw: z.input<typeof feedbackRequest>) {
    const input = feedbackRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx
        .select({ s: homeworkSubmissions, r: homeworkRecipients, h: homework })
        .from(homeworkSubmissions)
        .innerJoin(homeworkRecipients, eq(homeworkRecipients.id, homeworkSubmissions.recipientId))
        .innerJoin(homework, eq(homework.id, homeworkRecipients.homeworkId))
        .where(eq(homeworkSubmissions.id, submissionId));
      const found = required(row, 'Submission');
      await assertCanTeachGroup(tx, actor, found.h.teachingGroupId);
      if (input.score && (!found.h.maxScore || dec(input.score).gt(found.h.maxScore))) {
        throw errors.field('score', found.h.maxScore ? `The score cannot exceed ${found.h.maxScore}` : 'This homework is not scored');
      }
      await tx
        .update(homeworkSubmissions)
        .set({ feedback: input.feedback ?? null, score: input.score ?? null, feedbackByAccountId: actor.accountId, feedbackAt: new Date() })
        .where(eq(homeworkSubmissions.id, submissionId));
      if (input.markCompleted) {
        await tx.update(homeworkRecipients).set({ completionState: 'completed', version: sql`${homeworkRecipients.version} + 1` }).where(eq(homeworkRecipients.id, found.r.id));
      }
      await this.comms.notify(tx, actor, {
        kind: 'homework.feedback',
        data: { title: found.h.title },
        recipients: await studentAccountIds(tx, [found.r.studentId]),
        entityType: 'homework',
        entityId: found.h.id,
        link: `/homework/${found.h.id}`,
      });
      await audit(tx, actor, { action: 'homework.feedback_given', entityType: 'homework', entityId: found.h.id });
    });
  }

  async markCompletion(actor: Actor, id: string, raw: z.input<typeof markCompleteRequest>) {
    const input = markCompleteRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [row] = await tx.select().from(homework).where(eq(homework.id, id));
      const hw = required(row, 'Homework');
      await assertCanTeachGroup(tx, actor, hw.teachingGroupId);
      await tx
        .update(homeworkRecipients)
        .set({ completionState: input.state, completedAt: input.state === 'pending' ? null : new Date(), version: sql`${homeworkRecipients.version} + 1` })
        .where(and(eq(homeworkRecipients.homeworkId, id), inArray(homeworkRecipients.studentId, input.studentIds)));
      await audit(tx, actor, { action: 'homework.completion_marked', entityType: 'homework', entityId: id, summary: { state: input.state, students: input.studentIds.length } });
    });
  }

  /** Section-level completion summary for class teachers and administrators. */
  async sectionSummary(actor: Actor, sectionId: string, from: string, to: string) {
    return this.run(actor, async (tx) => {
      if (!isAdmin(actor)) {
        const own = actor.teacherId ? await classTeacherSectionIds(tx, actor.teacherId, today(actor)) : [];
        if (!own.includes(sectionId)) throw errors.forbidden();
      }
      const rows = await tx.execute<{ homework_id: string; title: string; subject_name: string; due_date: string; total: number; done: number }>(sql`
        select h.id as homework_id, h.title, s.name as subject_name, h.due_date::text as due_date,
          count(r.id)::int as total,
          count(r.id) filter (where r.completion_state in ('submitted', 'completed', 'excused'))::int as done
        from app.homework h
        join app.teaching_groups g on g.id = h.teaching_group_id
        join app.course_offerings c on c.id = g.course_offering_id
        join app.subjects s on s.id = c.subject_id
        join app.homework_recipients r on r.homework_id = h.id
        join app.student_placements p on p.student_id = r.student_id and p.section_id = ${sectionId}
          and p.start_date <= h.due_date and (p.end_date is null or p.end_date > h.due_date)
        where h.state in ('published', 'closed') and h.due_date between ${from} and ${to}
        group by h.id, h.title, s.name, h.due_date order by h.due_date`);
      return {
        sectionId,
        from,
        to,
        items: rows.map((r) => ({ homeworkId: r.homework_id, title: r.title, subjectName: r.subject_name, dueDate: r.due_date, total: r.total, done: r.done })),
      };
    });
  }

  /* ---------------- Learning materials ---------------- */

  async createMaterial(actor: Actor, raw: z.input<typeof createMaterialRequest>) {
    const input = createMaterialRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      await assertCanTeachGroup(tx, actor, input.teachingGroupId);
      await this.files.assertAttachable(tx, actor, [input.fileId], ['material', 'document', 'homework_attachment']);
      const [row] = await tx
        .insert(learningMaterials)
        .values({
          schoolId: actor.schoolId,
          teachingGroupId: input.teachingGroupId,
          title: input.title,
          titleUr: input.titleUr ?? null,
          description: input.description ?? null,
          fileId: input.fileId,
          publishedAt: new Date(),
          createdByAccountId: actor.accountId,
        })
        .returning();
      const g = await this.groupInfo(tx, input.teachingGroupId);
      const members = await tx
        .select({ id: teachingGroupMemberships.studentId })
        .from(teachingGroupMemberships)
        .where(and(eq(teachingGroupMemberships.teachingGroupId, input.teachingGroupId), activeOn(teachingGroupMemberships.startDate, teachingGroupMemberships.endDate, today(actor))));
      await this.comms.notify(tx, actor, {
        kind: 'material.published',
        data: { subject: g.subjectName, title: input.title },
        recipients: await studentAccountIds(tx, members.map((m) => m.id)),
        entityType: 'learning_material',
        entityId: row!.id,
        link: `/materials/${row!.id}`,
      });
      await audit(tx, actor, { action: 'material.published', entityType: 'learning_material', entityId: row!.id });
      return row!.id;
    });
    return (await this.listMaterials(actor, { ids: [id] }))[0]!;
  }

  async listMaterials(actor: Actor, filter: { teachingGroupId?: string; ids?: string[] }) {
    return this.run(actor, async (tx) => {
      const date = today(actor);
      const conditions: SQL[] = [isNull(learningMaterials.archivedAt)];
      if (filter.ids) conditions.push(inArray(learningMaterials.id, filter.ids));
      if (filter.teachingGroupId) conditions.push(eq(learningMaterials.teachingGroupId, filter.teachingGroupId));
      if (!isAdmin(actor)) {
        if (actor.studentId) {
          conditions.push(sql`exists (select 1 from app.teaching_group_memberships m where m.teaching_group_id = ${learningMaterials.teachingGroupId}
            and m.student_id = ${actor.studentId} and m.start_date <= ${date} and (m.end_date is null or m.end_date > ${date}))`);
        } else if (actor.teacherId) {
          const groups = await teacherGroupIds(tx, actor.teacherId, date);
          conditions.push(groups.length ? inArray(learningMaterials.teachingGroupId, groups) : sql`false`);
        } else throw errors.forbidden();
      }
      const rows = await tx
        .select({ m: learningMaterials, f: files, groupName: teachingGroups.name, subjectName: subjects.name, creator: accounts.displayName })
        .from(learningMaterials)
        .innerJoin(files, eq(files.id, learningMaterials.fileId))
        .innerJoin(teachingGroups, eq(teachingGroups.id, learningMaterials.teachingGroupId))
        .innerJoin(courseOfferings, eq(courseOfferings.id, teachingGroups.courseOfferingId))
        .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
        .innerJoin(accounts, eq(accounts.id, learningMaterials.createdByAccountId))
        .where(and(...conditions))
        .orderBy(desc(learningMaterials.createdAt))
        .limit(200);
      return rows.map(({ m, f, groupName, subjectName, creator }) => ({
        id: m.id,
        teachingGroupId: m.teachingGroupId,
        groupName,
        subjectName,
        title: m.title,
        titleUr: m.titleUr,
        description: m.description,
        file: toFileRef(f),
        publishedAt: m.publishedAt?.toISOString() ?? null,
        createdBy: creator,
      }));
    });
  }

  async archiveMaterial(actor: Actor, id: string) {
    await this.run(actor, async (tx) => {
      const [m] = await tx.select().from(learningMaterials).where(eq(learningMaterials.id, id));
      const material = required(m, 'Material');
      await assertCanTeachGroup(tx, actor, material.teachingGroupId);
      await tx.update(learningMaterials).set({ archivedAt: new Date() }).where(eq(learningMaterials.id, id));
      await audit(tx, actor, { action: 'material.archived', entityType: 'learning_material', entityId: id });
    });
  }
}
