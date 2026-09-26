import type { Container } from './container';
import type { App } from './http/types';
import { registerAcademicsRoutes } from './modules/academics/routes';
import { registerCommunicationsRoutes } from './modules/communications/routes';
import { registerIdentityRoutes } from './modules/identity/routes';
import { registerPeopleRoutes } from './modules/people/routes';
import { registerSchoolRoutes } from './modules/school/routes';
import { registerTimetableRoutes } from './modules/timetable/routes';
import { registerAttendanceRoutes } from './modules/attendance/routes';
import { registerFileRoutes } from './modules/files/routes';
import { registerLearningRoutes } from './modules/learning/routes';
import { registerAssessmentRoutes } from './modules/assessment/routes';
import { registerFinanceRoutes } from './modules/finance/routes';
import { registerInsightRoutes } from './modules/insights/routes';

/** Every API family, mounted under /api/v1. One backend serves the website and all mobile experiences. */
export function registerRoutes(app: App, c: Container) {
  registerIdentityRoutes(app, c);
  registerSchoolRoutes(app, c);
  registerAcademicsRoutes(app, c);
  registerPeopleRoutes(app, c);
  registerCommunicationsRoutes(app, c);
  registerTimetableRoutes(app, c);
  registerAttendanceRoutes(app, c);
  registerFileRoutes(app, c);
  registerLearningRoutes(app, c);
  registerAssessmentRoutes(app, c);
  registerFinanceRoutes(app, c);
  registerInsightRoutes(app, c);
}
