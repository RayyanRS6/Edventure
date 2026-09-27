import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { MarkOutcome, z } from '@edventure/contracts';
import { markOutcomes, type markSheet } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useAction, useApi } from '@/lib/queries';
import { Button, Card, ChoiceField, Divider, Row, TextField } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Notice, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Sheet = z.infer<typeof markSheet>;
type Entry = { outcome: MarkOutcome | ''; score: string };

/** Marks entry for the students this teacher teaches. Only changed rows are sent, each with its version. */
export default function MarksScreen() {
  const { paperId } = useLocalSearchParams<{ paperId: string }>();
  const { t } = useTranslation();
  const q = useApi<Sheet>(['marks', paperId], `/exam-papers/${paperId}/marks`);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  useEffect(() => {
    if (q.data) setEntries(Object.fromEntries(q.data.rows.map((r) => [r.registrationId, { outcome: r.outcome ?? '', score: r.score ? formatNumber(r.score) : '' }])));
  }, [q.data]);
  const max = Number(q.data?.paper.maxMarks ?? 0);
  const changed = useMemo(
    () =>
      (q.data?.rows ?? []).filter((r) => {
        const e = entries[r.registrationId];
        if (!e?.outcome) return false;
        return e.outcome !== (r.outcome ?? '') || (e.outcome === 'score' && Number(e.score) !== Number(r.score ?? NaN));
      }),
    [q.data, entries],
  );
  const invalid = changed.some((r) => {
    const e = entries[r.registrationId]!;
    return e.outcome === 'score' && (e.score === '' || !/^\d{1,5}(\.\d{1,2})?$/.test(e.score) || Number(e.score) > max);
  });
  const save = useAction(
    () =>
      api.put(`/exam-papers/${paperId}/marks`, {
        entries: changed.map((r) => {
          const e = entries[r.registrationId]!;
          return { registrationId: r.registrationId, outcome: e.outcome, score: e.outcome === 'score' ? e.score : null, version: r.version };
        }),
      }),
    { invalidate: [['marks', paperId], ['exam-papers']], success: t('mobile.marks.saved') },
  );

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const sheet = q.data;
  const set = (id: string, patch: Partial<Entry>) => setEntries((s) => ({ ...s, [id]: { ...s[id]!, ...patch } }));

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        sheet.canEdit ? (
          <View style={{ gap: spacing[2] }}>
            {invalid && <Text variant="small" tone="danger">{t('mobile.marks.invalid', { max: formatNumber(sheet.paper.maxMarks) })}</Text>}
            <InlineError error={save.error} />
            <Button title={t('mobile.marks.save', { count: changed.length })} loading={save.isPending} disabled={!changed.length || invalid} onPress={() => save.mutate(undefined)} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `${sheet.paper.subjectName} · ${sheet.paper.gradeName}` }} />
      <Text variant="small" tone="muted">
        {t('mobile.marks.hint', { max: formatNumber(sheet.paper.maxMarks), pass: formatNumber(sheet.paper.passMarks) })}
      </Text>
      {!sheet.canEdit && <Notice tone="warning" text={t('mobile.marks.readOnly')} />}
      <Card style={{ gap: 0 }}>
        {sheet.rows.map((r, i) => {
          const e = entries[r.registrationId] ?? { outcome: '', score: '' };
          return (
            <View key={r.registrationId} style={{ paddingVertical: spacing[3], gap: spacing[2] }}>
              {i > 0 && <Divider />}
              <Text weight="600">{r.displayName}</Text>
              <Text variant="caption" tone="muted" latin>
                {r.admissionNumber}
                {r.sectionName ? ` · ${r.sectionName}` : ''}
              </Text>
              <Row gap={spacing[2]} style={{ alignItems: 'flex-end' }}>
                <View style={{ width: 110 }}>
                  <TextField
                    label={t('exams.marks')}
                    value={e.score}
                    editable={sheet.canEdit}
                    keyboardType="decimal-pad"
                    onChangeText={(v) => set(r.registrationId, { score: v.trim(), outcome: v.trim() ? 'score' : e.outcome === 'score' ? '' : e.outcome })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ChoiceField<MarkOutcome>
                    label={t('mobile.marks.outcome')}
                    value={e.outcome}
                    onChange={(v) => set(r.registrationId, { outcome: v, score: v === 'score' ? e.score : '' })}
                    options={markOutcomes.map((o) => ({ value: o, label: o === 'score' ? t('exams.marks') : t(`exams.${o}`) }))}
                  />
                </View>
              </Row>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
