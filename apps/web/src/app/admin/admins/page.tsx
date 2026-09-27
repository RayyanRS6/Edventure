'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IssuedCredential, z } from '@edventure/contracts';
import { adminListItem } from '@edventure/contracts';
import { CredentialDialog } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api, fieldError } from '@/lib/api';
import { accountTone, formatDateTime } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

export default function AdminsPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<{ items: z.infer<typeof adminListItem>[] }>(['admins'], '/admins');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ displayName: '', displayNameUr: '', username: '' });
  const [credential, setCredential] = useState<IssuedCredential[] | null>(null);
  const create = useAction(() => api.post<{ credential: IssuedCredential | null }>('/admins', { ...f, displayNameUr: f.displayNameUr || null }), {
    invalidate: [['admins']],
    onSuccess: (r) => {
      setOpen(false);
      setF({ displayName: '', displayNameUr: '', username: '' });
      if (r.credential) setCredential([r.credential]);
    },
  });
  return (
    <>
      <PageHeader title={t('nav.admins')} subtitle={t('web.people.adminsHint')} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('web.people.addAdmin')}</Button>} />
      <Card padded={false}>
        {q.isLoading ? (
          <LoadingBlock />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : (
          <DataTable
            rows={q.data?.items ?? []}
            rowKey={(r) => r.accountId}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <span className="font-medium">{r.displayName}</span> },
              { key: 'u', header: t('auth.username'), cell: (r) => <span dir="ltr">{r.username}</span> },
              { key: 'l', header: t('web.people.lastSignIn'), cell: (r) => formatDateTime(r.lastLoginAt, lang) },
              { key: 's', header: t('common.status'), cell: (r) => <span className="flex gap-1"><Badge tone={accountTone[r.status]}>{t(`web.status.${r.status}`)}</Badge>{r.isTeacher && <Badge tone="info">{t('roles.teacher')}</Badge>}</span> },
            ]}
          />
        )}
      </Card>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('web.people.addAdmin')} footer={<Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)}>{t('common.create')}</Button>}>
        <div className="grid gap-3">
          <TextField label={t('web.common.name')} value={f.displayName} onValue={(v) => setF({ ...f, displayName: v })} error={fieldError(create.error, 'displayName')} />
          <TextField label={t('web.common.nameUr')} value={f.displayNameUr} onValue={(v) => setF({ ...f, displayNameUr: v })} dir="rtl" />
          <TextField label={t('auth.username')} value={f.username} onValue={(v) => setF({ ...f, username: v })} dir="ltr" error={fieldError(create.error, 'username')} />
          <p className="text-[13px] text-muted">{t('web.people.adminMfaHint')}</p>
          <InlineError error={create.error} />
        </div>
      </Dialog>
      <CredentialDialog credentials={credential} onClose={() => setCredential(null)} />
    </>
  );
}
