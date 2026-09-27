'use client';

import { Download, FileUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ImportBatch } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { Badge, Card, PageHeader } from '@/components/ui/layout';
import { InlineError } from '@/components/ui/states';
import { DataTable } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useApi, useLang } from '@/lib/hooks';
import { uploadFile } from '@/lib/upload';

function Imports() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [kind, setKind] = useState(params.get('kind') === 'teachers' ? 'teachers' : 'students');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const list = useApi<{ items: ImportBatch[] }>(['imports'], '/imports');

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFile(file, 'import');
      const batch = await api.post<ImportBatch>('/imports', { kind, fileId: uploaded.id });
      router.push(`/admin/imports/${batch.id}`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('web.nav.imports')} subtitle={t('web.imports.subtitle')} />
      <Card title={t('web.imports.newImport')} className="mb-6 max-w-3xl">
        <ol className="mb-5 list-decimal space-y-1 ps-5 text-ink-soft">
          <li>{t('web.imports.step1')}</li>
          <li>{t('web.imports.step2')}</li>
          <li>{t('web.imports.step3')}</li>
        </ol>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField className="w-48" label={t('web.common.type')} value={kind} onValue={setKind} options={[{ value: 'students', label: t('nav.students') }, { value: 'teachers', label: t('nav.teachers') }]} />
          <a href={`/api/v1/imports/templates/${kind}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-medium hover:bg-sunken">
            <Download size={16} /> {t('web.common.downloadTemplate')}
          </a>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-4 text-sm hover:bg-sunken">
            <FileUp size={16} />
            <span className="max-w-56 truncate">{file ? file.name : t('web.common.chooseFile')}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button variant="primary" loading={busy} disabled={!file} onClick={start}>
            {busy ? t('web.common.uploading') : t('web.imports.validate')}
          </Button>
        </div>
        <p className="mt-3 text-[13px] text-muted">{t('web.imports.limits')}</p>
        <div className="mt-3">
          <InlineError error={error} />
        </div>
      </Card>
      <Card title={t('web.imports.previous')} padded={false}>
        <DataTable
          rows={list.data?.items ?? []}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/admin/imports/${r.id}`)}
          columns={[
            { key: 'f', header: t('web.imports.file'), cell: (r) => <Link className="text-accent-700 hover:underline" href={`/admin/imports/${r.id}`}>{r.fileName}</Link> },
            { key: 'k', header: t('web.common.type'), cell: (r) => t(r.kind === 'students' ? 'nav.students' : 'nav.teachers') },
            { key: 'r', header: t('web.imports.rows'), numeric: true, cell: (r) => r.rowCount },
            { key: 'e', header: t('web.imports.errors'), numeric: true, cell: (r) => r.errorCount },
            { key: 's', header: t('common.status'), cell: (r) => <Badge tone={stateTone[r.state] ?? 'neutral'}>{t(`web.status.${r.state}`)}</Badge> },
            { key: 'd', header: t('common.date'), cell: (r) => formatDateTime(r.createdAt, lang) },
          ]}
        />
      </Card>
    </>
  );
}

export default function ImportsPage() {
  return (
    <Suspense>
      <Imports />
    </Suspense>
  );
}
