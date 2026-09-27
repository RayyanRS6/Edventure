import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Card, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';

export default function ChangePassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reload, next } = useSession();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mismatch = confirm.length > 0 && confirm !== password;
  const field = (name: string) => (error instanceof ApiError ? error.fieldErrors?.[name]?.[0] : undefined);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: password });
      await reload();
      router.replace('/');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text variant="title">{t('auth.changePasswordTitle')}</Text>
        {next === 'change_password' && <Text tone="muted">{t('auth.changePasswordHint')}</Text>}
        <TextField label={t('auth.currentPassword')} value={current} onChangeText={setCurrent} secureTextEntry error={field('currentPassword')} autoComplete="current-password" />
        <TextField label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry hint={t('auth.passwordRules')} error={field('newPassword')} autoComplete="new-password" />
        <TextField label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry error={mismatch ? t('auth.passwordsDoNotMatch') : undefined} autoComplete="new-password" />
        <InlineError error={error && !field('currentPassword') && !field('newPassword') ? error : null} />
        <Button title={t('auth.changePassword')} loading={busy} disabled={!current || !password || mismatch || !confirm} onPress={submit} />
      </Card>
    </Screen>
  );
}
