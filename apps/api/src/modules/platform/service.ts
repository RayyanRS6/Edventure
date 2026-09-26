import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { locale, schoolCode, username } from '@edventure/contracts';
import type { Db } from '../../db/client';
import { attendanceReasonCodes, feeTypes, leaveTypes, schoolPolicies, schools } from '../../db/schema';
import { withTenant } from '../../db/tenant';
import { systemActor } from '../../platform/actor';
import { audit } from '../../platform/audit';
import { errors } from '../../platform/errors';
import type { AccountService } from '../people/accounts';

export const provisionSchoolInput = z.object({
  code: schoolCode,
  name: z.string().trim().min(2).max(200),
  nameUr: z.string().trim().max(200).nullish(),
  timezone: z.string().default('Asia/Karachi'),
  currency: z.string().length(3).default('PKR'),
  defaultLocale: locale.default('en'),
  admin: z.object({
    username,
    displayName: z.string().trim().min(2).max(120),
  }),
});
export type ProvisionSchoolInput = z.input<typeof provisionSchoolInput>;

/**
 * Platform operations. Uses the owner connection deliberately and narrowly: creating a tenant is
 * the one operation that cannot run inside an existing tenant context. Everything after the school
 * row exists runs through the ordinary application role with that school's context.
 */
export class PlatformService {
  constructor(
    private readonly ownerDb: Db,
    private readonly appDb: Db,
    private readonly accounts: AccountService,
  ) {}

  async provisionSchool(raw: ProvisionSchoolInput, operator: string) {
    const input = provisionSchoolInput.parse(raw);
    const existing = await this.ownerDb.select({ id: schools.id }).from(schools).where(eq(schools.code, input.code));
    if (existing.length) throw errors.field('code', 'This school code is already in use');

    const school = await this.ownerDb.transaction(async (tx) => {
      const [row] = await tx
        .insert(schools)
        .values({
          code: input.code,
          name: input.name,
          nameUr: input.nameUr ?? null,
          timezone: input.timezone,
          currency: input.currency,
          defaultLocale: input.defaultLocale,
        })
        .returning();
      await tx.insert(schoolPolicies).values({ schoolId: row!.id });
      return row!;
    });

    const actor = { ...systemActor(school.id, school.timezone), requestId: `platform:${operator}` };
    const admin = await withTenant(this.appDb, { schoolId: school.id, accountId: null, roles: ['school_admin'] }, async (tx) => {
      await tx.insert(leaveTypes).values([
        { schoolId: school.id, code: 'SICK', name: 'Sick leave', nameUr: 'بیماری کی چھٹی', audience: 'both' },
        { schoolId: school.id, code: 'CASUAL', name: 'Casual leave', nameUr: 'اتفاقی چھٹی', audience: 'both' },
        { schoolId: school.id, code: 'FAMILY', name: 'Family event', nameUr: 'خاندانی تقریب', audience: 'both' },
      ]);
      await tx.insert(attendanceReasonCodes).values([
        { schoolId: school.id, code: 'ILL', label: 'Illness', labelUr: 'بیماری' },
        { schoolId: school.id, code: 'TRANSPORT', label: 'Transport problem', labelUr: 'سواری کا مسئلہ', appliesTo: 'late' },
        { schoolId: school.id, code: 'APPROVED', label: 'Approved leave', labelUr: 'منظور شدہ چھٹی', appliesTo: 'excused' },
      ]);
      await tx.insert(feeTypes).values([
        { schoolId: school.id, code: 'TUITION', name: 'Tuition fee', nameUr: 'ٹیوشن فیس', kind: 'tuition' },
        { schoolId: school.id, code: 'ADMISSION', name: 'Admission fee', nameUr: 'داخلہ فیس', kind: 'admission' },
        { schoolId: school.id, code: 'EXAM', name: 'Examination fee', nameUr: 'امتحانی فیس', kind: 'exam' },
        { schoolId: school.id, code: 'TRANSPORT', name: 'Transport fee', nameUr: 'ٹرانسپورٹ فیس', kind: 'transport' },
        { schoolId: school.id, code: 'FINE', name: 'Fine', nameUr: 'جرمانہ', kind: 'fine' },
      ]);
      const account = await this.accounts.createPending(tx, actor, {
        username: input.admin.username,
        displayName: input.admin.displayName,
        roles: ['school_admin'],
      });
      await audit(tx, actor, {
        action: 'platform.school_provisioned',
        entityType: 'school',
        entityId: school.id,
        summary: { code: school.code, operator },
      });
      return account;
    });

    const credential = await this.accounts.issueCredential({ ...actor, accountId: admin.id }, admin.id);
    return { school, credential };
  }
}
