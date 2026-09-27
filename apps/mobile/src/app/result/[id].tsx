import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import type { ResultPublication } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatPercent, stateTone } from '@/lib/format';
import { useAction, useApi } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Row, Segmented, Stat } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Notice, Screen, useToast } from '@/ui/screen';
import { spacing } from '@/ui/theme';

/** Review a calculated result publication and publish it (corrections start on the website). */
export default function ResultReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'fail' | 'incomplete'>('all');
  const q = useApi<ResultPublication>(['result', id], `/results/${id}`);
  const publish = useAction(() => api.post(`/results/${id}/publish`, { version: q.data!.version }), {
    invalidate: [['results'], ['result', id], ['dashboard']],
    onSuccess: () => {
      toast(t('mobile.results.published'));
      router.back();
    },
  });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data;
  const rows = p.results.filter((r) => filter === 'all' || r.outcome === filter);
  const confirm = () =>
    Alert.alert(t('mobile.results.publishTitle'), t('mobile.results.publishQuestion', { count: p.results.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.publish'), onPress: () => publish.mutate(undefined) },
    ]);

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      footer={
        p.state === 'draft' ? (
          <View style={{ gap: spacing[2] }}>
            <InlineError error={publish.error} />
            <Button title={t('common.publish')} icon="send-outline" disabled={p.blockers.length > 0} loading={publish.isPending} onPress={confirm} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `${p.examCycleName} · ${p.gradeName}` }} />
      {p.blockers.map((b) => (
        <Notice key={b} tone="danger" text={b} />
      ))}
      {p.state === 'draft' && !p.blockers.length && <Notice text={t('mobile.results.publishHint')} />}
      <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={spacing[3]}>
        <Stat label={t('exams.pass')} value={String(p.counts.pass)} />
        <Stat label={t('exams.fail')} value={String(p.counts.fail)} tone={p.counts.fail ? 'danger' : undefined} />
        <Stat label={t('exams.incomplete')} value={String(p.counts.incomplete)} />
      </Row>
      <Segmented
        accessibilityLabel={t('mobile.results.filter')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('common.all') },
          { value: 'fail', label: t('exams.fail') },
          { value: 'incomplete', label: t('exams.incomplete') },
        ]}
      />
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {rows.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <ListRow
              title={r.displayName}
              subtitle={[r.admissionNumber, r.sectionName, formatPercent(r.percentage, 2), r.gradeLabel].filter(Boolean).join(' · ')}
              trailing={<Badge tone={stateTone[r.outcome] ?? 'neutral'} label={t(`exams.${r.outcome}`)} />}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
