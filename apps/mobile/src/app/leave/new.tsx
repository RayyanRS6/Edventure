import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { z } from '@edventure/contracts';
import type { leaveType } from '@edventure/contracts';
import { api, ApiError } from '@/lib/api';
import { addDays, formatDate, todayLocal } from '@/lib/format';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, Card, ChoiceField, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';

/** Short, one-step leave request. Dates are chosen from the next few weeks to avoid typing. */
export default function NewLeave() {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const { experience } = useSession();
  const types = useApi<{ items: z.infer<typeof leaveType>[] }>(['leave-types'], '/leave-types');
  const today = todayLocal();
  const dates = Array.from({ length: 60 }, (_, i) => addDays(today, i));
  const [f, setF] = useState({ leaveTypeId: '', startDate: today, endDate: today, reason: '' });
  const audience = experience === 'teacher' ? 'teacher' : 'student';
  const create = useAction(() => api.post('/leave-requests', f), { invalidate: [['leave-requests']], success: t('mobile.leave.sent'), onSuccess: () => router.back() });
  const field = (name: string) => (create.error instanceof ApiError ? create.error.fieldErrors?.[name]?.[0] : undefined);
  const dateOptions = (from: string) => dates.filter((d) => d >= from).map((d) => ({ value: d, label: formatDate(d, lang, { weekday: 'short', day: 'numeric', month: 'short' }) }));

  return (
    <Screen
      footer={<Button title={t('common.submit')} loading={create.isPending} disabled={!f.leaveTypeId || f.reason.trim().length < 3} onPress={() => create.mutate(undefined)} />}
    >
      <Stack.Screen options={{ title: t('leave.request') }} />
      <Card>
        <ChoiceField
          label={t('leave.type')}
          value={f.leaveTypeId}
          onChange={(v) => setF({ ...f, leaveTypeId: v })}
          placeholder={t('mobile.common.choose')}
          options={(types.data?.items ?? []).filter((x) => !x.archived && (x.audience === 'both' || x.audience === audience)).map((x) => ({ value: x.id, label: localized(x.name, x.nameUr) }))}
        />
        <ChoiceField label={t('leave.startDate')} value={f.startDate} onChange={(v) => setF({ ...f, startDate: v, endDate: f.endDate < v ? v : f.endDate })} options={dateOptions(today)} />
        <ChoiceField label={t('leave.endDate')} value={f.endDate} onChange={(v) => setF({ ...f, endDate: v })} options={dateOptions(f.startDate)} />
        <TextField label={t('leave.reason')} value={f.reason} onChangeText={(v) => setF({ ...f, reason: v })} multiline error={field('reason')} />
        <InlineError error={create.error && !field('reason') ? create.error : null} />
      </Card>
    </Screen>
  );
}
