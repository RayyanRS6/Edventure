import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  labelKey: string;
}
export interface NavGroup {
  labelKey: string;
  icon: LucideIcon;
  href?: string;
  items?: NavItem[];
}

/** Admin website navigation (plan §4): Dashboard; People; Academics; Attendance & Leave; Learning; Exams & Results; Fees; Communications; Reports; Settings & Audit. */
export const navigation: NavGroup[] = [
  { labelKey: 'nav.dashboard', icon: LayoutDashboard, href: '/admin' },
  {
    labelKey: 'nav.people',
    icon: Users,
    items: [
      { href: '/admin/students', labelKey: 'nav.students' },
      { href: '/admin/teachers', labelKey: 'nav.teachers' },
      { href: '/admin/admins', labelKey: 'nav.admins' },
      { href: '/admin/imports', labelKey: 'web.nav.imports' },
    ],
  },
  {
    labelKey: 'nav.academics',
    icon: GraduationCap,
    items: [
      { href: '/admin/academics', labelKey: 'web.nav.structure' },
      { href: '/admin/teaching', labelKey: 'web.nav.teaching' },
      { href: '/admin/timetable', labelKey: 'nav.timetable' },
      { href: '/admin/calendar', labelKey: 'web.nav.calendar' },
    ],
  },
  {
    labelKey: 'nav.attendanceAndLeave',
    icon: CalendarCheck,
    items: [
      { href: '/admin/attendance', labelKey: 'nav.attendance' },
      { href: '/admin/leave', labelKey: 'nav.leave' },
    ],
  },
  { labelKey: 'nav.learning', icon: BookOpen, href: '/admin/learning' },
  {
    labelKey: 'nav.examsAndResults',
    icon: ClipboardList,
    items: [
      { href: '/admin/exams', labelKey: 'nav.exams' },
      { href: '/admin/results', labelKey: 'nav.results' },
      { href: '/admin/promotion', labelKey: 'web.nav.promotion' },
      { href: '/admin/grading', labelKey: 'web.nav.grading' },
    ],
  },
  {
    labelKey: 'nav.fees',
    icon: Wallet,
    items: [
      { href: '/admin/fees', labelKey: 'web.nav.feeOverview' },
      { href: '/admin/fees/invoices', labelKey: 'web.nav.invoices' },
      { href: '/admin/fees/payments', labelKey: 'web.nav.payments' },
      { href: '/admin/fees/bank', labelKey: 'web.nav.bank' },
    ],
  },
  {
    labelKey: 'nav.communications',
    icon: Megaphone,
    items: [
      { href: '/admin/announcements', labelKey: 'nav.announcements' },
      { href: '/admin/notifications', labelKey: 'nav.notifications' },
    ],
  },
  { labelKey: 'nav.reports', icon: BarChart3, href: '/admin/reports' },
  {
    labelKey: 'nav.settingsAndAudit',
    icon: Settings,
    items: [
      { href: '/admin/settings', labelKey: 'nav.settings' },
      { href: '/admin/audit', labelKey: 'nav.audit' },
    ],
  },
];
