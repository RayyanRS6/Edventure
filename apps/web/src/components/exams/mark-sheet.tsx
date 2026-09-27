'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarkOutcome, z } from '@edventure/contracts';
import { markOutcomes, markSheet } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/field';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';

type Sheet = z.infer<typeof markSheet>;
type Entry = { outcome: MarkOutcome | ''; score: string; note: string };

/** Spreadsheet-like marks entry. Only changed rows are sent, each with its own version. */
export function MarkSheet({ paperId, sectionId }: { paperId: string; sectionId?: string }) {
  const { t } = useTranslation();
  const q = useApi<Sheet>(['marks', paperId, sectionId], `/exam-papers/${paperId}/marks`, sectionId ? { sectionId } : undefined);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (q.data) setEntries(Object.fromEntries(q.data.rows.map((r) => [r.registrationId, { outcome: r.outcome ?? '', score: r.score ?? '', note: r.note ?? '' }])));
  }, [q.data]);

  const changed = useMemo(() => {
    if (!q.data) return [];
    return q.data.rows.filter((r) => {
      const e = entries[r.registrationId];
      if (!e || !e.outcome) return false;
      return e.outcome !== (r.outcome ?? '') || e.score !== (r.score ?? '') || e.note !== (r.note ?? '');
    });
  }, [q.data, entries]);

  const max = Number(q.data?.paper.maxMarks ?? 0);
  const invalid = changed.some((r) => {
    const e = entries[r.registrationId]!;
    if (e.outcome !== 'score') return false;
    const n = Number(e.score);
    return e.score === '' || Number.isNaN(n) || n < 0 || n > max || !/^\d{1,5}(\.\d{1,2})?$/.test(e.score);
  });

  const save = useAction(
    () =>
      api.put<Sheet>(`/exam-papers/${paperId}/marks`, {
        reason: reason || null,
        entries: changed.map((r) => {
          const e = entries[r.registrationId]!;
          return { registrationId: r.registrationId, outcome: e.outcome, score: e.outcome === 'score' ? e.score : null, note: e.note || null, version: r.version };
        }),
      }),
    { invalidate: [['marks', paperId], ['exam-papers']], success: t('web.exams.marksSaved'), onSuccess: () => setReason('') },
  );

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const sheet = q.data;
  const set = (id: string, patch: Partial<Entry>) => setEntries((s) => ({ ...s, [id]: { ...s[id]!, ...patch } }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">
        {t('web.exams.sheetHint', { max: formatNumber(sheet.paper.maxMarks), pass: formatNumber(sheet.paper.passMarks) })}
        {!sheet.canEdit && <span className="ms-2 font-medium text-warning-fg">{t('web.exams.readOnly')}</span>}
      </p>
      <div className="max-h-[55vh] overflow-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-sunken">
            <tr>
              <th className="px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('web.common.student')}</th>
              <th className="px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('web.exams.outcome')}</th>
              <th className="px-3 py-2 text-end text-[12px] font-semibold uppercase tracking-wide text-muted">{t('exams.marks')}</th>
              <th className="px-3 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('web.common.note')}</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => {
              const e = entries[r.registrationId];
              if (!e) return null;
              const over = e.outcome === 'score' && e.score !== '' && Number(e.score) > max;
              return (
                <tr key={r.registrationId} className="border-t border-line">
                  <td className="px-3 py-1.5">
                    <p className="font-medium">{r.displayName}</p>
                    <p className="text-[12px] text-muted">{r.admissionNumber}{r.sectionName ? ` · ${r.sectionName}` : ''}</p>
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      compact
                      ariaLabel={t('web.exams.outcome')}
                      value={e.outcome}
                      onValue={(value) => set(r.registrationId, { outcome: value as MarkOutcome, score: value === 'score' ? e.score : '' })}
                      disabled={!sheet.canEdit}
                      placeholder="—"
                      options={markOutcomes.map((o) => ({ value: o, label: o === 'score' ? t('web.exams.scored') : t(`exams.${o}`) }))}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-end">
                    <input
                      inputMode="decimal"
                      dir="ltr"
                      className={`tabular h-8 w-20 rounded-lg border bg-surface px-2 text-end text-[13px] ${over ? 'border-danger-fg' : 'border-line-strong'}`}
                      value={e.score}
                      disabled={!sheet.canEdit}
                      aria-label={t('exams.marks')}
                      aria-invalid={over || undefined}
                      onChange={(ev) => set(r.registrationId, { score: ev.target.value.trim(), outcome: ev.target.value.trim() ? 'score' : e.outcome })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input className="h-8 w-full min-w-32 rounded-lg border border-line-strong bg-surface px-2 text-[13px]" value={e.note} disabled={!sheet.canEdit} aria-label={t('web.common.note')} onChange={(ev) => set(r.registrationId, { note: ev.target.value })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sheet.canEdit && (
        <>
          <TextField label={t('web.exams.changeReason')} value={reason} onValue={setReason} hint={t('web.exams.changeReasonHint')} />
          {invalid && <p className="text-[13px] text-danger-fg">{t('web.exams.invalidScores', { max: formatNumber(sheet.paper.maxMarks) })}</p>}
          <InlineError error={save.error} />
          <div className="flex items-center justify-end gap-3">
            <span className="text-[13px] text-muted">{t('web.exams.changedCount', { count: changed.length })}</span>
            <Button variant="primary" loading={save.isPending} disabled={!changed.length || invalid} onClick={() => save.mutate(undefined)}>{t('web.exams.saveMarks')}</Button>
          </div>
        </>
      )}
    </div>
  );
}
