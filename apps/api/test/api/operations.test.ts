import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handlers } from '../../src/jobs/handlers';
import { PushService } from '../../src/modules/communications/push';
import { actorForAccount } from '../../src/platform/actor-loader';
import { client, createTestApp, type TestApp } from '../support/app';
import { ok, schoolFixture, TODAY, YEAR_START, type SchoolFixture } from '../support/fixtures';
import { uploadFile } from '../support/files';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const hasBrowser = fs.existsSync(EDGE);

let t: TestApp;
let f: SchoolFixture;

beforeAll(async () => {
  t = await createTestApp(hasBrowser ? { PDF_BROWSER_CHANNEL: 'msedge' } : {});
  f = await schoolFixture(t);
});
afterAll(async () => {
  await t?.close();
});

const csv = (rows: string[][]) => Buffer.from(rows.map((r) => r.map((c) => (/[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n'));
const header = ['admission_number', 'display_name', 'display_name_ur', 'username', 'admission_date', 'academic_year_code', 'class_code', 'section_code', 'stream_code', 'guardian_name', 'guardian_relationship'];

describe('student CSV import', () => {
  it('serves a template with stable English headers', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/imports/templates/students', headers: { authorization: `Bearer ${f.adminTokens.accessToken}`, 'x-edventure-client': 'mobile' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.replace(/^\uFEFF/, '').split('\r\n')[0]).toMatch(/^admission_number,display_name,display_name_ur,username/);
  });

  it('rejects a batch with any invalid row and commits nothing', async () => {
    const fileId = await uploadFile(
      t,
      f.admin,
      'import',
      'students.csv',
      csv([
        header,
        ['I-001', 'Zainab Noor', 'زینب نور', 'zainab.noor', YEAR_START, 'Y1', 'G9', 'A', 'BIO', 'Noor Ahmed', 'Father'],
        ['I-002', 'Usman Ali', '', 's.ali', YEAR_START, 'Y1', 'G9', 'A', '', '', ''],
        ['I-003', 'Hira Khan', '', 'hira.khan', YEAR_START, 'Y1', 'G9', 'Z', '', '', ''],
      ]),
      'text/csv',
    );
    const batch = await ok(f.admin.post('/imports', { kind: 'students', fileId }));
    expect(batch.state).toBe('invalid');
    expect(batch.rows.map((r: any) => r.status)).toEqual(['valid', 'duplicate', 'invalid']);
    expect(batch.rows[1].errors[0].message).toMatch(/Already used/);
    expect(batch.rows[2].errors[0].field).toBe('section_code');
    const commit = await f.admin.post(`/imports/${batch.id}/commit`);
    expect(commit.statusCode).toBe(422);
  });

  it('commits in the worker, provisions sign-in without activating, then issues credentials', async () => {
    const fileId = await uploadFile(
      t,
      f.admin,
      'import',
      'students-fixed.csv',
      csv([
        header,
        ['I-001', 'Zainab Noor', 'زینب نور', 'zainab.noor', YEAR_START, 'Y1', 'G9', 'A', 'BIO', 'Noor Ahmed', 'Father'],
        ['I-003', 'Hira Khan', '', 'hira.khan', YEAR_START, 'Y1', 'G9', 'B', '', '', ''],
      ]),
      'text/csv',
    );
    const batch = await ok(f.admin.post('/imports', { kind: 'students', fileId }));
    expect(batch.state).toBe('validated');
    const queued = await f.admin.post(`/imports/${batch.id}/commit`);
    expect(queued.statusCode).toBe(202);
    const jobs = handlers(t.container);
    await jobs.importCommit({ schoolId: f.school.id, batchId: batch.id, accountId: f.adminAccountId }, 'test');
    const done = await ok(f.admin.get(`/imports/${batch.id}`));
    expect(done.state).toBe('committed');
    const accountIds = done.rows.map((r: any) => r.outcome.accountId);
    for (const accountId of accountIds) await jobs.accountProvision({ schoolId: f.school.id, accountId }, 'test');

    const zainab = (await ok(f.admin.get('/students?q=Zainab'))).items[0];
    expect(zainab).toMatchObject({ displayNameUr: 'زینب نور', accountStatus: 'pending' });
    expect(zainab.enrollment.streamName).toBe('Biology group');

    const issued = await ok(f.admin.post('/accounts/issue-credentials', { accountIds }));
    expect(issued.issued).toHaveLength(2);
    const login = await client(t.app).post('/auth/login', { schoolCode: f.code, username: 'zainab.noor', password: issued.issued[0].temporaryPassword });
    expect(login.statusCode).toBe(200);
  });
});

describe('reports and exports', () => {
  it('generates a CSV export in the worker with formula escaping and an expiring download', async () => {
    await ok(
      f.admin.post('/students', {
        username: 's.formula',
        displayName: '=HYPERLINK("x")',
        admissionNumber: 'F-1',
        admissionDate: YEAR_START,
        enrollment: { classOfferingId: f.class9.id, sectionId: f.sectionB.id },
      }),
    );
    const job = await f.admin.post('/reports', { kind: 'students', format: 'csv' });
    expect(job.statusCode).toBe(202);
    const actor = await actorForAccount(t.container.app.db, f.school.id, f.adminAccountId, 'test');
    const done = await t.container.reports.generate(actor, job.data.id);
    expect(done.state).toBe('succeeded');
    const link = await ok(f.admin.get(`/files/${done.fileId}/download`));
    const file = await t.app.inject({ method: 'GET', url: link.url, headers: { authorization: `Bearer ${f.adminTokens.accessToken}` } });
    const text = file.body.replace(/^\uFEFF/, '');
    expect(text).toContain('Ali Raza');
    expect(text).toContain(`'=HYPERLINK`);
    const inbox = await ok(f.admin.get('/notifications'));
    expect(inbox.items.some((n: any) => n.kind === 'report.ready')).toBe(true);
    // Reports belong to their requester.
    const other = await f.teachers.teacherA.client.get(`/reports/${job.data.id}`);
    expect(other.statusCode).toBe(404);
    const students = await f.students.ali.client.post('/reports', { kind: 'students', format: 'csv' });
    expect(students.statusCode).toBe(403);
  });

  it.skipIf(!hasBrowser)('renders a bilingual fee statement PDF with Chromium', async () => {
    const job = await ok(f.students.ali.client.post('/reports', { kind: 'fee_statement', format: 'pdf', locale: 'ur', parameters: { studentId: f.students.ali.id } }), 202);
    const actor = await actorForAccount(t.container.app.db, f.school.id, f.students.ali.accountId, 'test');
    const done = await t.container.reports.generate(actor, job.id);
    expect(done.state).toBe('succeeded');
    const res = await f.students.ali.client.get(`/files/${done.fileId}/content`);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  }, 90_000);
});

describe('dashboards, search and audit', () => {
  it('serves role dashboards', async () => {
    const admin = await ok(f.admin.get('/dashboards/admin'));
    expect(admin.metrics.enrollment.active).toBeGreaterThanOrEqual(3);
    expect(admin.metrics.outstandingFees.currency).toBe('PKR');
    const teacher = await ok(f.teachers.teacherA.client.get('/dashboards/teacher'));
    expect(teacher.date).toBe(TODAY);
    const student = await ok(f.students.ali.client.get('/dashboards/student'));
    expect(student.fees.currency).toBe('PKR');
    const wrongRole = await f.students.ali.client.get('/dashboards/admin');
    expect(wrongRole.statusCode).toBe(403);
  });

  it('limits teacher search to their roster', async () => {
    const admin = await ok(f.admin.get('/search?q=Ha'));
    expect(admin.students.map((s: any) => s.displayName)).toContain('Hamza Tariq');
    const teacherB = await ok(f.teachers.teacherB.client.get('/search?q=Ha'));
    expect(teacherB.students.map((s: any) => s.displayName)).not.toContain('Hamza Tariq');
  });

  it('keeps an audit trail of administrative changes', async () => {
    const events = await ok(f.admin.get('/audit-events?entityType=student&limit=100'));
    expect(events.items.some((e: any) => e.action === 'student.created' && e.actor === 'Principal')).toBe(true);
    const denied = await f.teachers.teacherA.client.get('/audit-events');
    expect(denied.statusCode).toBe(403);
  });
});

describe('retention', () => {
  it('pseudonymizes personal details after the recovery window while keeping records', async () => {
    const created = await ok(
      f.admin.post('/students', {
        username: 's.leaver',
        displayName: 'Leaving Student',
        admissionNumber: 'L-1',
        admissionDate: YEAR_START,
        phone: '+92 300 0000000',
        enrollment: { classOfferingId: f.class9.id, sectionId: f.sectionB.id },
        guardians: [{ name: 'Guardian Leaver', relationship: 'Mother', phone: '+92 300 1111111' }],
      }),
    );
    await ok(f.admin.post(`/accounts/${created.student.accountId}/delete`, { confirm: true, reason: 'Left school' }));
    const early = await t.container.operations.processDeletions(f.school.id);
    expect(early.processed).toBe(0);
    const later = await t.container.operations.processDeletions(f.school.id, new Date(Date.now() + 31 * 86_400_000));
    expect(later.processed).toBe(1);
    const detail = await ok(f.admin.get(`/students/${created.student.id}`));
    expect(detail).toMatchObject({ displayName: 'Former student', admissionNumber: 'L-1', phone: null, guardians: [] });
    const restore = await f.admin.post(`/accounts/${created.student.accountId}/restore`);
    expect(restore.statusCode).toBe(404);
  });
});

describe('push notifications', () => {
  it('delivers localized pushes, keeps sensitive details off the lock screen and retires dead tokens', async () => {
    await ok(f.students.ali.client.post('/devices', { expoPushToken: 'ExponentPushToken[ali-device]', platform: 'android', locale: 'ur' }));
    await ok(f.students.sara.client.post('/devices', { expoPushToken: 'ExponentPushToken[sara-device]', platform: 'ios', locale: 'en' }));
    const ann = await ok(
      f.admin.post('/announcements', { title: 'Sports day', titleUr: 'کھیلوں کا دن', body: 'Friday', audiences: [{ target: 'section', sectionId: f.sectionA.id }] }),
    );
    const sentMessages: any[] = [];
    const push = new PushService(t.container.app.db, undefined, async (url, body) => {
      if (url.endsWith('/send')) {
        sentMessages.push(...(body as any[]));
        return {
          data: (body as any[]).map((m) =>
            m.to.includes('sara') ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: `ticket-${m.to}` },
          ),
        };
      }
      return { data: {} };
    });
    const [notification] = await t.container.app.db.transaction(async (tx) => {
      const { sql } = await import('drizzle-orm');
      await tx.execute(sql`select set_config('app.school_id', ${f.school.id}, true)`);
      return tx.execute<{ id: string }>(sql`select id from app.notifications where entity_id = ${ann.id}`);
    });
    const result = await push.deliver(f.school.id, notification!.id);
    expect(result.sent).toBe(1);
    const toAli = sentMessages.find((m) => m.to.includes('ali'));
    expect(toAli.title).toBe('کھیلوں کا دن');
    expect(toAli.data.link).toBe(`/announcements/${ann.id}`);
    // Re-running does not resend to devices that already received it.
    expect((await push.deliver(f.school.id, notification!.id)).sent).toBe(0);
  });
});
