import type { Config } from './config';
import { connect, type DbHandle } from './db/client';
import type { AuthProvider } from './auth/provider';
import { LocalAuthProvider } from './auth/local-provider';
import { SupabaseAuthProvider } from './auth/supabase-provider';
import { JobQueue } from './jobs/queue';
import { AcademicsService } from './modules/academics/service';
import { EnrollmentService } from './modules/academics/enrollment';
import { TeachingService } from './modules/academics/teaching';
import { CommunicationsService } from './modules/communications/service';
import { IdentityService } from './modules/identity/service';
import { AccountService } from './modules/people/accounts';
import { PeopleService } from './modules/people/service';
import { PlatformService } from './modules/platform/service';
import { SchoolService } from './modules/school/service';
import { TimetableService } from './modules/timetable/service';
import { AttendanceService } from './modules/attendance/service';
import { LeaveService } from './modules/attendance/leave';
import { FilesService } from './modules/files/service';
import { HomeworkService } from './modules/learning/homework';
import { QuizService } from './modules/learning/quizzes';
import { ExamService } from './modules/assessment/exams';
import { PromotionService } from './modules/assessment/promotion';
import { ResultsService } from './modules/assessment/results';
import { BankReconciliationService } from './modules/finance/bank';
import { FeesService } from './modules/finance/fees';
import { ImportService } from './modules/imports/service';
import { InsightsService } from './modules/insights/service';
import { PushService } from './modules/communications/push';
import { OperationsService } from './modules/operations/service';
import { ReportsService } from './modules/reports/service';
import { PdfRenderer } from './reports/pdf';
import type { StorageProvider } from './storage/provider';
import { LocalStorageProvider } from './storage/local';
import { SupabaseStorageProvider } from './storage/supabase';

/**
 * Wires infrastructure and services once per process. The API server and the worker both build a
 * container, so background jobs reuse exactly the same business services as HTTP requests.
 */
export interface Container {
  config: Config;
  app: DbHandle;
  owner: DbHandle;
  auth: AuthProvider;
  jobs: JobQueue;
  identity: IdentityService;
  accounts: AccountService;
  platform: PlatformService;
  comms: CommunicationsService;
  school: SchoolService;
  academics: AcademicsService;
  enrollment: EnrollmentService;
  teaching: TeachingService;
  people: PeopleService;
  timetable: TimetableService;
  attendance: AttendanceService;
  leave: LeaveService;
  storage: StorageProvider;
  files: FilesService;
  homework: HomeworkService;
  quizzes: QuizService;
  exams: ExamService;
  results: ResultsService;
  promotion: PromotionService;
  fees: FeesService;
  bank: BankReconciliationService;
  imports: ImportService;
  reports: ReportsService;
  insights: InsightsService;
  push: PushService;
  operations: OperationsService;
  pdf: PdfRenderer;
  close(): Promise<void>;
}

export interface ContainerOptions {
  role: 'api' | 'worker';
  authProvider?: AuthProvider;
}

export async function createContainer(config: Config, options: ContainerOptions): Promise<Container> {
  const app = connect(config.DATABASE_URL, { max: config.DATABASE_POOL_MAX, application: `edventure-${options.role}` });
  const owner = connect(config.DATABASE_OWNER_URL, { max: 2, application: `edventure-${options.role}-owner` });

  const auth =
    options.authProvider ??
    (config.AUTH_PROVIDER === 'supabase'
      ? new SupabaseAuthProvider(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, config.SUPABASE_ANON_KEY!, config.SUPABASE_JWT_ISSUER)
      : new LocalAuthProvider(config.DATABASE_OWNER_URL, config.LOCAL_AUTH_SECRET!));
  await auth.init();

  // The worker runs pg-boss with the owner role (queue maintenance); the API only enqueues.
  const jobs = new JobQueue(options.role === 'worker' ? config.DATABASE_OWNER_URL : config.DATABASE_URL, {
    role: options.role === 'worker' ? 'worker' : 'producer',
  });
  await jobs.start();

  const db = app.db;
  const accounts = new AccountService(db, auth, config.AUTH_IDENTITY_DOMAIN);
  const identity = new IdentityService(db, auth, config.AUTH_IDENTITY_DOMAIN);
  const platform = new PlatformService(owner.db, db, accounts);
  const comms = new CommunicationsService(db, jobs);
  const school = new SchoolService(db, comms);
  const enrollment = new EnrollmentService(db);
  const academics = new AcademicsService(db, () => enrollment);
  const teaching = new TeachingService(db);
  const people = new PeopleService(db, accounts, enrollment, auth);
  const timetable = new TimetableService(db, comms);
  const attendance = new AttendanceService(db);
  const leave = new LeaveService(db, comms);
  const storage: StorageProvider =
    config.STORAGE_PROVIDER === 'supabase'
      ? new SupabaseStorageProvider(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!, config.SUPABASE_STORAGE_BUCKET)
      : new LocalStorageProvider(config.localStorageDir, config.PUBLIC_API_URL, config.LOCAL_AUTH_SECRET ?? 'dev-storage-secret');
  const files = new FilesService(db, storage, jobs, config);
  const homework = new HomeworkService(db, files, comms);
  const quizzes = new QuizService(db, comms);
  const exams = new ExamService(db, comms);
  const results = new ResultsService(db, comms);
  const promotion = new PromotionService(db, enrollment);
  const fees = new FeesService(db, comms);
  const bank = new BankReconciliationService(db, storage, fees);
  const imports = new ImportService(db, storage, accounts, enrollment, jobs);
  const pdf = new PdfRenderer({ channel: config.PDF_BROWSER_CHANNEL, executablePath: config.PDF_BROWSER_PATH });
  const reports = new ReportsService(db, jobs, files, comms, pdf, { attendance, exams, results, fees, homework });
  const insights = new InsightsService(db, { attendance, fees, timetable });
  const push = new PushService(db, config.EXPO_ACCESS_TOKEN);
  const operations = new OperationsService(db, auth, storage);

  return {
    config,
    app,
    owner,
    auth,
    jobs,
    identity,
    accounts,
    platform,
    comms,
    school,
    academics,
    enrollment,
    teaching,
    people,
    timetable,
    attendance,
    leave,
    storage,
    files,
    homework,
    quizzes,
    exams,
    results,
    promotion,
    fees,
    bank,
    imports,
    reports,
    insights,
    push,
    operations,
    pdf,
    async close() {
      await jobs.stop();
      await pdf.close();
      await auth.close();
      await app.close();
      await owner.close();
    },
  };
}
