'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Me, NextStep } from '@edventure/contracts';
import { AuthFrame } from '@/components/auth-frame';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { InlineError } from '@/components/ui/states';
import { api, fieldError } from '@/lib/api';
import { meKey, routeForNext } from '@/lib/session';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: next });
      const me = await api.get<{ me: Me; next: NextStep }>('/me');
      qc.setQueryData(meKey, me);
      router.replace(routeForNext(me.next));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title={t('auth.changePasswordTitle')} subtitle={t('auth.changePasswordHint')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label={t('auth.currentPassword')} type="password" value={current} onValue={setCurrent} dir="ltr" autoComplete="current-password" required error={fieldError(error, 'currentPassword')} />
        <TextField label={t('auth.newPassword')} type="password" value={next} onValue={setNext} dir="ltr" autoComplete="new-password" required hint={t('auth.passwordRules')} error={fieldError(error, 'newPassword')} />
        <TextField label={t('auth.confirmPassword')} type="password" value={confirm} onValue={setConfirm} dir="ltr" autoComplete="new-password" required error={mismatch ? t('auth.passwordsDoNotMatch') : undefined} />
        <InlineError error={error && !fieldError(error, 'currentPassword') && !fieldError(error, 'newPassword') ? error : null} />
        <Button type="submit" variant="primary" loading={busy} disabled={mismatch}>
          {t('auth.changePassword')}
        </Button>
      </form>
    </AuthFrame>
  );
}
