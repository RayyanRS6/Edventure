/**
 * Verifies that every translation key used by a frontend exists in English AND Urdu.
 *
 *   npm run check:i18n        # checks apps/web and apps/mobile
 *
 * Literal keys are found as string literals shaped like `section.key`. Dynamic keys such as
 * t(`web.status.${state}`) are expanded from the shared domain value lists in @edventure/contracts,
 * so adding a new enum value without its label fails this check. Unknown dynamic prefixes fail too.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as c from '../packages/contracts/src/index';
import { en, ur } from '../packages/i18n/src/index';

type Tree = { [k: string]: string | Tree };
const root = join(import.meta.dirname, '..');

const unique = (...lists: ReadonlyArray<readonly string[]>) => [...new Set(lists.flat())];

/** Values each dynamic key prefix can take. */
const dynamic: Record<string, readonly string[]> = {
  'web.status.': unique(
    c.accountStatuses,
    c.academicYearStatuses,
    c.timetableStatuses,
    ['not_started', 'draft', 'submitted'],
    c.homeworkStates,
    c.quizStates,
    c.examCycleStates,
    c.policyStates,
    c.publicationStates,
    c.promotionBatchStates,
    c.feePlanStates,
    c.importStates,
    c.importRowStatuses,
    c.reportJobStates,
    c.announcementStates,
    c.enrollmentStatuses,
    c.employmentStatuses,
    c.curriculumStates,
    c.provisioningStates,
  ),
  'web.common.': unique(['student', 'teacher'], c.genders),
  'web.common.weekday.': ['1', '2', '3', '4', '5', '6', '7'],
  'web.people.': ['monthly', 'annual'],
  'web.placement.': c.placementReasons,
  'web.actions.': c.actionItem.shape.kind.options,
  'web.calendar.kinds.': c.calendarDayKinds,
  'web.calendar.kindHints.': c.calendarDayKinds,
  'web.timetable.': c.periodKinds.filter((k) => k !== 'lesson'),
  'web.leave.audience.': c.leaveAudiences,
  'web.learning.policy.': c.submissionPolicies,
  'web.exams.kinds.': c.examKinds,
  'web.exams.moveTo.': ['scheduled', 'marking', 'review', 'draft', 'closed'],
  'web.exams.stateHint.': c.examCycleStates,
  'web.exams.sitting.': c.sittingStatuses,
  'web.grading.absent.': c.absentRules,
  'web.results.subjectOutcome.': c.subjectOutcomes,
  'web.promotion.kinds.': unique(c.promotionRecommendations, c.promotionDecisionKinds),
  'web.fees.frequency.': c.feeFrequencies,
  'web.fees.kinds.': c.feeKinds,
  'web.fees.source.': c.invoiceLineSources,
  'web.fees.adjustmentKinds.': c.adjustmentKinds,
  'web.fees.methods.': c.paymentMethods,
  'web.bank.col.': ['date', 'amount', 'credit', 'debit', 'reference', 'transactionId', 'description'],
  'web.bank.by.': ['invoice', 'admission_number'],
  'web.announcements.categories.': c.announcementCategories,
  'web.announcements.targets.': c.audienceTargets,
  'web.announcements.roleAudience.': c.roles,
  'web.reports.kinds.': c.reportKinds,
  'web.reports.hints.': c.reportKinds,
  'attendance.': c.attendanceStatuses,
  'leave.': c.leaveStates,
  'homework.': ['pending', 'submitted', 'completed'],
  'exams.': unique(['absent', 'exempt', 'withheld', 'missing'], c.resultOutcomes),
  'fees.': c.feeStatuses,
  'roles.': c.roles,
  'mobile.status.': unique(c.homeworkCompletionStates, c.homeworkStates, c.quizStates, c.attemptStates, c.leaveStates, c.examCycleStates, c.publicationStates, c.accountStatuses, ['not_started', 'draft', 'submitted']),
  'mobile.work.policy.': c.submissionPolicies,
  'mobile.work.policyShort.': c.submissionPolicies,
  'mobile.lesson.': ['cancelled', 'substituted', 'room_changed'],
  'mobile.experience.': c.experiences,
  'mobile.sitting.': c.sittingStatuses,
  'mobile.tasks.': c.actionItem.shape.kind.options,
  'mobile.announcements.targets.': c.audienceTargets,
  'mobile.announcements.roles.': c.roles,
  'mobile.announcements.categories.': c.announcementCategories,
};

const sections = ['app', 'common', 'errors', 'auth', 'roles', 'nav', 'dashboard', 'attendance', 'leave', 'homework', 'quiz', 'exams', 'fees', 'notifications', 'web', 'mobile'];
const keyLiteral = new RegExp(`['"]((?:${sections.join('|')})\\.[A-Za-z0-9_]+(?:\\.[A-Za-z0-9_]+)*)['"]`, 'g');
const templatePrefix = new RegExp('`((?:' + sections.join('|') + ')\\.(?:[A-Za-z0-9_]+\\.)*)\\$\\{', 'g');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : files(p);
    return /\.(ts|tsx)$/.test(name) && !p.includes(`${join('src', 'i18n')}`) ? [p] : [];
  });
}

function lookup(tree: Tree, key: string): unknown {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Tree)) node = (node as Tree)[part];
    else return undefined;
  }
  return node;
}

function leaves(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)));
}

async function checkApp(app: string, extraNamespace: 'web' | 'mobile') {
  const src = join(root, 'apps', app, 'src');
  if (!existsSync(src)) return 0;
  const messagesModule = await import(pathToFileURL(join(src, 'i18n', `${extraNamespace}.ts`)).href);
  const extraEn = messagesModule[`${extraNamespace}En`] as Tree;
  const extraUr = messagesModule[`${extraNamespace}Ur`] as Tree;
  const locales: Record<'en' | 'ur', Tree> = {
    en: { ...(en as unknown as Tree), [extraNamespace]: extraEn },
    ur: { ...(ur as unknown as Tree), [extraNamespace]: extraUr },
  };

  const used = new Map<string, string>();
  const unknownPrefixes = new Map<string, string>();
  for (const file of [...files(src), ...(existsSync(join(root, 'apps', app, 'app')) ? files(join(root, 'apps', app, 'app')) : [])]) {
    const text = readFileSync(file, 'utf8');
    const where = relative(root, file);
    for (const m of text.matchAll(keyLiteral)) {
      const key = m[1]!;
      if (!used.has(key)) used.set(key, where);
    }
    for (const m of text.matchAll(templatePrefix)) {
      const prefix = m[1]!;
      const values = dynamic[prefix];
      if (!values) unknownPrefixes.set(prefix, where);
      else for (const v of values) if (!used.has(`${prefix}${v}`)) used.set(`${prefix}${v}`, `${where} (dynamic)`);
    }
  }

  const problems: string[] = [];
  for (const [key, where] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    for (const locale of ['en', 'ur'] as const) {
      const v = lookup(locales[locale], key);
      // Keys used as i18next objects (e.g. notifications.generic) are allowed to be objects.
      if (typeof v !== 'string' && !(v && typeof v === 'object' && key.startsWith('notifications.'))) problems.push(`[${app}] missing ${locale}: ${key}  ← ${where}`);
    }
  }
  for (const [prefix, where] of unknownPrefixes) problems.push(`[${app}] unknown dynamic key prefix "${prefix}" ← ${where} (add it to scripts/check-i18n.ts)`);

  // Urdu must mirror English exactly for the app namespace.
  const enLeaves = new Set(leaves(extraEn));
  const urLeaves = new Set(leaves(extraUr));
  for (const k of enLeaves) if (!urLeaves.has(k)) problems.push(`[${app}] ${extraNamespace}Ur lacks ${extraNamespace}.${k}`);
  for (const k of urLeaves) if (!enLeaves.has(k)) problems.push(`[${app}] ${extraNamespace}Ur has extra ${extraNamespace}.${k}`);

  for (const p of problems) console.log(p);
  console.log(`[${app}] ${used.size} keys checked, ${problems.length} problem(s).`);
  return problems.length;
}

const sharedEn = new Set(leaves(en as unknown as Tree));
const sharedUr = new Set(leaves(ur as unknown as Tree));
let failures = 0;
for (const k of sharedEn) if (!sharedUr.has(k)) (console.log(`[shared] ur lacks ${k}`), failures++);
failures += await checkApp('web', 'web');
failures += await checkApp('mobile', 'mobile');
process.exit(failures ? 1 : 0);
