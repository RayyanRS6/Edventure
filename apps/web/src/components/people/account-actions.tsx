'use client';

import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Printer, RotateCcw, ShieldOff, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountSummary, IssuedCredential } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, TwoStepDeleteDialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { InlineError } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';

/** Temporary credentials are shown once, right after provisioning or a reset, and never again. */
export function CredentialDialog({ credentials, onClose }: { credentials: IssuedCredential[] | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={!!credentials}
      onClose={onClose}
      title={t('web.people.credentialsTitle')}
      wide={!!credentials && credentials.length > 1}
      footer={
        <>
          <Button icon={<Printer size={16} />} onClick={() => window.print()}>
            {t('web.common.print')}
          </Button>
          <Button variant="primary" onClick={onClose}>
            {t('common.done')}
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-lg bg-warning-bg px-3 py-2 text-[13px] text-warning-fg">{t('web.people.credentialsOnce')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {credentials?.map((c) => (
          <div key={c.accountId} className="rounded-xl border border-dashed border-line-strong p-4">
            <p className="font-semibold">{c.displayName}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" dir="ltr">
              <dt className="text-muted">Username</dt>
              <dd className="font-sans">{c.username}</dd>
              <dt className="text-muted">Password</dt>
              <dd className="select-all font-sans">{c.temporaryPassword}</dd>
            </dl>
            <p className="mt-2 text-[12px] text-muted">{t('web.people.changeOnFirstLogin')}</p>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function ReasonDialog({ open, title, confirmLabel, danger, onClose, onConfirm }: { open: boolean; title: string; confirmLabel: string; danger?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<unknown> }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm(reason);
                setReason('');
                onClose();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label={t('web.common.reason')} value={reason} onValue={setReason} required />
        <InlineError error={error} />
      </div>
    </Dialog>
  );
}

/** Credential reset, app-access suspension, two-step deletion and restoration for any account. */
export function AccountActions({ account, name, invalidate }: { account: AccountSummary; name: string; invalidate: unknown[][] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const refresh = () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
  const [credential, setCredential] = useState<IssuedCredential[] | null>(null);
  const [dialog, setDialog] = useState<'suspend' | 'reactivate' | 'delete' | null>(null);
  const reset = useAction(() => api.post<IssuedCredential>(`/accounts/${account.id}/reset-password`), {
    invalidate,
    onSuccess: (c) => setCredential([c]),
    toastErrors: true,
  });
  const restore = useAction(() => api.post<{ notRestored: string[] }>(`/accounts/${account.id}/restore`), {
    invalidate,
    onSuccess: (r) => toast(r.notRestored.length ? `${t('web.people.restored')} — ${r.notRestored.join(' ')}` : t('web.people.restored')),
    toastErrors: true,
  });
  const deleted = account.status === 'pending_deletion';
  return (
    <>
      {deleted ? (
        <Button variant="primary" icon={<RotateCcw size={16} />} loading={restore.isPending} onClick={() => restore.mutate(undefined)}>
          {t('common.restore')}
        </Button>
      ) : (
        <>
          <Button icon={<KeyRound size={16} />} loading={reset.isPending} onClick={() => reset.mutate(undefined)}>
            {account.provisioningState === 'provisioned' ? t('web.people.resetPassword') : t('web.people.setUpSignIn')}
          </Button>
          {account.status === 'suspended' || account.status === 'disabled' ? (
            <Button icon={<ShieldCheck size={16} />} onClick={() => setDialog('reactivate')}>
              {t('web.people.reactivate')}
            </Button>
          ) : (
            <Button icon={<ShieldOff size={16} />} onClick={() => setDialog('suspend')}>
              {t('web.people.suspendAccess')}
            </Button>
          )}
          <Button variant="ghost" className="text-danger-fg" icon={<Trash2 size={16} />} onClick={() => setDialog('delete')}>
            {t('common.delete')}
          </Button>
        </>
      )}
      <CredentialDialog credentials={credential} onClose={() => setCredential(null)} />
      <ReasonDialog
        open={dialog === 'suspend'}
        title={t('web.people.suspendTitle', { name })}
        confirmLabel={t('web.people.suspendAccess')}
        danger
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api.post(`/accounts/${account.id}/suspend`, { reason });
          toast(t('web.people.suspended'));
          await refresh();
        }}
      />
      <ReasonDialog
        open={dialog === 'reactivate'}
        title={t('web.people.reactivateTitle', { name })}
        confirmLabel={t('web.people.reactivate')}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await api.post(`/accounts/${account.id}/reactivate`, { reason });
          toast(t('web.people.reactivated'));
          await refresh();
        }}
      />
      <TwoStepDeleteDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        subject={name}
        loadPreview={() => api.get(`/accounts/${account.id}/deletion-preview`)}
        onConfirm={async () => {
          await api.post(`/accounts/${account.id}/delete`, { confirm: true });
          toast(t('web.people.deleted'));
          await refresh();
        }}
      />
    </>
  );
}
