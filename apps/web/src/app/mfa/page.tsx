'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Me, NextStep } from '@edventure/contracts';
import { AuthFrame } from '@/components/auth-frame';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { InlineError, LoadingBlock } from '@/components/ui/states';
import { api, fieldError } from '@/lib/api';
import { meKey, useSession } from '@/lib/session';

export default function MfaPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const [enrollment, setEnrollment] = useState<{ factorId: string; otpauthUri: string; secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const needsEnroll = session.data?.next === 'mfa_enroll';

  useEffect(() => {
    if (!needsEnroll || enrollment) return;
    api
      .post<{ factorId: string; otpauthUri: string; secret: string }>('/auth/mfa/enroll')
      .then(async (e) => setEnrollment({ ...e, qr: await QRCode.toDataURL(e.otpauthUri, { margin: 1, width: 220 }) }))
      .catch(setError);
  }, [needsEnroll, enrollment]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/mfa/verify', { code, factorId: enrollment?.factorId });
      const me = await api.get<{ me: Me; next: NextStep }>('/me');
      qc.setQueryData(meKey, me);
      router.replace('/admin');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (session.isLoading) return <LoadingBlock />;
  return (
    <AuthFrame title={t('auth.mfaTitle')} subtitle={needsEnroll ? t('auth.mfaEnrollHint') : t('auth.mfaVerifyHint')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {needsEnroll && enrollment && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <img src={enrollment.qr} alt="" width={220} height={220} />
            <p className="text-center text-[13px] text-muted">
              {t('auth.secretKey')}: <code dir="ltr" className="select-all break-all font-sans text-ink">{enrollment.secret}</code>
            </p>
          </div>
        )}
        <TextField label={t('auth.mfaCode')} value={code} onValue={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} dir="ltr" autoComplete="one-time-code" required error={fieldError(error, 'code')} />
        <InlineError error={error && !fieldError(error, 'code') ? error : null} />
        <Button type="submit" variant="primary" loading={busy} disabled={code.length !== 6}>
          {t('auth.verify')}
        </Button>
      </form>
    </AuthFrame>
  );
}
