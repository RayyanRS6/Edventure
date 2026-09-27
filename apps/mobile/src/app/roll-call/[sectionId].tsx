import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import type { AttendanceStatus, RollCall } from '@edventure/contracts';
import { attendanceStatuses } from '@edventure/contracts';
import { attendanceTone } from '@edventure/design-tokens';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { formatDate, formatDateTime, todayLocal } from '@/lib/format';
import { offlineDrafts, rollCallDraftKey } from '@/lib/offline';
import { useCachedApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Button, Card, ChoiceField, Divider, Row, Segmented, TextField } from '@/ui/controls';
import { ErrorState, InlineError, LastSynced, Loading, Notice, Screen, useToast } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Mark = { status: AttendanceStatus | null; reasonCodeId: string | null; note: string };
/** Local draft, bound to the section, date, roster revision and roll-call version it was taken against. */
type Draft = { sectionId: string; date: string; rosterRevision: string; version: number | null; entries: Record<string, Mark>; idempotencyKey: string; savedAt: number };

export default function RollCallScreen() {
  const { sectionId, date: dateParam } = useLocalSearchParams<{ sectionId: string; date?: string }>();
  const date = dateParam ?? todayLocal();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const toast = useToast();
  const q = useCachedApi<RollCall>(`roster:${sectionId}:${date}`, `/attendance/sections/${sectionId}/${date}`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [reviewedRevision, setReviewedRevision] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = rollCallDraftKey(sectionId, date);

  // Restore a draft saved on this device, if any.
  useEffect(() => {
    void offlineDrafts.get<Draft>(key).then((d) => {
      if (d) setDraft(d.value);
      setLoadedDraft(true);
    });
  }, [key]);

  const rc = q.data;
  // Start a draft from the server record when there is no local one.
  useEffect(() => {
    if (!rc || !loadedDraft || draft) return;
    setDraft({
      sectionId,
      date,
      rosterRevision: rc.rosterRevision,
      version: rc.version,
      entries: Object.fromEntries(rc.entries.map((e) => [e.studentId, { status: e.status ?? (e.onLeave ? 'excused' : null), reasonCodeId: e.reasonCodeId, note: e.note ?? '' }])),
      idempotencyKey: newIdempotencyKey(),
      savedAt: Date.now(),
    });
  }, [rc, loadedDraft, draft, sectionId, date]);

  const persist = useCallback(
    (d: Draft) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void offlineDrafts.set(key, { ...d, savedAt: Date.now() }), 400);
    },
    [key],
  );

  const setMark = (studentId: string, patch: Partial<Mark>) => {
    setDraft((d) => {
      if (!d) return d;
      const current = d.entries[studentId] ?? { status: null, reasonCodeId: null, note: '' };
      const next = { ...d, entries: { ...d.entries, [studentId]: { ...current, ...patch } } };
      persist(next);
      return next;
    });
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, missing: 0 };
    for (const e of rc?.entries ?? []) {
      const s = draft?.entries[e.studentId]?.status;
      if (s) c[s]++;
      else c.missing++;
    }
    return c;
  }, [rc, draft]);

  if (q.isLoading || !loadedDraft) return <Loading />;
  if (q.error && !rc) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!rc || !draft) return <Loading />;

  // The class list changed since the draft began (new or removed students): review before submitting.
  const stale = !q.fromCache && draft.rosterRevision !== rc.rosterRevision && reviewedRevision !== rc.rosterRevision;
  const correcting = rc.state === 'submitted';
  const reasons = rc.reasonCodes;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.put(
        `/attendance/sections/${sectionId}/${date}`,
        {
          rosterRevision: rc.rosterRevision,
          version: rc.version,
          submit: true,
          correctionReason: rc.correctionRequiresReason ? reason : null,
          entries: rc.entries
            .map((e) => ({ studentId: e.studentId, mark: draft.entries[e.studentId] }))
            .filter((x) => x.mark?.status)
            .map(({ studentId, mark }) => ({ studentId, status: mark!.status!, reasonCodeId: mark!.reasonCodeId, note: mark!.note || null })),
        },
        { idempotencyKey: draft.idempotencyKey },
      );
      await offlineDrafts.remove(key);
      toast(t('attendance.submitted'));
      router.back();
    } catch (e) {
      // A newer roll call or class list on the server is never overwritten: reload and let the teacher review.
      if (e instanceof ApiError && e.status === 409) void q.refetch();
      setError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = () =>
    Alert.alert(correcting ? t('mobile.rollCall.saveCorrection') : t('attendance.submitRollCall'), t('attendance.summary', counts), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: correcting ? t('common.save') : t('common.submit'), onPress: () => void submit() },
    ]);

  const discard = () =>
    Alert.alert(t('mobile.rollCall.discardTitle'), t('mobile.rollCall.discardQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mobile.rollCall.discard'),
        style: 'destructive',
        onPress: () =>
          void offlineDrafts.remove(key).then(() => {
            setDraft(null);
            setReviewedRevision(null);
          }),
      },
    ]);

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        rc.canEdit && rc.instructional ? (
          <View style={{ gap: spacing[2] }}>
            <InlineError error={error} />
            <Button
              title={correcting ? t('mobile.rollCall.saveCorrection') : t('attendance.reviewAndSubmit')}
              loading={submitting}
              disabled={q.fromCache || stale || counts.missing > 0 || (rc.correctionRequiresReason && reason.trim().length < 3)}
              onPress={confirm}
            />
            {q.fromCache && (
              <Text variant="caption" tone="muted" center>
                {t('mobile.rollCall.connectToSubmit')}
              </Text>
            )}
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `${rc.gradeName} ${rc.sectionName}` }} />
      <View style={{ gap: 4 }}>
        <Text variant="heading">{formatDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge tone={rc.state === 'submitted' ? 'success' : rc.state === 'draft' ? 'warning' : 'neutral'} label={t(`mobile.status.${rc.state}`)} />
          {rc.submittedAt && (
            <Text variant="caption" tone="muted">
              {t('mobile.rollCall.submittedBy', { name: rc.submittedBy ?? '—', time: formatDateTime(rc.submittedAt, lang) })}
            </Text>
          )}
        </Row>
        <LastSynced at={q.fromCache ? q.savedAt : null} />
      </View>

      {!rc.instructional ? (
        <Notice text={t('mobile.schedule.noSchool')} />
      ) : (
        <>
          {!rc.canEdit && <Notice tone="warning" text={t('mobile.rollCall.readOnly')} />}
          {stale && (
            <Card>
              <Notice tone="warning" text={t('attendance.staleRoster')} />
              <Button small variant="secondary" title={t('mobile.rollCall.reviewed')} onPress={() => setReviewedRevision(rc.rosterRevision)} />
            </Card>
          )}
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <Text variant="small" tone="muted">
              {t('attendance.summary', counts)}
              {counts.missing ? ` · ${t('mobile.rollCall.unmarked', { count: counts.missing })}` : ''}
            </Text>
            {rc.canEdit && (
              <Button
                small
                variant="ghost"
                icon="checkmark-done"
                title={t('attendance.markAllPresent')}
                onPress={() => rc.entries.forEach((e) => !draft.entries[e.studentId]?.status && setMark(e.studentId, { status: 'present', reasonCodeId: null }))}
              />
            )}
          </Row>
          <Card style={{ gap: 0 }}>
            {rc.entries.map((e, i) => {
              const mark = draft.entries[e.studentId] ?? { status: null, reasonCodeId: null, note: '' };
              const isNew = !(e.studentId in draft.entries);
              const reasonOptions = reasons.filter((r) => !r.appliesTo || r.appliesTo === mark.status);
              return (
                <View key={e.studentId} style={{ paddingVertical: spacing[3], gap: spacing[2] }}>
                  {i > 0 && <Divider />}
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text weight="600">{localized(e.displayName, e.displayNameUr)}</Text>
                      <Text variant="caption" tone="muted" latin>
                        {e.admissionNumber}
                      </Text>
                    </View>
                    {isNew && <Badge tone="info" label={t('mobile.rollCall.new')} />}
                    {e.onLeave && <Badge tone="info" label={t('mobile.rollCall.onLeave')} />}
                    {e.suspended && <Badge tone="danger" label={t('mobile.rollCall.suspended')} />}
                  </Row>
                  <Segmented<AttendanceStatus>
                    accessibilityLabel={e.displayName}
                    disabled={!rc.canEdit}
                    value={mark.status}
                    onChange={(s) => setMark(e.studentId, { status: s, reasonCodeId: null })}
                    tones={attendanceTone}
                    options={attendanceStatuses.map((s) => ({ value: s, label: t(`attendance.${s}`) }))}
                  />
                  {rc.canEdit && mark.status && mark.status !== 'present' && reasonOptions.length > 0 && (
                    <ChoiceField
                      label={t('attendance.reason')}
                      value={mark.reasonCodeId ?? ''}
                      onChange={(v) => setMark(e.studentId, { reasonCodeId: v })}
                      placeholder={t('mobile.common.optional')}
                      options={reasonOptions.map((r) => ({ value: r.id, label: localized(r.label, r.labelUr) }))}
                    />
                  )}
                </View>
              );
            })}
          </Card>
          {rc.canEdit && rc.correctionRequiresReason && <TextField label={t('attendance.correctionReason')} value={reason} onChangeText={setReason} />}
          {rc.canEdit && (
            <View style={{ gap: spacing[1] }}>
              <Text variant="caption" tone="muted">
                {t('attendance.draftSaved')}
              </Text>
              <Button small variant="ghost" title={t('mobile.rollCall.discard')} onPress={discard} style={{ alignSelf: 'flex-start' }} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
