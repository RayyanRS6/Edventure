import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import type { LeaveRequest, Page } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatDate, stateTone } from '@/lib/format';
import { useAction, useApi, useLang } from '@/lib/queries';
import { Badge, Button, Card, Divider, Row } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

/** The signed-in student's or teacher's own leave requests. */
export default function MyLeave() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const q = useApi<Page<LeaveRequest>>(['leave-requests', 'mine'], '/leave-requests', { mine: 'true', limit: 50 });
  const cancel = useAction((id: string) => api.post(`/leave-requests/${id}/cancel`), { invalidate: [['leave-requests']], success: t('mobile.leave.cancelled'), toastErrors: true });
  const confirmCancel = (r: LeaveRequest) =>
    Alert.alert(t('mobile.leave.cancelTitle'), t('mobile.leave.cancelQuestion'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('common.yes'), style: 'destructive', onPress: () => cancel.mutate(r.id) },
    ]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.leave') }} />
      <Button icon="add" title={t('leave.request')} onPress={() => router.push('/leave/new')} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data?.items.length ? (
        <EmptyState icon="airplane-outline" title={t('mobile.leave.none')} />
      ) : (
        <Card style={{ gap: 0 }}>
          {q.data.items.map((r, i) => (
            <View key={r.id} style={{ paddingVertical: spacing[3], gap: 4 }}>
              {i > 0 && <Divider />}
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight="600">{r.leaveTypeName}</Text>
                <Badge tone={stateTone[r.state] ?? 'neutral'} label={t(`leave.${r.state}`)} />
              </Row>
              <Text variant="small" tone="muted">
                {r.startDate === r.endDate ? formatDate(r.startDate, lang) : `${formatDate(r.startDate, lang)} – ${formatDate(r.endDate, lang)}`}
              </Text>
              <Text variant="small">{r.reason}</Text>
              {r.decisionNote ? (
                <Text variant="small" tone="soft">
                  {t('leave.decisionNote')}: {r.decisionNote}
                </Text>
              ) : null}
              {(r.state === 'pending' || r.state === 'approved') && <Button small variant="ghost" title={t('mobile.leave.cancelRequest')} onPress={() => confirmCancel(r)} style={{ alignSelf: 'flex-start' }} />}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
