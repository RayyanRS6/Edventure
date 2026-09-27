import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import type { z } from '@edventure/contracts';
import type { reminderCandidate } from '@edventure/contracts';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAction, useLang } from '@/lib/queries';
import { Button, Card, Divider, Segmented } from '@/ui/controls';
import { EmptyState, InlineError, Notice, Screen, useToast } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, spacing } from '@/ui/theme';

type Candidate = z.infer<typeof reminderCandidate>;

/** Preview who would receive a fee reminder, then send. Notifications never show amounts. */
export default function FeeReminders() {
  const { t } = useTranslation();
  const lang = useLang();
  const toast = useToast();
  const [overdueOnly, setOverdueOnly] = useState<'overdue' | 'all'>('overdue');
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const preview = useAction(() => api.post<{ items: Candidate[] }>('/fees/reminders/preview', { overdueOnly: overdueOnly === 'overdue' }), {
    onSuccess: (r) => {
      setCandidates(r.items);
      setSelected(new Set(r.items.map((c) => c.studentId)));
    },
  });
  const send = useAction(() => api.post<{ sent: number }>('/fees/reminders/send', { studentIds: [...selected] }), {
    onSuccess: (r) => {
      toast(t('mobile.fees.remindersSent', { count: r.sent }));
      setCandidates(null);
    },
  });
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Screen
      footer={
        candidates?.length ? (
          <Button title={t('mobile.fees.sendTo', { count: selected.size })} icon="send-outline" disabled={!selected.size} loading={send.isPending} onPress={() => send.mutate(undefined)} />
        ) : (
          <Button title={t('mobile.fees.preview')} loading={preview.isPending} onPress={() => preview.mutate(undefined)} />
        )
      }
    >
      <Stack.Screen options={{ title: t('mobile.admin.feeReminders') }} />
      <Notice text={t('mobile.fees.remindersHint')} />
      <Segmented
        accessibilityLabel={t('mobile.fees.who')}
        value={overdueOnly}
        onChange={(v) => {
          setOverdueOnly(v);
          setCandidates(null);
        }}
        options={[
          { value: 'overdue', label: t('fees.overdue') },
          { value: 'all', label: t('mobile.fees.anyBalance') },
        ]}
      />
      <InlineError error={preview.error ?? send.error} />
      {candidates && candidates.length === 0 && <EmptyState icon="checkmark-circle-outline" title={t('mobile.fees.noCandidates')} />}
      {candidates && candidates.length > 0 && (
        <Card style={{ gap: 0 }}>
          {candidates.map((c, i) => {
            const on = selected.has(c.studentId);
            return (
              <View key={c.studentId}>
                {i > 0 && <Divider />}
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(c.studentId)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] }}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.accent[600] : colors.subtle} />
                  <View style={{ flex: 1 }}>
                    <Text weight="600">{c.displayName}</Text>
                    <Text variant="small" tone="muted">
                      {c.admissionNumber} · {t('fees.balance')} {formatMoney(c.balance)}
                      {c.oldestDueDate ? ` · ${formatDate(c.oldestDueDate, lang)}` : ''}
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
