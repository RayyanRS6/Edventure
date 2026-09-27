'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';
import { LoadingBlock } from '@/components/ui/states';
import { ApiError } from '@/lib/api';
import { routeForNext, useSession, useSignOut } from '@/lib/session';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();

  useEffect(() => {
    if (session.error instanceof ApiError && session.error.status === 401) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    if (session.data && session.data.next !== 'ready') router.replace(routeForNext(session.data.next));
  }, [session.error, session.data, router]);

  if (session.isLoading || !session.data || session.data.next !== 'ready') return <LoadingBlock />;
  if (!session.data.me.experiences.includes('admin')) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">{t('web.auth.adminsOnlyTitle')}</h1>
        <p className="text-muted">{t('web.auth.adminsOnly')}</p>
        <Button onClick={signOut}>{t('common.signOut')}</Button>
      </div>
    );
  }
  return <AppShell me={session.data.me}>{children}</AppShell>;
}
