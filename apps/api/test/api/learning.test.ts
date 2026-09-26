import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays } from '../../src/platform/dates';
import { createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, type SchoolFixture } from '../support/fixtures';
import { PDF, uploadFile } from '../support/files';

let t: TestApp;
let f: SchoolFixture;

beforeAll(async () => {
  t = await createTestApp();
  f = await schoolFixture(t);
});
afterAll(async () => {
  await t?.close();
});

describe('files', () => {
  it('rejects disallowed types and content that does not match the declared type', async () => {
    const exe = await f.teachers.teacherA.client.post('/files/uploads', { purpose: 'material', fileName: 'virus.exe', mimeType: 'application/pdf', sizeBytes: 10 });
    expect(exe.statusCode).toBe(400);
    const tooBig = await f.teachers.teacherA.client.post('/files/uploads', { purpose: 'profile_image', fileName: 'a.png', mimeType: 'image/png', sizeBytes: 3 * 1024 * 1024 });
    expect(tooBig.statusCode).toBe(400);
    const fake = await f.teachers.teacherA.client.post('/files/uploads', { purpose: 'material', fileName: 'fake.pdf', mimeType: 'application/pdf', sizeBytes: 5 });
    const path = new URL(fake.data.upload.url).pathname;
    await t.app.inject({ method: 'PUT', url: path, payload: Buffer.from('hello'), headers: { 'content-type': 'application/pdf' } });
    const done = await f.teachers.teacherA.client.post(`/files/${fake.data.file.id}/complete`);
    expect(done.statusCode).toBe(415);
  });

  it('shares teacher PDFs with the group only', async () => {
    const fileId = await uploadFile(t, f.teachers.teacherB.client, 'material', 'Cells.pdf', PDF, 'application/pdf');
    const material = await ok(f.teachers.teacherB.client.post('/materials', { teachingGroupId: f.groups.bioA.id, title: 'Cell structure notes', fileId }));
    const aliMaterials = await ok(f.students.ali.client.get('/materials'));
    expect(aliMaterials.items.map((m: any) => m.title)).toEqual(['Cell structure notes']);
    const link = await ok(f.students.ali.client.get(`/files/${material.file.id}/download`));
    const download = await t.app.inject({ method: 'GET', url: new URL(link.url, 'http://localhost').pathname });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    // Sara takes Computer Science, not Biology.
    expect((await ok(f.students.sara.client.get('/materials'))).items).toEqual([]);
    const denied = await f.students.sara.client.get(`/files/${material.file.id}/download`);
    expect(denied.statusCode).toBe(404);
  });
});

describe('homework', () => {
  let hw: any;

  it('publishes to a snapshot of the group and notifies students', async () => {
    const attachment = await uploadFile(t, f.teachers.teacherA.client, 'homework_attachment', 'Worksheet.pdf', PDF, 'application/pdf');
    hw = await ok(
      f.teachers.teacherA.client.post('/homework', {
        teachingGroupId: f.groups.mathsA.id,
        title: 'Quadratic equations',
        instructions: 'Solve exercise 2.3',
        dueDate: addDays(TODAY, 2),
        submissionPolicy: 'required',
        maxScore: '10',
        attachmentFileIds: [attachment],
      }),
    );
    expect(hw.state).toBe('published');
    expect(hw.completion.total).toBe(2);
    const aliList = await ok(f.students.ali.client.get('/homework'));
    expect(aliList.items[0]).toMatchObject({ title: 'Quadratic equations', myStatus: 'pending' });
    const inbox = await ok(f.students.ali.client.get('/notifications?unreadOnly=true'));
    expect(inbox.items.some((n: any) => n.kind === 'homework.published' && n.data.title === 'Quadratic equations')).toBe(true);
    // Teachers of other groups cannot post to this group.
    const other = await f.teachers.teacherB.client.post('/homework', { teachingGroupId: f.groups.mathsA.id, title: 'x', dueDate: TODAY });
    expect(other.statusCode).toBe(403);
    // Students from other groups cannot see it.
    const hamza = await f.students.hamza.client.get(`/homework/${hw.id}`);
    expect(hamza.statusCode).toBe(404);
  });

  it('keeps every submission revision and lets the teacher give feedback and a score', async () => {
    const work = await uploadFile(t, f.students.ali.client, 'submission', 'answers.pdf', PDF, 'application/pdf');
    await ok(f.students.ali.client.post(`/homework/${hw.id}/submissions`, { body: 'First try', attachmentFileIds: [work] }));
    const second = await ok(f.students.ali.client.post(`/homework/${hw.id}/submissions`, { body: 'Corrected' }));
    expect(second.mySubmissions.map((s: any) => s.revision)).toEqual([2, 1]);
    expect(second.myStatus).toBe('submitted');
    expect(second.mySubmissions[0].isLate).toBe(false);

    const recipients = await ok(f.teachers.teacherA.client.get(`/homework/${hw.id}/recipients`));
    const ali = recipients.items.find((r: any) => r.displayName === 'Ali Raza');
    const tooHigh = await f.teachers.teacherA.client.post(`/submissions/${ali.latestSubmission.id}/feedback`, { feedback: 'Great', score: '11' });
    expect(tooHigh.statusCode).toBe(400);
    await ok(f.teachers.teacherA.client.post(`/submissions/${ali.latestSubmission.id}/feedback`, { feedback: 'Great work', score: '9.5' }));
    const mine = await ok(f.students.ali.client.get(`/homework/${hw.id}`));
    expect(mine.myStatus).toBe('completed');
    expect(mine.mySubmissions[0]).toMatchObject({ feedback: 'Great work', score: '9.50' });
    // Students can open the teacher's attachment; the submission file stays private.
    const link = await f.students.ali.client.get(`/files/${hw.attachments[0].id}/download`);
    expect(link.statusCode).toBe(200);
    const saraTries = await f.students.sara.client.get(`/files/${mine.mySubmissions[1].attachments[0].id}/download`);
    expect(saraTries.statusCode).toBe(404);
  });

  it('flags late submissions and shows section completion to the class teacher', async () => {
    const past = await ok(
      f.teachers.teacherA.client.post('/homework', {
        teachingGroupId: f.groups.mathsA.id,
        title: 'Already due',
        dueDate: TODAY,
        dueTime: '00:00',
        submissionPolicy: 'optional',
      }),
    );
    const sub = await ok(f.students.sara.client.post(`/homework/${past.id}/submissions`, { body: 'Sorry, late' }));
    expect(sub.mySubmissions[0].isLate).toBe(true);
    const summary = await ok(f.teachers.teacherA.client.get(`/sections/${f.sectionA.id}/homework-summary?from=${TODAY}&to=${addDays(TODAY, 7)}`));
    expect(summary.items.length).toBe(2);
    const denied = await f.teachers.teacherB.client.get(`/sections/${f.sectionA.id}/homework-summary?from=${TODAY}&to=${TODAY}`);
    expect(denied.statusCode).toBe(403);
  });
});

describe('quizzes', () => {
  let quiz: any;

  it('creates a quiz with multiple-choice and short-answer questions and hides the key from students', async () => {
    quiz = await ok(
      f.teachers.teacherB.client.post('/quizzes', {
        teachingGroupId: f.groups.bioA.id,
        title: 'Cells quiz',
        timeLimitMinutes: 10,
        questions: [
          { kind: 'mcq', prompt: 'Powerhouse of the cell?', points: '2', options: [{ text: 'Nucleus' }, { text: 'Mitochondria', isCorrect: true }] },
          { kind: 'short', prompt: 'Define osmosis', points: '3' },
        ],
      }),
    );
    expect(quiz.questions[0].options.find((o: any) => o.isCorrect).text).toBe('Mitochondria');
    const invalid = await f.teachers.teacherB.client.post('/quizzes', {
      teachingGroupId: f.groups.bioA.id,
      title: 'Bad',
      questions: [{ kind: 'mcq', prompt: 'x', points: '1', options: [{ text: 'a' }, { text: 'b' }] }],
    });
    expect(invalid.statusCode).toBe(400);
    quiz = await ok(f.teachers.teacherB.client.post(`/quizzes/${quiz.id}/publish`));
    const studentView = await ok(f.students.ali.client.get(`/quizzes/${quiz.id}`));
    expect(studentView.questions).toEqual([]);
    expect(studentView.attemptsRemaining).toBe(1);
  });

  it('runs a server-timed attempt, resumes it, auto-marks MCQs and waits for manual marking', async () => {
    const attempt = await ok(f.students.ali.client.post(`/quizzes/${quiz.id}/attempts`));
    expect(attempt.deadlineAt).not.toBeNull();
    expect(attempt.questions[0].options[0].isCorrect).toBeUndefined();
    const resumed = await ok(f.students.ali.client.post(`/quizzes/${quiz.id}/attempts`));
    expect(resumed.id).toBe(attempt.id);
    expect(resumed.deadlineAt).toBe(attempt.deadlineAt);

    const [mcq, short] = attempt.questions;
    const correct = mcq.options.find((o: any) => o.text === 'Mitochondria');
    await ok(f.students.ali.client.put(`/quiz-attempts/${attempt.id}/answers`, { questionId: mcq.id, selectedOptionId: correct.id }));
    await ok(f.students.ali.client.put(`/quiz-attempts/${attempt.id}/answers`, { questionId: short.id, textAnswer: 'Movement of water across a membrane' }));
    const submitted = await ok(f.students.ali.client.post(`/quiz-attempts/${attempt.id}/submit`));
    expect(submitted.state).toBe('submitted');
    expect(submitted.score).toBeNull();

    const again = await f.students.ali.client.post(`/quizzes/${quiz.id}/attempts`);
    expect(again.statusCode).toBe(422);

    const blocked = await f.teachers.teacherB.client.post(`/quizzes/${quiz.id}/release-results`);
    expect(blocked.statusCode).toBe(422);
    const marked = await ok(f.teachers.teacherB.client.put(`/quiz-attempts/${attempt.id}/answers/${short.id}/mark`, { score: '2.5', feedback: 'Mention concentration' }));
    expect(marked.state).toBe('marked');
    expect(marked.score).toBe('4.50');

    const beforeRelease = await ok(f.students.ali.client.get(`/quiz-attempts/${attempt.id}`));
    expect(beforeRelease.score).toBeNull();
    await ok(f.teachers.teacherB.client.post(`/quizzes/${quiz.id}/release-results`));
    const after = await ok(f.students.ali.client.get(`/quiz-attempts/${attempt.id}`));
    expect(after.score).toBe('4.50');
    expect(after.answers.find((a: any) => a.questionId === short.id).feedback).toBe('Mention concentration');
  });

  it('versions questions once attempts exist and grants explicit retakes', async () => {
    const current = await ok(f.teachers.teacherB.client.get(`/quizzes/${quiz.id}`));
    await ok(
      f.teachers.teacherB.client.patch(`/quizzes/${quiz.id}`, {
        version: current.version,
        questions: [{ kind: 'mcq', prompt: 'Plant cells have?', points: '1', options: [{ text: 'Cell wall', isCorrect: true }, { text: 'Nothing' }] }],
      }),
    );
    const old = await ok(f.students.ali.client.get(`/quiz-attempts/${(await ok(f.students.ali.client.get(`/quizzes/${quiz.id}`))).myAttempt.id}`));
    expect(old.questions).toHaveLength(2); // the finished attempt keeps its original questions
    await ok(f.teachers.teacherB.client.post(`/quizzes/${quiz.id}/retakes`, { studentId: f.students.ali.id }));
    const retake = await ok(f.students.ali.client.post(`/quizzes/${quiz.id}/attempts`));
    expect(retake.attemptNumber).toBe(2);
    expect(retake.questions).toHaveLength(1);
  });
});
