'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus, RollCall } from '@edventure/contracts';
import { attendanceStatuses } from '@edventure/contracts';
import { Button } from '@/components/ui/button';
import { Select, TextField } from '@/components/ui/field';
import { Badge } from '@/components/ui/layout';
import { ErrorState, InlineError, LoadingBlock } from '@/components/ui/states';
import { api, newIdempotencyKey } from '@/lib/api';
import { formatDateTime, stateTone } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/hooks';

type Row = { status: AttendanceStatus | null; reasonCodeId: string | null; note: string };

const statusStyle: Record<AttendanceStatus, string> = {
  present: 'border-success-fg bg-success-bg text-success-fg',
  absent: 'border-danger-fg bg-danger-bg text-danger-fg',
  late: 'border-warning-fg bg-warning-bg text-warning-fg',
  excused: 'border-info-fg bg-info-bg text-info-fg',
};

/**
 * Admin view of one section's roll call for a date. Administrators can take a missing roll call or
 * correct a submitted one; corrections after the teacher window require a reason and are audited.
 */
export function RollCallEditor({ sectionId, date, onSaved }: { sectionId: string; date: string; onSaved?: () => void }) {
  const { t } = useTranslation();
  const lang = useLang();
  const q = useApi<RollCall>(['roll-call', sectionId, date], `/attendance/sections/${sectionId}/${date}`);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [reason, setReason] = useState('');
  const [idem, setIdem] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!q.data) return;
    setRows(Object.fromEntries(q.data.entries.map((e) => [e.studentId, { status: e.status ?? (e.onLeave ? 'excused' : null), reasonCodeId: e.reasonCodeId, note: e.note ?? '' }])));
    setReason('');
  }, [q.data]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, missing: 0 };
    for (const r of Object.values(rows)) r.status ? c[r.status]++ : c.missing++;
    return c;
  }, [rows]);

  const save = useAction(
    (submit: boolean) =>
      api.put<RollCall>(
        `/attendance/sections/${sectionId}/${date}`,
        {
          rosterRevision: q.data!.rosterRevision,
          version: q.data!.version,
          submit,
          correctionReason: q.data!.correctionRequiresReason ? reason : null,
          entries: Object.entries(rows)
            .filter(([, r]) => r.status)
            .map(([studentId, r]) => ({ studentId, status: r.status!, reasonCodeId: r.reasonCodeId, note: r.note || null })),
        },
        { idempotencyKey: idem },
      ),
    {
      invalidate: [['roll-call', sectionId, date], ['attendance-overview']],
      success: t('web.common.updated'),
      onSuccess: () => {
        setIdem(newIdempotencyKey());
        onSaved?.();
      },
    },
  );

  if (q.isLoading) return <LoadingBlock />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rc = q.data;
  const set = (studentId: string, patch: Partial<Row>) => setRows((s) => ({ ...s, [studentId]: { ...s[studentId]!, ...patch } }));

  if (!rc.instructional) return <p className="rounded-lg bg-sunken px-4 py-6 text-center text-muted">{t('web.attendance.notInstructional')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Badge tone={stateTone[rc.state] ?? 'neutral'}>{t(`web.status.${rc.state}`)}</Badge>
          {rc.submittedAt && <span className="text-muted">{t('web.attendance.submittedBy', { name: rc.submittedBy ?? '—', time: formatDateTime(rc.submittedAt, lang) })}</span>}
        </div>
        <p className="tabular text-[13px] text-muted">{t('attendance.summary', counts)}{counts.missing ? ` · ${t('web.attendance.unmarked', { count: counts.missing })}` : ''}</p>
      </div>
      {rc.canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setRows((s) => Object.fromEntries(Object.entries(s).map(([k, r]) => [k, r.status ? r : { ...r, status: 'present' }])))}>{t('web.attendance.fillPresent')}</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken/60">
              <th className="px-4 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('web.common.student')}</th>
              <th className="px-4 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('common.status')}</th>
              <th className="px-4 py-2 text-start text-[12px] font-semibold uppercase tracking-wide text-muted">{t('attendance.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {rc.entries.map((e) => {
              const r = rows[e.studentId];
              if (!r) return null;
              const reasons = rc.reasonCodes.filter((c) => !c.appliesTo || c.appliesTo === r.status);
              return (
                <tr key={e.studentId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{lang === 'ur' && e.displayNameUr ? e.displayNameUr : e.displayName}</p>
                    <p className="text-[12px] text-muted">
                      {e.admissionNumber}
                      {e.onLeave && <span className="ms-2 text-info-fg">{t('web.attendance.onLeave')}</span>}
                      {e.suspended && <span className="ms-2 text-danger-fg">{t('web.attendance.suspended')}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div role="radiogroup" aria-label={e.displayName} className="flex flex-wrap gap-1">
                      {attendanceStatuses.map((s) => (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={r.status === s}
                          disabled={!rc.canEdit}
                          onClick={() => set(e.studentId, { status: s, reasonCodeId: null })}
                          className={clsx('h-8 rounded-lg border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-default', r.status === s ? statusStyle[s] : 'border-line text-muted hover:bg-sunken')}
                        >
                          {t(`attendance.${s}`)}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status && r.status !== 'present' && reasons.length > 0 ? (
                      <Select
                        compact
                        ariaLabel={t('attendance.reason')}
                        value={r.reasonCodeId ?? ''}
                        onValue={(value) => set(e.studentId, { reasonCodeId: value || null })}
                        disabled={!rc.canEdit}
                        placeholder="—"
                        options={reasons.map((c) => ({ value: c.id, label: lang === 'ur' && c.labelUr ? c.labelUr : c.label }))}
                      />
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rc.canEdit && (
        <div className="flex flex-col gap-3">
          {rc.correctionRequiresReason && <TextField label={t('attendance.correctionReason')} value={reason} onValue={setReason} hint={t('web.attendance.correctionHint')} required />}
          <InlineError error={save.error} />
          <div className="flex flex-wrap justify-end gap-2">
            {rc.state !== 'submitted' && <Button loading={save.isPending && save.variables === false} onClick={() => save.mutate(false)}>{t('web.attendance.saveDraft')}</Button>}
            <Button variant="primary" loading={save.isPending && save.variables === true} disabled={counts.missing > 0 || (rc.correctionRequiresReason && reason.trim().length < 3)} onClick={() => save.mutate(true)}>
              {rc.state === 'submitted' ? t('web.attendance.saveCorrection') : t('attendance.submitRollCall')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
