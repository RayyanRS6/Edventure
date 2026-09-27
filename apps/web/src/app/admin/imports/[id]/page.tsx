'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportBatch, ImportRow, IssuedCredential } from '@edventure/contracts';
import { CredentialDialog } from '@/components/people/account-actions';
import { Button } from '@/components/ui/button';
import { Badge, Card, Grid, PageHeader, Stat } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { stateTone } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

type Detail = ImportBatch & { rows: ImportRow[] };

export default function ImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const q = useApi<Detail>(['import', id], `/imports/${id}`, undefined, { refetchInterval: 3000 });
  const [credentials, setCredentials] = useState<IssuedCredential[] | null>(null);
  const commit = useAction(() => api.post(`/imports/${id}/commit`), { invalidate: [['import', id], ['imports']] });
  const issue = useAction(
    (accountIds: string[]) => api.post<{ issued: IssuedCredential[]; failed: Array<{ accountId: string; message: string }> }>('/accounts/issue-credentials', { accountIds }),
    { onSuccess: (r) => setCredentials(r.issued), toastErrors: true },
  );
  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const b = q.data;
  const accountIds = b.rows.map((r) => (r.outcome as { accountId?: string } | null)?.accountId).filter((x): x is string => !!x);
  return (
    <>
      <PageHeader
        back={<Link href="/admin/imports" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('web.nav.imports')}</Link>}
        title={b.fileName}
        subtitle={<Badge tone={stateTone[b.state] ?? 'neutral'}>{t(`web.status.${b.state}`)}</Badge>}
        actions={
          <>
            {b.state === 'validated' && (
              <Button variant="primary" loading={commit.isPending} onClick={() => commit.mutate(undefined)}>
                {t('web.imports.commit', { count: b.rowCount })}
              </Button>
            )}
            {b.state === 'committed' && accountIds.length > 0 && (
              <Button variant="primary" loading={issue.isPending} onClick={() => issue.mutate(accountIds)}>
                {t('web.imports.issueCredentials')}
              </Button>
            )}
          </>
        }
      />
      <Grid cols={4} className="mb-4">
        <Stat label={t('web.imports.rows')} value={b.rowCount} />
        <Stat label={t('web.imports.valid')} value={b.rowCount - b.errorCount} />
        <Stat label={t('web.imports.errors')} value={b.errorCount} tone={b.errorCount ? 'danger' : undefined} />
        <Stat label={t('common.status')} value={t(`web.status.${b.state}`)} />
      </Grid>
      {b.state === 'invalid' && <p className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-danger-fg">{t('web.imports.invalidHint')}</p>}
      {b.state === 'committing' && <p className="mb-4 rounded-lg bg-info-bg px-4 py-3 text-info-fg">{t('web.imports.committingHint')}</p>}
      {b.state === 'committed' && <p className="mb-4 rounded-lg bg-success-bg px-4 py-3 text-success-fg">{t('web.imports.committedHint')}</p>}
      <InlineError error={commit.error} />
      <Card padded={false}>
        <DataTable
          rows={b.rows}
          rowKey={(r) => r.id}
          columns={[
            { key: 'n', header: '#', numeric: true, cell: (r) => r.rowNumber },
            { key: 'name', header: t('web.common.name'), cell: (r) => r.raw['display_name'] ?? '' },
            { key: 'id', header: t('auth.username'), cell: (r) => <span dir="ltr">{r.raw['username'] ?? ''}</span> },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={r.status === 'valid' || r.status === 'committed' ? 'success' : 'danger'}>{t(`web.status.${r.status}`)}</Badge> },
            {
              key: 'e',
              header: t('web.imports.errors'),
              cell: (r) => (
                <ul className="text-[13px] text-danger-fg">
                  {r.errors.map((e, i) => (
                    <li key={i}>
                      {e.field && <code className="me-1 text-ink-soft">{e.field}</code>}
                      {e.message}
                    </li>
                  ))}
                </ul>
              ),
            },
          ]}
        />
      </Card>
      <CredentialDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}
