import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { LeaveRequest, Page, ResultPublication, z } from '@edventure/contracts';
import type { leaveDecisionResult } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Row, Segmented, TextField } from '@/ui/controls';
import { EmptyState, ErrorState, InlineError, Loading, Screen, useToast } from '@/ui/screen';
import { Sheet } from '@/ui/sheet';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Tab = 'leave' | 'results';

export default function Approvals() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'results' ? 'results' : 'leave');
  return (
    <Screen>
      <Segmented<Tab>
        accessibilityLabel={t('nav.approvals')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'leave', label: t('nav.leave') },
          { value: 'results', label: t('nav.results') },
        ]}
      />
      {tab === 'leave' ? <LeaveApprovals /> : <ResultApprovals />}
    </Screen>
  );
}

function LeaveApprovals() {
  const { t } = useTranslation();
  const lang = useLang();
  const toast = useToast();
  const q = useApi<Page<LeaveRequest>>(['leave-requests', 'pending'], '/leave-requests', { state: 'pending', limit: 100 });
  const [open, setOpen] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');
  const decide = useAction(
    (decision: 'approve' | 'reject') => api.post<z.infer<typeof leaveDecisionResult>>(`/leave-requests/${open!.id}/decision`, { decision, note: note || null, version: open!.version }),
    {
      invalidate: [['leave-requests'], ['dashboard']],
      onSuccess: (r) => {
        setOpen(null);
        toast(r.request.state === 'approved' ? t('mobile.leave.approved', { count: r.excusedDaysCreated }) : t('mobile.leave.rejected'));
      },
    },
  );
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState icon="checkmark-done-outline" title={t('mobile.leave.nonePending')} />;
  return (
    <>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {items.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <ListRow
              title={r.subject.displayName}
              subtitle={`${r.leaveTypeName} · ${r.startDate === r.endDate ? formatDate(r.startDate, lang) : `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}`}`}
              trailing={<Badge label={t(`mobile.experience.${r.subject.kind}`)} />}
              onPress={() => {
                setNote('');
                setOpen(r);
              }}
            />
          </View>
        ))}
      </Card>
      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject.displayName ?? ''}
        footer={
          <Row>
            <Button variant="danger" title={t('leave.reject')} loading={decide.isPending && decide.variables === 'reject'} onPress={() => decide.mutate('reject')} style={{ flex: 1 }} />
            <Button title={t('leave.approve')} loading={decide.isPending && decide.variables === 'approve'} onPress={() => decide.mutate('approve')} style={{ flex: 1 }} />
          </Row>
        }
      >
        {open && (
          <>
            <Text weight="600">{open.leaveTypeName}</Text>
            <Text tone="muted">{`${formatDate(open.startDate, lang)} – ${formatDate(open.endDate, lang)}`}</Text>
            {open.subject.detail ? <Text variant="small" tone="muted">{open.subject.detail}</Text> : null}
            <Text>{open.reason}</Text>
            <Text variant="small" tone="muted">
              {t('mobile.leave.approveHint')}
            </Text>
            <TextField label={t('leave.decisionNote')} value={note} onChangeText={setNote} />
            <InlineError error={decide.error} />
          </>
        )}
      </Sheet>
    </>
  );
}

function ResultApprovals() {
  const { t } = useTranslation();
  const router = useRouter();
  const q = useApi<{ items: ResultPublication[] }>(['results', 'all'], '/results');
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const drafts = (q.data?.items ?? []).filter((p) => p.state === 'draft');
  if (!drafts.length) return <EmptyState icon="ribbon-outline" title={t('mobile.results.noDrafts')} hint={t('mobile.results.noDraftsHint')} />;
  return (
    <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
      {drafts.map((p, i) => (
        <View key={p.id}>
          {i > 0 && <Divider />}
          <ListRow
            title={`${p.examCycleName} · ${p.gradeName}`}
            subtitle={t('mobile.results.counts', p.counts)}
            trailing={p.blockers.length ? <Badge tone="danger" label={t('mobile.results.blocked')} /> : <Badge tone="info" label={t('mobile.results.ready')} />}
            onPress={() => router.push(`/result/${p.id}`)}
          />
        </View>
      ))}
    </Card>
  );
}
