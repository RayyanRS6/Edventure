import type { Experience } from '@edventure/contracts';

/** Tab home for each experience. */
export const homeFor: Record<Experience, string> = { student: '/student/home', teacher: '/teacher/today', admin: '/admin/home' };

/**
 * Notification links are app routes shared by every client (e.g. `/homework/:id`). Map them to this
 * app's screens for the active experience; unknown links open the inbox.
 */
export function routeForLink(link: string | null | undefined, experience: Experience): string {
  if (!link?.startsWith('/')) return `/${experience}/notifications`;
  const [path = '', query] = link.slice(1).split('?');
  const [section, id] = path.split('/');
  switch (section) {
    case 'homework':
      return id ? `/homework/${id}` : `/${experience}/${experience === 'teacher' ? 'work' : 'learning'}`;
    case 'quizzes':
      return id ? `/quiz/${id}` : `/${experience}/learning`;
    case 'materials':
      return '/student/learning';
    case 'announcements':
      return id ? `/announcement/${id}` : `/${experience}/notifications`;
    case 'leave':
      return experience === 'admin' ? '/admin/approvals' : '/leave';
    case 'results':
      return experience === 'admin' ? '/admin/approvals' : '/results';
    case 'fees':
      return experience === 'admin' ? '/admin/more' : '/fees';
    case 'exams':
      return '/date-sheet';
    case 'timetable':
    case 'calendar':
    case 'today':
      return experience === 'student' ? '/student/timetable' : experience === 'teacher' ? `/teacher/today${query ? `?${query}` : ''}` : '/admin/home';
    case 'work':
      return '/teacher/work';
    default:
      return `/${experience}/notifications`;
  }
}
