import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { ClassOffering, CourseOffering, Curriculum, GradeLevel, Section } from '@edventure/contracts';
import {
  createClassOfferingRequest,
  createCourseOfferingRequest,
  createCurriculumRequest,
  createGradeLevelRequest,
  createSectionRequest,
  createStreamRequest,
  createSubjectRequest,
  updateCourseOfferingRequest,
  updateCurriculumRequest,
  updateGradeLevelRequest,
  updateSectionRequest,
  updateStreamRequest,
  updateSubjectRequest,
  type z,
} from '@edventure/contracts';
import type { Db, Tx } from '../../db/client';
import {
  accounts,
  classOfferings,
  classTeacherAssignments,
  courseOfferings,
  curriculumSubjects,
  curriculumVersions,
  gradeLevels,
  sections,
  streams,
  studentEnrollments,
  studentPlacements,
  subjects,
  teachers,
} from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { tenantOf, type Actor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors, required } from '../../platform/errors';
import { activeOn, requireAdmin, today } from '../../platform/scope';
import { assertYearWritable } from '../school/service';
import type { EnrollmentService } from './enrollment';

type GradeRow = typeof gradeLevels.$inferSelect;

const toGrade = (g: GradeRow): GradeLevel => ({
  id: g.id,
  code: g.code,
  name: g.name,
  nameUr: g.nameUr,
  sortOrder: g.sortOrder,
  nextGradeLevelId: g.nextGradeLevelId,
  isTerminal: g.isTerminal,
  archived: g.archivedAt !== null,
});

export class AcademicsService {
  constructor(
    private readonly db: Db,
    private readonly enrollment: () => EnrollmentService,
  ) {}

  private run<T>(actor: Actor, fn: (tx: Tx) => Promise<T>) {
    return withTenant(this.db, tenantOf(actor), fn);
  }

  /* ---------------- Grade levels ---------------- */

  async listGradeLevels(actor: Actor) {
    return this.run(actor, async (tx) => (await tx.select().from(gradeLevels).orderBy(asc(gradeLevels.sortOrder))).map(toGrade));
  }

  async createGradeLevel(actor: Actor, raw: z.input<typeof createGradeLevelRequest>) {
    requireAdmin(actor);
    const input = createGradeLevelRequest.parse(raw);
    if (input.isTerminal && input.nextGradeLevelId) throw errors.field('nextGradeLevelId', 'A final class cannot have a next class');
    return this.run(actor, async (tx) => {
      const [row] = await tx
        .insert(gradeLevels)
        .values({ schoolId: actor.schoolId, ...input, nameUr: input.nameUr ?? null, nextGradeLevelId: input.nextGradeLevelId ?? null })
        .returning();
      await audit(tx, actor, { action: 'grade_level.created', entityType: 'grade_level', entityId: row!.id, summary: { code: input.code } });
      return toGrade(row!);
    });
  }

  async updateGradeLevel(actor: Actor, id: string, raw: z.input<typeof updateGradeLevelRequest>) {
    requireAdmin(actor);
    const input = updateGradeLevelRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [row] = await tx
        .update(gradeLevels)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.nameUr !== undefined ? { nameUr: input.nameUr } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.nextGradeLevelId !== undefined ? { nextGradeLevelId: input.nextGradeLevelId } : {}),
          ...(input.isTerminal !== undefined ? { isTerminal: input.isTerminal } : {}),
          ...(input.isTerminal ? { nextGradeLevelId: null } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        })
        .where(eq(gradeLevels.id, id))
        .returning();
      await audit(tx, actor, { action: 'grade_level.updated', entityType: 'grade_level', entityId: id });
      return toGrade(required(row, 'Class'));
    });
  }

  /* ---------------- Subjects and streams ---------------- */

  async listSubjects(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(subjects).orderBy(asc(subjects.name))).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        nameUr: s.nameUr,
        archived: s.archivedAt !== null,
      })),
    );
  }

  async createSubject(actor: Actor, raw: z.input<typeof createSubjectRequest>) {
    requireAdmin(actor);
    const input = createSubjectRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [s] = await tx.insert(subjects).values({ schoolId: actor.schoolId, ...input, nameUr: input.nameUr ?? null }).returning();
      await audit(tx, actor, { action: 'subject.created', entityType: 'subject', entityId: s!.id, summary: { code: input.code } });
      return { id: s!.id, code: s!.code, name: s!.name, nameUr: s!.nameUr, archived: false };
    });
  }

  /** Subjects referenced by history are archived, never deleted. */
  async updateSubject(actor: Actor, id: string, raw: z.input<typeof updateSubjectRequest>) {
    requireAdmin(actor);
    const input = updateSubjectRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [s] = await tx
        .update(subjects)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.nameUr !== undefined ? { nameUr: input.nameUr } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        })
        .where(eq(subjects.id, id))
        .returning();
      const subject = required(s, 'Subject');
      await audit(tx, actor, { action: 'subject.updated', entityType: 'subject', entityId: id });
      return { id: subject.id, code: subject.code, name: subject.name, nameUr: subject.nameUr, archived: subject.archivedAt !== null };
    });
  }

  async listStreams(actor: Actor) {
    return this.run(actor, async (tx) =>
      (await tx.select().from(streams).orderBy(asc(streams.name))).map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        nameUr: s.nameUr,
        description: s.description,
        archived: s.archivedAt !== null,
      })),
    );
  }

  async createStream(actor: Actor, raw: z.input<typeof createStreamRequest>) {
    requireAdmin(actor);
    const input = createStreamRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [s] = await tx
        .insert(streams)
        .values({ schoolId: actor.schoolId, ...input, nameUr: input.nameUr ?? null, description: input.description ?? null })
        .returning();
      await audit(tx, actor, { action: 'stream.created', entityType: 'stream', entityId: s!.id });
      return { id: s!.id, code: s!.code, name: s!.name, nameUr: s!.nameUr, description: s!.description, archived: false };
    });
  }

  async updateStream(actor: Actor, id: string, raw: z.input<typeof updateStreamRequest>) {
    requireAdmin(actor);
    const input = updateStreamRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [s] = await tx
        .update(streams)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.nameUr !== undefined ? { nameUr: input.nameUr } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        })
        .where(eq(streams.id, id))
        .returning();
      const stream = required(s, 'Stream');
      await audit(tx, actor, { action: 'stream.updated', entityType: 'stream', entityId: id });
      return { id: stream.id, code: stream.code, name: stream.name, nameUr: stream.nameUr, description: stream.description, archived: stream.archivedAt !== null };
    });
  }

  /* ---------------- Curricula ---------------- */

  private async loadCurriculum(tx: Tx, id: string): Promise<Curriculum> {
    const [v] = await tx.select().from(curriculumVersions).where(eq(curriculumVersions.id, id));
    const version = required(v, 'Curriculum');
    const rows = await tx
      .select({ cs: curriculumSubjects, subjectName: subjects.name, streamName: streams.name })
      .from(curriculumSubjects)
      .innerJoin(subjects, eq(subjects.id, curriculumSubjects.subjectId))
      .leftJoin(streams, eq(streams.id, curriculumSubjects.streamId))
      .where(eq(curriculumSubjects.curriculumVersionId, id))
      .orderBy(asc(curriculumSubjects.sortOrder), asc(subjects.name));
    return {
      id: version.id,
      gradeLevelId: version.gradeLevelId,
      versionNumber: version.versionNumber,
      name: version.name,
      state: version.state,
      subjects: rows.map(({ cs, subjectName, streamName }) => ({
        id: cs.id,
        subjectId: cs.subjectId,
        subjectName,
        requirement: cs.requirement,
        streamId: cs.streamId,
        streamName,
        weight: cs.weight,
        credit: cs.credit,
        sortOrder: cs.sortOrder,
      })),
    };
  }

  async listCurricula(actor: Actor, gradeLevelId?: string) {
    return this.run(actor, async (tx) => {
      const versions = await tx
        .select({ id: curriculumVersions.id })
        .from(curriculumVersions)
        .where(gradeLevelId ? eq(curriculumVersions.gradeLevelId, gradeLevelId) : undefined)
        .orderBy(asc(curriculumVersions.gradeLevelId), asc(curriculumVersions.versionNumber));
      return Promise.all(versions.map((v) => this.loadCurriculum(tx, v.id)));
    });
  }

  async createCurriculum(actor: Actor, raw: z.input<typeof createCurriculumRequest>) {
    requireAdmin(actor);
    const input = createCurriculumRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [{ next } = { next: 1 }] = await tx
        .select({ next: sql<number>`coalesce(max(${curriculumVersions.versionNumber}), 0)::int + 1` })
        .from(curriculumVersions)
        .where(eq(curriculumVersions.gradeLevelId, input.gradeLevelId));
      const [v] = await tx
        .insert(curriculumVersions)
        .values({ schoolId: actor.schoolId, gradeLevelId: input.gradeLevelId, versionNumber: next, name: input.name })
        .returning();
      await this.replaceCurriculumSubjects(tx, actor, v!.id, input.subjects);
      await audit(tx, actor, { action: 'curriculum.created', entityType: 'curriculum', entityId: v!.id });
      return this.loadCurriculum(tx, v!.id);
    });
  }

  private async replaceCurriculumSubjects(tx: Tx, actor: Actor, versionId: string, items: z.infer<typeof createCurriculumRequest>['subjects']) {
    const ids = items.map((s) => s.subjectId);
    if (new Set(ids).size !== ids.length) throw errors.field('subjects', 'A subject is listed twice');
    await tx.delete(curriculumSubjects).where(eq(curriculumSubjects.curriculumVersionId, versionId));
    await tx.insert(curriculumSubjects).values(
      items.map((s) => ({
        schoolId: actor.schoolId,
        curriculumVersionId: versionId,
        subjectId: s.subjectId,
        requirement: s.requirement,
        streamId: s.streamId ?? null,
        weight: s.weight,
        credit: s.credit ?? null,
        sortOrder: s.sortOrder,
      })),
    );
  }

  async updateCurriculum(actor: Actor, id: string, raw: z.input<typeof updateCurriculumRequest>) {
    requireAdmin(actor);
    const input = updateCurriculumRequest.parse(raw);
    return this.run(actor, async (tx) => {
      const [v] = await tx.select().from(curriculumVersions).where(eq(curriculumVersions.id, id)).for('update');
      const version = required(v, 'Curriculum');
      if (input.subjects) {
        if (version.state !== 'draft') throw errors.rule('Only draft curricula can change subjects. Create a new version instead.');
        await this.replaceCurriculumSubjects(tx, actor, id, input.subjects);
      }
      if (input.state === 'active') {
        await tx
          .update(curriculumVersions)
          .set({ state: 'retired' })
          .where(and(eq(curriculumVersions.gradeLevelId, version.gradeLevelId), eq(curriculumVersions.state, 'active')));
      }
      await tx
        .update(curriculumVersions)
        .set({ ...(input.name ? { name: input.name } : {}), ...(input.state ? { state: input.state } : {}) })
        .where(eq(curriculumVersions.id, id));
      await audit(tx, actor, { action: 'curriculum.updated', entityType: 'curriculum', entityId: id, summary: { state: input.state } });
      return this.loadCurriculum(tx, id);
    });
  }

  /* ---------------- Class offerings, sections, courses ---------------- */

  async listClassOfferings(actor: Actor, academicYearId: string): Promise<ClassOffering[]> {
    return this.run(actor, async (tx) => {
      const rows = await tx
        .select({ co: classOfferings, g: gradeLevels })
        .from(classOfferings)
        .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
        .where(eq(classOfferings.academicYearId, academicYearId))
        .orderBy(asc(gradeLevels.sortOrder));
      const ids = rows.map((r) => r.co.id);
      const [sectionMap, courseMap] = await Promise.all([this.sectionsFor(tx, ids, today(actor)), this.coursesFor(tx, ids)]);
      return rows.map(({ co, g }) => ({
        id: co.id,
        academicYearId: co.academicYearId,
        gradeLevelId: g.id,
        gradeCode: g.code,
        gradeName: g.name,
        gradeNameUr: g.nameUr,
        sortOrder: g.sortOrder,
        curriculumVersionId: co.curriculumVersionId,
        archived: co.archivedAt !== null,
        sections: sectionMap.get(co.id) ?? [],
        courses: courseMap.get(co.id) ?? [],
      }));
    });
  }

  async getClassOffering(actor: Actor, id: string) {
    const [co] = await this.run(actor, (tx) => tx.select({ yearId: classOfferings.academicYearId }).from(classOfferings).where(eq(classOfferings.id, id)));
    const all = await this.listClassOfferings(actor, required(co, 'Class').yearId);
    return required(all.find((c) => c.id === id), 'Class');
  }

  private async sectionsFor(tx: Tx, classOfferingIds: string[], date: string) {
    const map = new Map<string, Section[]>();
    if (!classOfferingIds.length) return map;
    const rows = await tx.select().from(sections).where(inArray(sections.classOfferingId, classOfferingIds)).orderBy(asc(sections.code));
    const sectionIds = rows.map((s) => s.id);
    const counts = sectionIds.length
      ? await tx
          .select({ sectionId: studentPlacements.sectionId, n: count() })
          .from(studentPlacements)
          .innerJoin(studentEnrollments, eq(studentEnrollments.id, studentPlacements.enrollmentId))
          .where(
            and(
              inArray(studentPlacements.sectionId, sectionIds),
              eq(studentEnrollments.status, 'active'),
              activeOn(studentPlacements.startDate, studentPlacements.endDate, date),
            ),
          )
          .groupBy(studentPlacements.sectionId)
      : [];
    const cts = sectionIds.length
      ? await tx
          .select({ a: classTeacherAssignments, name: accounts.displayName })
          .from(classTeacherAssignments)
          .innerJoin(teachers, eq(teachers.id, classTeacherAssignments.teacherId))
          .innerJoin(accounts, eq(accounts.id, teachers.accountId))
          .where(
            and(
              inArray(classTeacherAssignments.sectionId, sectionIds),
              activeOn(classTeacherAssignments.startDate, classTeacherAssignments.endDate, date),
            ),
          )
      : [];
    const countBy = new Map(counts.map((c) => [c.sectionId, c.n]));
    const ctBy = new Map(cts.map((c) => [c.a.sectionId, c]));
    for (const s of rows) {
      const ct = ctBy.get(s.id);
      const list = map.get(s.classOfferingId) ?? [];
      list.push({
        id: s.id,
        classOfferingId: s.classOfferingId,
        code: s.code,
        name: s.name,
        capacity: s.capacity,
        homeRoomId: s.homeRoomId,
        archived: s.archivedAt !== null,
        studentCount: countBy.get(s.id) ?? 0,
        classTeacher: ct ? { teacherId: ct.a.teacherId, displayName: ct.name, assignmentId: ct.a.id } : null,
      });
      map.set(s.classOfferingId, list);
    }
    return map;
  }

  private async coursesFor(tx: Tx, classOfferingIds: string[]) {
    const map = new Map<string, CourseOffering[]>();
    if (!classOfferingIds.length) return map;
    const rows = await tx
      .select({ c: courseOfferings, s: subjects })
      .from(courseOfferings)
      .innerJoin(subjects, eq(subjects.id, courseOfferings.subjectId))
      .where(inArray(courseOfferings.classOfferingId, classOfferingIds))
      .orderBy(asc(courseOfferings.sortOrder), asc(subjects.name));
    for (const { c, s } of rows) {
      const list = map.get(c.classOfferingId) ?? [];
      list.push({
        id: c.id,
        classOfferingId: c.classOfferingId,
        subjectId: s.id,
        subjectCode: s.code,
        subjectName: s.name,
        subjectNameUr: s.nameUr,
        requirement: c.requirement,
        streamId: c.streamId,
        weight: c.weight,
        credit: c.credit,
        archived: c.archivedAt !== null,
      });
      map.set(c.classOfferingId, list);
    }
    return map;
  }

  async createClassOffering(actor: Actor, raw: z.input<typeof createClassOfferingRequest>) {
    requireAdmin(actor);
    const input = createClassOfferingRequest.parse(raw);
    const id = await this.run(actor, async (tx) => {
      await assertYearWritable(tx, input.academicYearId);
      let curriculumId = input.curriculumVersionId ?? null;
      if (!curriculumId) {
        const [active] = await tx
          .select({ id: curriculumVersions.id })
          .from(curriculumVersions)
          .where(and(eq(curriculumVersions.gradeLevelId, input.gradeLevelId), eq(curriculumVersions.state, 'active')));
        curriculumId = active?.id ?? null;
      }
      const [co] = await tx
        .insert(classOfferings)
        .values({ schoolId: actor.schoolId, academicYearId: input.academicYearId, gradeLevelId: input.gradeLevelId, curriculumVersionId: curriculumId })
        .returning();
      await tx.insert(sections).values(
        input.sections.map((s) => ({ schoolId: actor.schoolId, classOfferingId: co!.id, code: s.code, name: s.name, capacity: s.capacity ?? null })),
      );
      if (curriculumId) {
        const items = await tx.select().from(curriculumSubjects).where(eq(curriculumSubjects.curriculumVersionId, curriculumId));
        if (items.length) {
          await tx.insert(courseOfferings).values(
            items.map((i) => ({
              schoolId: actor.schoolId,
              classOfferingId: co!.id,
              subjectId: i.subjectId,
              requirement: i.requirement,
              streamId: i.streamId,
              weight: i.weight,
              credit: i.credit,
              sortOrder: i.sortOrder,
            })),
          );
        }
      }
      await audit(tx, actor, { action: 'class_offering.created', entityType: 'class_offering', entityId: co!.id });
      return co!.id;
    });
    return this.getClassOffering(actor, id);
  }

  async createSection(actor: Actor, classOfferingId: string, raw: z.input<typeof createSectionRequest>) {
    requireAdmin(actor);
    const input = createSectionRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [co] = await tx.select().from(classOfferings).where(eq(classOfferings.id, classOfferingId));
      await assertYearWritable(tx, required(co, 'Class').academicYearId);
      const [s] = await tx
        .insert(sections)
        .values({ schoolId: actor.schoolId, classOfferingId, code: input.code, name: input.name, capacity: input.capacity ?? null, homeRoomId: input.homeRoomId ?? null })
        .returning();
      await audit(tx, actor, { action: 'section.created', entityType: 'section', entityId: s!.id });
    });
    return this.getClassOffering(actor, classOfferingId);
  }

  async updateSection(actor: Actor, sectionId: string, raw: z.input<typeof updateSectionRequest>) {
    requireAdmin(actor);
    const input = updateSectionRequest.parse(raw);
    const classOfferingId = await this.run(actor, async (tx) => {
      if (input.archived) {
        const [{ n } = { n: 0 }] = await tx
          .select({ n: count() })
          .from(studentPlacements)
          .where(and(eq(studentPlacements.sectionId, sectionId), activeOn(studentPlacements.startDate, studentPlacements.endDate, today(actor))));
        if (n > 0) throw errors.rule('Move the students in this section before archiving it.');
      }
      const [s] = await tx
        .update(sections)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.homeRoomId !== undefined ? { homeRoomId: input.homeRoomId } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        })
        .where(eq(sections.id, sectionId))
        .returning();
      await audit(tx, actor, { action: 'section.updated', entityType: 'section', entityId: sectionId });
      return required(s, 'Section').classOfferingId;
    });
    return this.getClassOffering(actor, classOfferingId);
  }

  async createCourseOffering(actor: Actor, classOfferingId: string, raw: z.input<typeof createCourseOfferingRequest>) {
    requireAdmin(actor);
    const input = createCourseOfferingRequest.parse(raw);
    await this.run(actor, async (tx) => {
      const [co] = await tx.select().from(classOfferings).where(eq(classOfferings.id, classOfferingId));
      await assertYearWritable(tx, required(co, 'Class').academicYearId);
      const [course] = await tx
        .insert(courseOfferings)
        .values({
          schoolId: actor.schoolId,
          classOfferingId,
          subjectId: input.subjectId,
          requirement: input.requirement,
          streamId: input.streamId ?? null,
          weight: input.weight,
          credit: input.credit ?? null,
        })
        .returning();
      await audit(tx, actor, { action: 'course_offering.created', entityType: 'course_offering', entityId: course!.id });
      if (input.enrollStudents) await this.enrollment().enrollClassInCourse(tx, actor, course!, today(actor));
    });
    return this.getClassOffering(actor, classOfferingId);
  }

  async updateCourseOffering(actor: Actor, courseId: string, raw: z.input<typeof updateCourseOfferingRequest>) {
    requireAdmin(actor);
    const input = updateCourseOfferingRequest.parse(raw);
    const classOfferingId = await this.run(actor, async (tx) => {
      const [c] = await tx
        .update(courseOfferings)
        .set({
          ...(input.requirement ? { requirement: input.requirement } : {}),
          ...(input.streamId !== undefined ? { streamId: input.streamId } : {}),
          ...(input.weight ? { weight: input.weight } : {}),
          ...(input.credit !== undefined ? { credit: input.credit } : {}),
          ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
        })
        .where(eq(courseOfferings.id, courseId))
        .returning();
      await audit(tx, actor, { action: 'course_offering.updated', entityType: 'course_offering', entityId: courseId });
      return required(c, 'Subject offering').classOfferingId;
    });
    return this.getClassOffering(actor, classOfferingId);
  }

  async sectionLabel(tx: Tx, sectionId: string) {
    const [row] = await tx
      .select({ section: sections.name, grade: gradeLevels.name })
      .from(sections)
      .innerJoin(classOfferings, eq(classOfferings.id, sections.classOfferingId))
      .innerJoin(gradeLevels, eq(gradeLevels.id, classOfferings.gradeLevelId))
      .where(eq(sections.id, sectionId));
    return row ? `${row.grade} ${row.section}` : 'Section';
  }
}
