'use client';

import { Plus, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportBatch, z } from '@edventure/contracts';
import { bankAccount, bankImportProfile } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Checkbox, SelectField, TextField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { EmptyState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';
import { uploadFile } from '@/lib/upload';

type Account = z.infer<typeof bankAccount>;
type Profile = z.infer<typeof bankImportProfile>;
const dateFormats = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'DD-MMM-YYYY'] as const;

const emptyProfile = () => ({
  bankAccountId: '',
  name: '',
  delimiter: ',',
  skipRows: '0',
  hasHeader: true,
  amountMode: 'single' as 'single' | 'split',
  columns: { date: 'Date', amount: 'Amount', credit: 'Credit', debit: 'Debit', reference: 'Reference', transactionId: 'Transaction ID', description: 'Description' },
  dateFormat: 'DD/MM/YYYY' as (typeof dateFormats)[number],
  thousandsSeparator: ',',
});

export default function BankPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const accounts = useApi<{ items: Account[] }>(['bank-accounts'], '/bank-accounts');
  const profiles = useApi<{ items: Profile[] }>(['bank-profiles'], '/bank-import-profiles');
  const imports = useApi<{ items: ImportBatch[] }>(['bank-imports'], '/bank-imports');
  const [accountForm, setAccountForm] = useState<{ name: string; bankName: string; accountNumberMasked: string } | null>(null);
  const [profileForm, setProfileForm] = useState<ReturnType<typeof emptyProfile> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [u, setU] = useState<{ profileId: string; file: File | null }>({ profileId: '', file: null });

  const createAccount = useAction(() => api.post('/bank-accounts', { ...accountForm, accountNumberMasked: accountForm!.accountNumberMasked || null }), {
    invalidate: [['bank-accounts']],
    success: t('web.common.created'),
    onSuccess: () => setAccountForm(null),
  });
  const createProfile = useAction(() => {
    const p = profileForm!;
    const c = p.columns;
    return api.post('/bank-import-profiles', {
      bankAccountId: p.bankAccountId,
      name: p.name,
      mapping: {
        delimiter: p.delimiter,
        skipRows: Number(p.skipRows) || 0,
        hasHeader: p.hasHeader,
        dateFormat: p.dateFormat,
        thousandsSeparator: p.thousandsSeparator,
        columns: {
          date: c.date,
          ...(p.amountMode === 'single' ? { amount: c.amount } : { credit: c.credit, debit: c.debit || undefined }),
          reference: c.reference || undefined,
          transactionId: c.transactionId || undefined,
          description: c.description || undefined,
        },
      },
    });
  }, { invalidate: [['bank-profiles']], success: t('web.common.created'), onSuccess: () => setProfileForm(null) });
  const upload = useAction(
    async () => {
      const file = await uploadFile(u.file!, 'import');
      return api.post<{ id: string }>('/bank-imports', { bankImportProfileId: u.profileId, fileId: file.id });
    },
    { invalidate: [['bank-imports']], onSuccess: (b) => router.push(`/admin/fees/bank/${b.id}`) },
  );
  const accountName = (id: string) => accounts.data?.items.find((a) => a.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader
        title={t('web.nav.bank')}
        subtitle={t('web.bank.subtitle')}
        actions={<Button variant="primary" icon={<Upload size={16} />} disabled={!profiles.data?.items.length} onClick={() => { setU({ profileId: profiles.data?.items[0]?.id ?? '', file: null }); setUploading(true); }}>{t('web.bank.upload')}</Button>}
      />
      <Card title={t('web.bank.imports')} padded={false} className="mb-4">
        {imports.isLoading ? (
          <LoadingBlock />
        ) : (
          <DataTable
            rows={imports.data?.items ?? []}
            rowKey={(r) => r.id}
            onRowClick={(r) => router.push(`/admin/fees/bank/${r.id}`)}
            empty={<EmptyState title={t('web.bank.noImports')} hint={t('web.bank.noImportsHint')} />}
            columns={[
              { key: 'f', header: t('web.bank.file'), cell: (r) => <span className="font-medium">{r.fileName}</span> },
              { key: 'd', header: t('web.bank.uploaded'), cell: (r) => formatDateTime(r.createdAt, lang) },
              { key: 'n', header: t('web.imports.rows'), numeric: true, cell: (r) => r.rowCount },
              { key: 'm', header: t('web.bank.matched'), numeric: true, cell: (r) => Number(r.summary['matched'] ?? 0) },
              { key: 'rv', header: t('web.bank.review'), numeric: true, cell: (r) => Number(r.summary['review'] ?? 0) },
              { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge> },
            ]}
          />
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={t('web.bank.accounts')} padded={false} actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setAccountForm({ name: '', bankName: '', accountNumberMasked: '' })}>{t('common.add')}</Button>}>
          <DataTable
            rows={accounts.data?.items ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title={t('web.bank.noAccounts')} />}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'b', header: t('web.bank.bankName'), cell: (r) => r.bankName },
              { key: 'a', header: t('web.bank.accountNumber'), cell: (r) => <span dir="ltr">{r.accountNumberMasked ?? '—'}</span> },
            ]}
          />
        </Card>
        <Card title={t('web.bank.profiles')} padded={false} actions={<Button size="sm" icon={<Plus size={14} />} disabled={!accounts.data?.items.length} onClick={() => setProfileForm({ ...emptyProfile(), bankAccountId: accounts.data?.items[0]?.id ?? '' })}>{t('common.add')}</Button>}>
          <DataTable
            rows={profiles.data?.items ?? []}
            rowKey={(r) => r.id}
            empty={<EmptyState title={t('web.bank.noProfiles')} hint={t('web.bank.noProfilesHint')} />}
            columns={[
              { key: 'n', header: t('web.common.name'), cell: (r) => <div><p className="font-medium">{r.name}</p><p className="text-[12px] text-muted">{accountName(r.bankAccountId)}</p></div> },
              { key: 'f', header: t('web.bank.dateFormat'), cell: (r) => <code className="text-[12px]">{r.mapping.dateFormat}</code> },
              { key: 'v', header: t('web.common.version'), numeric: true, cell: (r) => r.mappingVersion },
            ]}
          />
        </Card>
      </div>

      <Dialog open={!!accountForm} onClose={() => setAccountForm(null)} title={t('web.bank.newAccount')} footer={<Button variant="primary" loading={createAccount.isPending} disabled={!accountForm?.name || !accountForm.bankName} onClick={() => createAccount.mutate(undefined)}>{t('common.create')}</Button>}>
        {accountForm && (
          <div className="grid gap-3">
            <TextField label={t('web.common.name')} value={accountForm.name} onValue={(v) => setAccountForm({ ...accountForm, name: v })} placeholder="Fee collection account" required />
            <TextField label={t('web.bank.bankName')} value={accountForm.bankName} onValue={(v) => setAccountForm({ ...accountForm, bankName: v })} required />
            <TextField label={t('web.bank.accountNumber')} value={accountForm.accountNumberMasked} onValue={(v) => setAccountForm({ ...accountForm, accountNumberMasked: v })} hint={t('web.bank.accountNumberHint')} dir="ltr" />
            <InlineError error={createAccount.error} />
          </div>
        )}
      </Dialog>
      <Dialog open={!!profileForm} onClose={() => setProfileForm(null)} title={t('web.bank.newProfile')} wide footer={<Button variant="primary" loading={createProfile.isPending} disabled={!profileForm?.name || !profileForm.bankAccountId || !profileForm.columns.date} onClick={() => createProfile.mutate(undefined)}>{t('common.create')}</Button>}>
        {profileForm && (
          <div className="grid gap-3">
            <p className="text-[13px] text-muted">{t('web.bank.profileHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label={t('web.bank.account')} value={profileForm.bankAccountId} onValue={(v) => setProfileForm({ ...profileForm, bankAccountId: v })} options={(accounts.data?.items ?? []).map((a) => ({ value: a.id, label: a.name }))} />
              <TextField label={t('web.common.name')} value={profileForm.name} onValue={(v) => setProfileForm({ ...profileForm, name: v })} placeholder="HBL statement CSV" required />
              <SelectField label={t('web.bank.delimiter')} value={profileForm.delimiter} onValue={(v) => setProfileForm({ ...profileForm, delimiter: v })} options={[{ value: ',', label: t('web.bank.comma') }, { value: ';', label: t('web.bank.semicolon') }, { value: '\t', label: t('web.bank.tab') }]} />
              <SelectField label={t('web.bank.dateFormat')} value={profileForm.dateFormat} onValue={(v) => setProfileForm({ ...profileForm, dateFormat: v as (typeof dateFormats)[number] })} options={dateFormats.map((f) => ({ value: f, label: f }))} />
              <TextField label={t('web.bank.skipRows')} value={profileForm.skipRows} onValue={(v) => setProfileForm({ ...profileForm, skipRows: v.replace(/\D/g, '') })} hint={t('web.bank.skipRowsHint')} dir="ltr" />
              <SelectField label={t('web.bank.thousands')} value={profileForm.thousandsSeparator} onValue={(v) => setProfileForm({ ...profileForm, thousandsSeparator: v })} options={[{ value: ',', label: '1,234' }, { value: ' ', label: '1 234' }, { value: '', label: '1234' }]} />
            </div>
            <Checkbox label={t('web.bank.hasHeader')} checked={profileForm.hasHeader} onChange={(v) => setProfileForm({ ...profileForm, hasHeader: v })} />
            <h3 className="mt-2 font-semibold">{t('web.bank.columns')}</h3>
            <p className="text-[13px] text-muted">{profileForm.hasHeader ? t('web.bank.columnsByName') : t('web.bank.columnsByNumber')}</p>
            <SelectField label={t('web.bank.amountMode')} value={profileForm.amountMode} onValue={(v) => setProfileForm({ ...profileForm, amountMode: v as 'single' | 'split' })} options={[{ value: 'single', label: t('web.bank.singleAmount') }, { value: 'split', label: t('web.bank.splitAmount') }]} />
            <div className="grid gap-3 sm:grid-cols-3">
              {(['date', ...(profileForm.amountMode === 'single' ? ['amount'] : ['credit', 'debit']), 'reference', 'transactionId', 'description'] as Array<keyof typeof profileForm.columns>).map((k) => (
                <TextField key={k} label={t(`web.bank.col.${k}`)} value={profileForm.columns[k]} onValue={(v) => setProfileForm({ ...profileForm, columns: { ...profileForm.columns, [k]: v } })} required={k === 'date'} />
              ))}
            </div>
            <p className="text-[13px] text-muted">{t('web.bank.referenceHint')}</p>
            <InlineError error={createProfile.error} />
          </div>
        )}
      </Dialog>
      <Dialog open={uploading} onClose={() => setUploading(false)} title={t('web.bank.upload')} footer={<Button variant="primary" loading={upload.isPending} disabled={!u.file || !u.profileId} onClick={() => upload.mutate(undefined)}>{t('common.upload')}</Button>}>
        <div className="grid gap-3">
          <SelectField label={t('web.bank.profile')} value={u.profileId} onValue={(v) => setU({ ...u, profileId: v })} options={(profiles.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${accountName(p.bankAccountId)}` }))} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-soft">{t('web.bank.statementFile')}</span>
            <input type="file" accept=".csv,text/csv" className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-accent-800" onChange={(e) => setU({ ...u, file: e.target.files?.[0] ?? null })} />
          </label>
          <p className="text-[13px] text-muted">{t('web.bank.uploadHint')}</p>
          <InlineError error={upload.error} />
        </div>
      </Dialog>
    </>
  );
}
