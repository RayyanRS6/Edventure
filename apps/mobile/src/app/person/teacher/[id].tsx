import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { TeacherDetail } from '@edventure/contracts';
import { AccountActions } from '@/features/account-actions';
import { api, ApiError } from '@/lib/api';
import { formatDate, stateTone } from '@/lib/format';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Row, TextField } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Screen } from '@/ui/screen';
import { Sheet } from '@/ui/sheet';
import { Text } from '@/ui/text';

/** Admin lookup of one teacher. Salary records stay on the website and are never stored on the phone. */
export default function TeacherProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const q = useApi<TeacherDetail>(['teacher', id], `/teachers/${id}`);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ phone: '', email: '', address: '' });
  const save = useAction(() => api.patch(`/teachers/${id}`, { version: q.data!.version, phone: f.phone || null, email: f.email || null, address: f.address || null }), {
    invalidate: [['teacher', id]],
    success: t('mobile.common.saved'),
    onSuccess: () => setEditing(false),
  });
  const field = (name: string) => (save.error instanceof ApiError ? save.error.fieldErrors?.[name]?.[0] : undefined);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const tr = q.data;
  const current = tr.assignments.filter((a) => !a.endDate);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: localized(tr.displayName, tr.displayNameUr) }} />
      <Card>
        <Text variant="title">{localized(tr.displayName, tr.displayNameUr)}</Text>
        <Text tone="muted" latin>
          {tr.employeeNumber} · {tr.username}
        </Text>
        {tr.jobTitle ? <Text tone="muted">{tr.jobTitle}</Text> : null}
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge tone={stateTone[tr.accountStatus] ?? (tr.accountStatus === 'active' ? 'success' : 'warning')} label={t(`mobile.status.${tr.accountStatus}`)} />
          {tr.isAdmin && <Badge tone="info" label={t('roles.school_admin')} />}
          {tr.classTeacherOf.map((c) => (
            <Badge key={c.sectionId} label={`${t('roles.classTeacher')} · ${c.sectionName}`} />
          ))}
        </Row>
        <AccountActions accountId={tr.accountId} status={tr.accountStatus} name={tr.displayName} onChanged={() => void q.refetch()} />
      </Card>
      <Card
        title={t('mobile.people.contact')}
        action={
          <Button
            small
            variant="ghost"
            icon="create-outline"
            title={t('common.edit')}
            onPress={() => {
              setF({ phone: tr.phone ?? '', email: tr.email ?? '', address: tr.address ?? '' });
              setEditing(true);
            }}
          />
        }
      >
        <ListRow icon="call-outline" title={tr.phone ?? '—'} latinTitle />
        <ListRow icon="mail-outline" title={tr.email ?? '—'} latinTitle />
        <ListRow icon="home-outline" title={tr.address ?? '—'} />
      </Card>
      <Card title={t('mobile.people.teaching')} style={{ gap: 0 }}>
        {current.length === 0 ? (
          <Text tone="muted">{t('mobile.people.noTeaching')}</Text>
        ) : (
          current.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider />}
              <ListRow title={a.teachingGroupName} subtitle={`${a.subjectName} · ${t('mobile.people.since', { date: formatDate(a.startDate, lang) })}`} />
            </View>
          ))
        )}
      </Card>
      <Sheet visible={editing} onClose={() => setEditing(false)} title={t('mobile.people.editContact')} footer={<Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate(undefined)} />}>
        <TextField label={t('mobile.people.phone')} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" error={field('phone')} />
        <TextField label={t('mobile.people.email')} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" error={field('email')} />
        <TextField label={t('mobile.people.address')} value={f.address} onChangeText={(v) => setF({ ...f, address: v })} multiline />
        <InlineError error={save.error && !field('phone') && !field('email') ? save.error : null} />
      </Sheet>
    </Screen>
  );
}
