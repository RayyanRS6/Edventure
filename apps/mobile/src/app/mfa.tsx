import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import type { SessionTokens } from '@edventure/contracts';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Card, TextField } from '@/ui/controls';
import { InlineError, Loading, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

/**
 * Two-step verification for administrators. Enrolment shows the setup key and an "open in
 * authenticator" link (a QR code cannot be scanned by the same phone).
 */
export default function Mfa() {
  const { t } = useTranslation();
  const router = useRouter();
  const { next, reload, storeTokens } = useSession();
  const [enroll, setEnroll] = useState<{ factorId: string; otpauthUri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (next === 'mfa_enroll') {
      api.post<{ factorId: string; otpauthUri: string; secret: string }>('/auth/mfa/enroll').then(setEnroll, setError);
    }
  }, [next]);

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ tokens?: SessionTokens }>('/auth/mfa/verify', { code, factorId: enroll?.factorId });
      await storeTokens(r.tokens);
      await reload();
      router.replace('/');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  if (next === 'mfa_enroll' && !enroll && !error) return <Loading />;
  return (
    <Screen>
      <Card>
        <Text variant="title">{t('auth.mfaTitle')}</Text>
        <Text tone="muted">{next === 'mfa_enroll' ? t('mobile.mfa.enrollHint') : t('auth.mfaVerifyHint')}</Text>
        {enroll && (
          <View style={{ gap: spacing[2] }}>
            <Button title={t('mobile.mfa.openAuthenticator')} variant="secondary" icon="key-outline" onPress={() => void Linking.openURL(enroll.otpauthUri).catch(() => undefined)} />
            <Text variant="small" tone="muted">
              {t('auth.secretKey')}
            </Text>
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing[3] }}>
              <Text latin selectable weight="600" style={{ letterSpacing: 1 }}>
                {enroll.secret.replace(/(.{4})/g, '$1 ').trim()}
              </Text>
            </View>
          </View>
        )}
        <TextField label={t('auth.mfaCode')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" />
        <InlineError error={error} />
        <Button title={t('auth.verify')} loading={busy} disabled={code.length !== 6} onPress={verify} />
      </Card>
    </Screen>
  );
}
