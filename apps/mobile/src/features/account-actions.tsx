import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import type { IssuedCredential } from '@edventure/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/queries';
import { Button, Card, Row, TextField } from '@/ui/controls';
import { InlineError, Notice } from '@/ui/screen';
import { Sheet } from '@/ui/sheet';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

/** Individual account changes an administrator can make from the phone. */
export function AccountActions({ accountId, status, name, onChanged }: { accountId: string; status: string; name: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const [credential, setCredential] = useState<IssuedCredential | null>(null);
  const [mode, setMode] = useState<'suspend' | 'reactivate' | null>(null);
  const [reason, setReason] = useState('');
  const reset = useAction(() => api.post<IssuedCredential>(`/accounts/${accountId}/reset-password`), { onSuccess: setCredential, toastErrors: true });
  const change = useAction(() => api.post(`/accounts/${accountId}/${mode}`, { reason }), {
    success: t('mobile.common.saved'),
    onSuccess: () => {
      setMode(null);
      setReason('');
      onChanged();
    },
  });

  return (
    <>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button small variant="secondary" icon="key-outline" title={status === 'pending' ? t('mobile.people.setUpSignIn') : t('mobile.people.resetPassword')} loading={reset.isPending} onPress={() => reset.mutate(undefined)} />
        {status === 'active' && <Button small variant="ghost" icon="pause-circle-outline" title={t('mobile.people.suspend')} onPress={() => setMode('suspend')} />}
        {status === 'suspended' && <Button small variant="ghost" icon="play-circle-outline" title={t('mobile.people.reactivate')} onPress={() => setMode('reactivate')} />}
      </Row>

      <Sheet visible={!!credential} onClose={() => setCredential(null)} title={t('mobile.people.credentialsTitle')}>
        {credential && (
          <>
            <Notice tone="warning" text={t('mobile.people.credentialsOnce')} />
            <Card style={{ backgroundColor: colors.surfaceSunken }}>
              <Text weight="600">{credential.displayName}</Text>
              <Text variant="small" tone="muted">
                {t('auth.username')}
              </Text>
              <Text latin selectable weight="600">
                {credential.username}
              </Text>
              <Text variant="small" tone="muted">
                {t('auth.password')}
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing[3] }}>
                <Text latin selectable weight="700" style={{ letterSpacing: 1 }}>
                  {credential.temporaryPassword}
                </Text>
              </View>
            </Card>
            <Text variant="small" tone="muted">
              {t('mobile.people.changeOnFirstLogin')}
            </Text>
            <Button
              variant="secondary"
              icon="share-outline"
              title={t('mobile.people.share')}
              onPress={() => void Share.share({ message: `${credential.displayName}\n${t('auth.username')}: ${credential.username}\n${t('auth.password')}: ${credential.temporaryPassword}` })}
            />
          </>
        )}
      </Sheet>

      <Sheet
        visible={!!mode}
        onClose={() => setMode(null)}
        title={mode === 'suspend' ? t('mobile.people.suspendTitle', { name }) : t('mobile.people.reactivateTitle', { name })}
        footer={<Button variant={mode === 'suspend' ? 'danger' : 'primary'} title={mode === 'suspend' ? t('mobile.people.suspend') : t('mobile.people.reactivate')} loading={change.isPending} disabled={reason.trim().length < 3} onPress={() => change.mutate(undefined)} />}
      >
        {mode === 'suspend' && <Text tone="muted">{t('mobile.people.suspendHint')}</Text>}
        <TextField label={t('leave.reason')} value={reason} onChangeText={setReason} multiline />
        <InlineError error={change.error} />
      </Sheet>
    </>
  );
}
