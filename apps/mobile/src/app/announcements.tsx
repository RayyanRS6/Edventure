import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';
import type { Announcement, Page } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useLang, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Badge, Button, Divider, ListRow } from '@/ui/controls';
import { EmptyState, ErrorState, Loading } from '@/ui/screen';
import { colors, spacing } from '@/ui/theme';

export default function AnnouncementsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const { experience } = useSession();
  const q = useInfiniteQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: ({ pageParam }) => api.get<Page<Announcement>>('/announcements', { query: { limit: 30, cursor: pageParam, state: experience === 'admin' ? undefined : 'published' } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isLoading) return <Loading />;
  if (q.error && !items.length) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ title: t('nav.announcements') }} />
      <FlatList
        showsVerticalScrollIndicator={false}
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing[4], gap: 0 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent[600]} />}
        onEndReached={() => q.hasNextPage && void q.fetchNextPage()}
        ListHeaderComponent={experience !== 'student' ? <Button icon="create-outline" title={t('mobile.announcements.new')} onPress={() => router.push('/announcement/new')} style={{ marginBottom: spacing[3] }} /> : null}
        ItemSeparatorComponent={Divider}
        ListEmptyComponent={<EmptyState icon="megaphone-outline" title={t('mobile.announcements.none')} />}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing[3] }}>
            <ListRow
              icon={item.category === 'emergency' ? 'warning-outline' : 'megaphone-outline'}
              title={localized(item.title, item.titleUr)}
              subtitle={`${item.createdBy.displayName} · ${formatDateTime(item.publishedAt ?? item.createdAt, lang)}`}
              trailing={item.state !== 'published' ? <Badge label={t(`mobile.status.${item.state}`)} /> : item.category === 'emergency' ? <Badge tone="danger" label={t('mobile.announcements.emergency')} /> : undefined}
              onPress={() => router.push(`/announcement/${item.id}`)}
            />
          </View>
        )}
      />
    </View>
  );
}
