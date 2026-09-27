import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { FeeStatement, StudentDetail, z } from '@edventure/contracts';
import type { myResult, studentAttendanceReport } from '@edventure/contracts';
import { AccountActions } from '@/features/account-actions';
import { FeeStatementView } from '@/features/fee-statement';
import { api, ApiError } from '@/lib/api';
import { addDays, formatPercent, stateTone, todayLocal } from '@/lib/format';
import { useAction, useApi, useLocalized } from '@/lib/queries';
import { Badge, Button, Card, Divider, ListRow, Row, Segmented, Stat, TextField } from '@/ui/controls';
import { ErrorState, InlineError, Loading, Notice, Screen } from '@/ui/screen';
import { Sheet } from '@/ui/sheet';
import { Text } from '@/ui/text';
import { spacing } from '@/ui/theme';

type Tab = 'profile' | 'attendance' | 'results' | 'fees';

/** Admin lookup of one student: profile edits, account actions, attendance, results and fees. */
export default function StudentProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const localized = useLocalized();
  const [tab, setTab] = useState<Tab>('profile');
  const q = useApi<StudentDetail>(['student', id], `/students/${id}`);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const s = q.data;
  const e = s.enrollments.find((x) => x.status === 'active') ?? s.enrollment;

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen options={{ title: localized(s.displayName, s.displayNameUr) }} />
      <Card>
        <Text variant="title">{localized(s.displayName, s.displayNameUr)}</Text>
        <Text tone="muted" latin>
          {s.admissionNumber} · {s.username}
        </Text>
        {e && (
          <Text tone="muted">
            {e.gradeName}
            {e.sectionName ? ` ${e.sectionName}` : ''} · {e.academicYearCode}
          </Text>
        )}
        <Row style={{ flexWrap: 'wrap' }}>
          <Badge tone={stateTone[s.accountStatus] ?? (s.accountStatus === 'active' ? 'success' : 'warning')} label={t(`mobile.status.${s.accountStatus}`)} />
          {s.suspended && <Badge tone="danger" label={t('mobile.people.disciplinary')} />}
        </Row>
        <AccountActions accountId={s.accountId} status={s.accountStatus} name={s.displayName} onChanged={() => void q.refetch()} />
      </Card>
      <Segmented<Tab>
        accessibilityLabel={t('common.details')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: t('nav.profile') },
          { value: 'attendance', label: t('nav.attendance') },
          { value: 'results', label: t('nav.results') },
          { value: 'fees', label: t('nav.fees') },
        ]}
      />
      {tab === 'profile' && <ProfileTab s={s} onSaved={() => void q.refetch()} />}
      {tab === 'attendance' && <AttendanceTab studentId={s.id} />}
      {tab === 'results' && <ResultsTab studentId={s.id} />}
      {tab === 'fees' && <FeesTab studentId={s.id} />}
    </Screen>
  );
}

function ProfileTab({ s, onSaved }: { s: StudentDetail; onSaved: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '' });
  const save = useAction(() => api.patch(`/students/${s.id}`, { version: s.version, phone: f.phone || null, email: f.email || null, address: f.address || null }), {
    success: t('mobile.common.saved'),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });
  const field = (name: string) => (save.error instanceof ApiError ? save.error.fieldErrors?.[name]?.[0] : undefined);
  return (
    <>
      <Card title={t('mobile.people.contact')} action={<Button small variant="ghost" icon="create-outline" title={t('common.edit')} onPress={() => setEditing(true)} />}>
        <ListRow icon="call-outline" title={s.phone ?? '—'} latinTitle />
        <ListRow icon="mail-outline" title={s.email ?? '—'} latinTitle />
        <ListRow icon="home-outline" title={s.address ?? '—'} />
      </Card>
      {s.guardians.length > 0 && (
        <Card title={t('mobile.people.guardians')} style={{ gap: 0 }}>
          {s.guardians.map((g, i) => (
            <View key={g.id}>
              {i > 0 && <Divider />}
              <ListRow icon="person-outline" title={g.name} subtitle={[g.relationship, g.phone].filter(Boolean).join(' · ')} />
            </View>
          ))}
        </Card>
      )}
      {s.activeSuspension && <Notice tone="danger" text={t('mobile.people.suspendedUntil', { reason: s.activeSuspension.reason })} />}
      <Sheet visible={editing} onClose={() => setEditing(false)} title={t('mobile.people.editContact')} footer={<Button title={t('common.save')} loading={save.isPending} onPress={() => save.mutate(undefined)} />}>
        <TextField label={t('mobile.people.phone')} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" error={field('phone')} />
        <TextField label={t('mobile.people.email')} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" error={field('email')} />
        <TextField label={t('mobile.people.address')} value={f.address} onChangeText={(v) => setF({ ...f, address: v })} multiline />
        <InlineError error={save.error && !field('phone') && !field('email') ? save.error : null} />
      </Sheet>
    </>
  );
}

function AttendanceTab({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const to = todayLocal();
  const q = useApi<z.infer<typeof studentAttendanceReport>>(['attendance', studentId, '30'], `/attendance/students/${studentId}/report`, { from: addDays(to, -30), to });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const r = q.data.summary;
  return (
    <>
      <Row style={{ flexWrap: 'wrap', alignItems: 'stretch' }} gap={spacing[3]}>
        <Stat label={t('attendance.rate')} value={r.rate ? formatPercent(r.rate) : t('common.noData')} hint={t('mobile.attendance.days30')} />
        <Stat label={t('attendance.absent')} value={String(r.absent)} tone={r.absent ? 'danger' : undefined} />
      </Row>
      <Text variant="small" tone="muted">
        {t('attendance.summary', r)}
      </Text>
    </>
  );
}

function ResultsTab({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  const q = useApi<{ items: z.infer<typeof myResult>[] }>(['results', 'student', studentId], `/students/${studentId}/results`);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data?.items.length) return <Text tone="muted">{t('mobile.results.none')}</Text>;
  return (
    <Card style={{ gap: 0 }}>
      {q.data.items.map((r, i) => (
        <View key={r.publicationId}>
          {i > 0 && <Divider />}
          <ListRow
            title={localized(r.examCycleName, r.examCycleNameUr)}
            subtitle={[formatPercent(r.result.percentage, 2), r.result.gradeLabel].filter(Boolean).join(' · ')}
            trailing={<Badge tone={stateTone[r.result.outcome] ?? 'neutral'} label={t(`exams.${r.result.outcome}`)} />}
          />
        </View>
      ))}
    </Card>
  );
}

function FeesTab({ studentId }: { studentId: string }) {
  const { t } = useTranslation();
  const q = useApi<FeeStatement>(['fee-statement', studentId], `/students/${studentId}/fee-statement`);
  const remind = useAction(() => api.post<{ sent: number }>('/fees/reminders/send', { studentIds: [studentId] }), { success: t('mobile.fees.reminderSent'), toastErrors: true });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <>
      <FeeStatementView s={q.data} />
      {Number(q.data.totals.balance) > 0 && <Button variant="secondary" icon="notifications-outline" title={t('mobile.fees.sendReminder')} loading={remind.isPending} onPress={() => remind.mutate(undefined)} />}
    </>
  );
}
