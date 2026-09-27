import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Announcement } from '@edventure/contracts';
import { api } from '@/lib/api';
import { openFile } from '@/lib/files';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Badge, Button, Card, ListRow, Row } from '@/ui/controls';
import { ErrorState, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';

export default function AnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const { experience } = useSession();
  const q = useApi<Announcement>(['announcement', id], `/announcements/${id}`);
  const publish = useAction(() => api.post(`/announcements/${id}/publish`), { invalidate: [['announcement', id], ['announcements']], success: t('mobile.announcements.published'), toastErrors: true });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const a = q.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: t('nav.announcements') }} />
      <Card>
        <Row style={{ flexWrap: 'wrap' }}>
          {a.category === 'emergency' && <Badge tone="danger" label={t('mobile.announcements.emergency')} />}
          {a.state !== 'published' && <Badge label={t(`mobile.status.${a.state}`)} />}
        </Row>
        <Text variant="title">{localized(a.title, a.titleUr)}</Text>
        <Text variant="small" tone="muted">
          {a.createdBy.displayName} · {formatDateTime(a.publishedAt ?? a.createdAt, lang)}
        </Text>
        <Text selectable>{localized(a.body, a.bodyUr)}</Text>
        {a.attachments.map((f) => (
          <ListRow key={f.id} icon="attach-outline" title={f.name} latinTitle onPress={() => void openFile(f.id, f.name)} />
        ))}
      </Card>
      {a.state === 'draft' && experience !== 'student' && <Button title={t('common.publish')} icon="send-outline" loading={publish.isPending} onPress={() => publish.mutate(undefined)} />}
    </Screen>
  );
}
