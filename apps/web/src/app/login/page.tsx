'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoginResponse } from '@edventure/contracts';
import { AuthFrame } from '@/components/auth-frame';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { InlineError } from '@/components/ui/states';
import { api, fieldError } from '@/lib/api';
import { routeForNext } from '@/lib/session';

function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<LoginResponse>('/auth/login', { schoolCode, username, password, platform: 'web' });
      if (!res.me.experiences.includes('admin')) {
        await api.post('/auth/logout').catch(() => undefined);
        setError(new Error(t('web.auth.adminsOnly')));
        return;
      }
      const next = params.get('next');
      router.replace(routeForNext(res.next, next && next.startsWith('/admin') ? next : '/admin'));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextField label={t('auth.schoolCode')} value={schoolCode} onValue={(v) => setSchoolCode(v.toUpperCase())} dir="ltr" autoComplete="organization" required error={fieldError(error, 'schoolCode')} />
      <TextField label={t('auth.username')} value={username} onValue={setUsername} dir="ltr" autoComplete="username" required error={fieldError(error, 'username')} />
      <TextField label={t('auth.password')} type="password" value={password} onValue={setPassword} dir="ltr" autoComplete="current-password" required />
      <InlineError error={error && !fieldError(error, 'schoolCode') && !fieldError(error, 'username') ? error : null} />
      <Button type="submit" variant="primary" loading={busy} className="mt-2">
        {busy ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
      <p className="text-center text-[13px] text-muted">{t('auth.noAccountHint')}</p>
    </form>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <AuthFrame title={t('web.auth.welcome')} subtitle={t('web.auth.signInHint')}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
