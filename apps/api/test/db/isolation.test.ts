import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { accounts, compensationRecords, schools, subjects, teachers } from '../../src/db/schema';
import { withTenant } from '../../src/db/tenant';
import { createTestDatabase, type TestDatabase } from '../support/db';
import { expectDbError } from '../support/expect';

let t: TestDatabase;
let schoolA: string;
let schoolB: string;

beforeAll(async () => {
  t = await createTestDatabase();
  const [a] = await t.owner.db.insert(schools).values({ code: 'ALPHA', name: 'Alpha School' }).returning();
  const [b] = await t.owner.db.insert(schools).values({ code: 'BETA', name: 'Beta School' }).returning();
  schoolA = a!.id;
  schoolB = b!.id;
});

afterAll(async () => {
  await t?.drop();
});

const admin = (schoolId: string) => ({ schoolId, accountId: null, roles: ['school_admin'] as const });

describe('tenant isolation (row-level security)', () => {
  it('application role is not a superuser and cannot bypass RLS', async () => {
    const [row] = await t.app.sql`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`;
    expect(row).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it('every application table has RLS enabled and a tenant policy', async () => {
    const rows = await t.owner.sql<{ relname: string; relrowsecurity: boolean; policies: number }[]>`
      select c.relname, c.relrowsecurity,
        (select count(*)::int from pg_policies p where p.schemaname = 'app' and p.tablename = c.relname) as policies
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relkind = 'r'`;
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
    // platform_admins intentionally has RLS with no policy (deny all to the app role).
    expect(rows.filter((r) => r.policies === 0).map((r) => r.relname)).toEqual(['platform_admins']);
  });

  it('sees nothing without tenant context', async () => {
    await withTenant(t.app.db, admin(schoolA), (tx) =>
      tx.insert(subjects).values({ schoolId: schoolA, code: 'MATH', name: 'Mathematics' }),
    );
    const rows = await t.app.db.transaction((tx) => tx.select().from(subjects));
    expect(rows).toHaveLength(0);
  });

  it("cannot read another school's rows", async () => {
    await withTenant(t.app.db, admin(schoolB), (tx) =>
      tx.insert(subjects).values({ schoolId: schoolB, code: 'MATH', name: 'Maths B' }),
    );
    const seenByA = await withTenant(t.app.db, admin(schoolA), (tx) => tx.select().from(subjects));
    expect(seenByA.map((s) => s.name)).toEqual(['Mathematics']);
    const seenByB = await withTenant(t.app.db, admin(schoolB), (tx) => tx.select().from(subjects));
    expect(seenByB.map((s) => s.name)).toEqual(['Maths B']);
  });

  it("cannot write into another school's tenant", async () => {
    await expectDbError(
      withTenant(t.app.db, admin(schoolA), (tx) =>
        tx.insert(subjects).values({ schoolId: schoolB, code: 'X', name: 'Injected' }),
      ),
      /row-level security/,
    );
  });

  it('only sees its own school row', async () => {
    const rows = await withTenant(t.app.db, admin(schoolA), (tx) => tx.select().from(schools));
    expect(rows.map((r) => r.code)).toEqual(['ALPHA']);
  });

  it('composite foreign keys reject cross-school references even for the owner', async () => {
    const [acct] = await t.owner.db
      .insert(accounts)
      .values({ schoolId: schoolA, username: 'teacher.a', displayName: 'Teacher A' })
      .returning();
    await expectDbError(
      t.owner.db.insert(teachers).values({ schoolId: schoolB, accountId: acct!.id, employeeNumber: 'E1' }),
      /foreign key/,
    );
  });

  it('salary records are visible to school administrators only', async () => {
    const [acct] = await t.owner.db
      .insert(accounts)
      .values({ schoolId: schoolA, username: 'teacher.salary', displayName: 'Salary Teacher' })
      .returning();
    const [teacher] = await t.owner.db
      .insert(teachers)
      .values({ schoolId: schoolA, accountId: acct!.id, employeeNumber: 'E-SAL' })
      .returning();
    const asTeacherCtx = { schoolId: schoolA, accountId: acct!.id, roles: ['teacher'] as const };
    await withTenant(t.app.db, admin(schoolA), (tx) =>
      tx.insert(compensationRecords).values({
        schoolId: schoolA,
        teacherId: teacher!.id,
        effectiveFrom: '2026-01-01',
        amount: '85000.00',
      }),
    );
    const asTeacher = await withTenant(t.app.db, asTeacherCtx, (tx) => tx.select().from(compensationRecords));
    expect(asTeacher).toHaveLength(0);
    const asAdmin = await withTenant(t.app.db, admin(schoolA), (tx) =>
      tx.select().from(compensationRecords).where(eq(compensationRecords.teacherId, teacher!.id)),
    );
    expect(asAdmin[0]?.amount).toBe('85000.00');
    await expectDbError(
      withTenant(t.app.db, asTeacherCtx, (tx) =>
        tx.insert(compensationRecords).values({
          schoolId: schoolA,
          teacherId: teacher!.id,
          effectiveFrom: '2027-01-01',
          amount: '1.00',
        }),
      ),
      /row-level security/,
    );
  });

  it('tenant context does not leak between pooled transactions', async () => {
    await withTenant(t.app.db, admin(schoolA), async () => {});
    const [row] = await t.app.db.execute<{ school: string | null }>(sql`select app.current_school_id()::text as school`);
    expect(row?.school ?? null).toBeNull();
  });

  it('audit events are append-only for the application role', async () => {
    await withTenant(t.app.db, admin(schoolA), (tx) =>
      tx.execute(sql`insert into app.audit_events (school_id, action, entity_type) values (${schoolA}, 'test', 'test')`),
    );
    await expectDbError(
      withTenant(t.app.db, admin(schoolA), (tx) => tx.execute(sql`update app.audit_events set action = 'tampered'`)),
      /permission denied/,
    );
  });
});
