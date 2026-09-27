import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { FeeStatement } from '@edventure/contracts';
import { FeeStatementView } from '@/features/fee-statement';
import { useApi } from '@/lib/queries';
import { ErrorState, Loading, Screen } from '@/ui/screen';

/** The student's own statement. Amounts are shown only inside the app, never in notifications. */
export default function Fees() {
  const { t } = useTranslation();
  const q = useApi<FeeStatement>(['fees', 'me'], '/fees/me');
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('fees.statement') }} />
      {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <FeeStatementView s={q.data} />}
    </Screen>
  );
}
