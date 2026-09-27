import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { NotificationItem } from '@edventure/contracts';
import { pushText } from '@edventure/i18n';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { routeForLink } from '@/lib/links';
import { useAction, useLang } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button } from '@/ui/controls';
import { EmptyState, ErrorState, Loading, OfflineBanner } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, spacing } from '@/ui/theme';

type InboxPage = { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const { experience } = useSession();
  const q = useInfiniteQuery({
    queryKey: ['notifications', 'inbox'],
    queryFn: ({ pageParam }) => api.get<InboxPage>('/notifications', { query: { limit: 30, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const markRead = useAction((body: { ids?: string[]; all?: boolean }) => api.post('/notifications/read', body), { invalidate: [['notifications']] });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = q.data?.pages[0]?.unreadCount ?? 0;

  if (q.isLoading) return <Loading />;
  if (q.error && !items.length) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <OfflineBanner />
      <FlatList
        showsVerticalScrollIndicator={false}
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent[600]} />}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && void q.fetchNextPage()}
        ListHeaderComponent={
          unread > 0 ? (
            <View style={styles.header}>
              <Text variant="small" tone="muted">
                {t('mobile.notifications.unread', { count: unread })}
              </Text>
              <Button small variant="ghost" icon="checkmark-done" title={t('notifications.markAllRead')} onPress={() => markRead.mutate({ all: true })} />
            </View>
          ) : null
        }
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title={t('notifications.empty')} />}
        renderItem={({ item }) => {
          const text = pushText(lang, item.kind, item.data);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!item.readAt) markRead.mutate({ ids: [item.id] });
                if (experience) router.push(routeForLink(item.link, experience) as never);
              }}
              style={({ pressed }) => [styles.item, !item.readAt && styles.unread, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.dot, { backgroundColor: item.readAt ? 'transparent' : colors.accent[600] }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight={item.readAt ? '500' : '600'}>{text.title}</Text>
                <Text variant="small" tone="muted">
                  {text.body}
                </Text>
                <Text variant="caption" tone="subtle">
                  {formatDateTime(item.createdAt, lang)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  item: { flexDirection: 'row', gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.surface },
  unread: { backgroundColor: colors.accent[50] },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
});
