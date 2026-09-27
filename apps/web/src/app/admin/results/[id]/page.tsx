'use client';

import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, ChevronDown, FileText } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultPublication, StudentResultView } from '@edventure/contracts';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Badge, Grid, PageHeader, Stat, Toolbar } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber, formatPercent, stateTone } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

export default function ResultPublicationPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<ResultPublication>(['result', id], `/results/${id}`);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState<{ result: StudentResultView; text: string } | null>(null);
  const invalidate = [['result', id], ['results']];
  const publish = useAction(() => api.post(`/results/${id}/publish`, { version: q.data!.version }), { invalidate, success: t('web.results.publishedToast'), onSuccess: () => setPublishOpen(false) });
  const revise = useAction(() => api.post<ResultPublication>(`/results/${id}/revise`, { reason }), {
    invalidate: [['results']],
    onSuccess: (p) => {
      setReviseOpen(false);
      window.location.assign(`/admin/results/${p.id}`);
    },
  });
  const saveRemarks = useAction(() => api.put(`/results/${id}/remarks`, { studentResultId: remarks!.result.id, remarks: remarks!.text || null }), { invalidate, success: t('web.common.updated'), onSuccess: () => setRemarks(null) });

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const p = q.data;
  const rows = p.results.filter((r) => !outcome || r.outcome === outcome);

  return (
    <>
      <PageHeader
        back={<Link href="/admin/results" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink"><ArrowLeft size={14} className="rtl:rotate-180" /> {t('nav.results')}</Link>}
        title={`${p.examCycleName} · ${p.gradeName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={stateTone[p.state] ?? 'neutral'}>{t(`web.status.${p.state}`)}</Badge>
            <span>{t('web.results.revisionN', { n: p.revision })}</span>
            {p.publishedAt && <span>· {formatDateTime(p.publishedAt, lang)}</span>}
          </span>
        }
        actions={
          <>
            {p.state === 'draft' && <Button variant="primary" disabled={p.blockers.length > 0} onClick={() => setPublishOpen(true)}>{t('common.publish')}</Button>}
            {p.state === 'published' && <Button onClick={() => { setReason(''); setReviseOpen(true); }}>{t('web.results.revise')}</Button>}
          </>
        }
      />
      {p.correctionReason && <p className="mb-4 rounded-lg bg-info-bg px-4 py-2 text-[13px] text-info-fg">{t('web.results.correctionOf', { reason: p.correctionReason })}</p>}
      {p.blockers.length > 0 && (
        <div className="mb-4 rounded-xl border border-danger-fg/20 bg-danger-bg px-4 py-3 text-danger-fg">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> {t('web.results.blocked')}</p>
          <ul className="mt-1 list-disc ps-6 text-sm">{p.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      )}
      <Grid cols={4} className="mb-4">
        <Stat label={t('web.results.students')} value={p.results.length} />
        <Stat label={t('exams.pass')} value={p.counts.pass} />
        <Stat label={t('exams.fail')} value={p.counts.fail} tone={p.counts.fail ? 'danger' : undefined} />
        <Stat label={t('exams.incomplete')} value={p.counts.incomplete} />
      </Grid>
      <Toolbar>
        <SelectField className="w-44" label={t('web.results.outcome')} value={outcome} onValue={setOutcome} placeholder={t('common.all')} options={['pass', 'fail', 'incomplete'].map((o) => ({ value: o, label: t(`exams.${o}`) }))} />
      </Toolbar>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              {[t('web.common.student'), t('web.common.section'), t('exams.marks'), t('exams.percentage'), t('exams.grade'), t('web.results.outcome'), ''].map((h, i) => (
                <th key={i} className={clsx('px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-muted', i >= 2 && i <= 3 ? 'text-end' : 'text-start')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer border-b border-line hover:bg-accent-50/60" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-4 py-2.5">
                    <p className="flex items-center gap-1.5 font-medium"><ChevronDown size={14} className={clsx('text-muted transition-transform', expanded === r.id && 'rotate-180')} /> {r.displayName}</p>
                    <p className="ps-5 text-[12px] text-muted">{r.admissionNumber}</p>
                  </td>
                  <td className="px-4 py-2.5">{r.sectionName ?? '—'}</td>
                  <td className="tabular px-4 py-2.5 text-end">{formatNumber(r.obtainedMarks)}/{formatNumber(r.totalMarks)}</td>
                  <td className="tabular px-4 py-2.5 text-end">{formatPercent(r.percentage, 2)}</td>
                  <td className="px-4 py-2.5 font-semibold"><bdi dir="ltr">{r.gradeLabel ?? '—'}</bdi>{r.gpa && <span className="ms-1 text-[12px] font-normal text-muted">({r.gpa})</span>}</td>
                  <td className="px-4 py-2.5"><Badge tone={stateTone[r.outcome] ?? 'neutral'}>{t(`exams.${r.outcome}`)}</Badge>{r.failedSubjects > 0 && <span className="ms-1 text-[12px] text-muted">{t('web.results.failedSubjects', { count: r.failedSubjects })}</span>}</td>
                  <td className="px-4 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
                    {p.state === 'published' && <LinkButton size="sm" variant="ghost" href={`/admin/results/${p.id}/report-card/${r.studentId}`} icon={<FileText size={14} />}>{t('exams.reportCard')}</LinkButton>}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-b border-line bg-sunken/40">
                    <td colSpan={7} className="px-6 py-3">
                      <table className="w-full max-w-3xl text-[13px]">
                        <tbody>
                          {r.subjects.map((s) => (
                            <tr key={s.courseOfferingId}>
                              <td className="py-1">{lang === 'ur' && s.subjectNameUr ? s.subjectNameUr : s.subjectName}</td>
                              <td className="tabular py-1 text-end">{formatNumber(s.obtainedMarks)}/{formatNumber(s.maxMarks)}</td>
                              <td className="tabular py-1 text-end">{formatPercent(s.percentage, 1)}</td>
                              <td className="py-1 ps-4 font-medium"><bdi dir="ltr">{s.gradeLabel ?? '—'}</bdi></td>
                              <td className="py-1"><Badge tone={s.outcome === 'pass' ? 'success' : s.outcome === 'exempt' ? 'neutral' : s.outcome === 'incomplete' ? 'warning' : 'danger'}>{t(`web.results.subjectOutcome.${s.outcome}`)}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-2 flex items-center gap-3 text-[13px]">
                        <span className="text-muted">{t('web.results.remarks')}:</span> <span>{r.remarks ?? '—'}</span>
                        {p.state === 'draft' && <Button size="sm" variant="ghost" onClick={() => setRemarks({ result: r, text: r.remarks ?? '' })}>{t('common.edit')}</Button>}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={publishOpen} onClose={() => setPublishOpen(false)} title={t('web.results.publishTitle')} footer={<Button variant="primary" loading={publish.isPending} onClick={() => publish.mutate(undefined)}>{t('common.publish')}</Button>}>
        <p className="mb-2">{t('web.results.publishQuestion', { count: p.results.length })}</p>
        <p className="text-[13px] text-muted">{t('web.results.publishHint')}</p>
        <InlineError error={publish.error} />
      </Dialog>
      <Dialog open={reviseOpen} onClose={() => setReviseOpen(false)} title={t('web.results.revise')} footer={<Button variant="primary" loading={revise.isPending} disabled={reason.trim().length < 3} onClick={() => revise.mutate(undefined)}>{t('web.results.startRevision')}</Button>}>
        <div className="grid gap-3">
          <p className="text-[13px] text-muted">{t('web.results.reviseHint')}</p>
          <TextField label={t('web.common.reason')} value={reason} onValue={setReason} required />
          <InlineError error={revise.error} />
        </div>
      </Dialog>
      <Dialog open={!!remarks} onClose={() => setRemarks(null)} title={remarks ? `${t('web.results.remarks')} · ${remarks.result.displayName}` : ''} footer={<Button variant="primary" loading={saveRemarks.isPending} onClick={() => saveRemarks.mutate(undefined)}>{t('common.save')}</Button>}>
        {remarks && (
          <div className="grid gap-3">
            <textarea className="min-h-24 w-full rounded-lg border border-line-strong px-3 py-2 text-sm" maxLength={500} value={remarks.text} aria-label={t('web.results.remarks')} onChange={(e) => setRemarks({ ...remarks, text: e.target.value })} />
            <InlineError error={saveRemarks.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}
