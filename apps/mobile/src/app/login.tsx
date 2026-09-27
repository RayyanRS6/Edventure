import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api';
import { applyLocale } from '@/lib/i18n';
import { useLang } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, TextField } from '@/ui/controls';
import { InlineError, Screen } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

export default function Login() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [schoolCode, setSchoolCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const field = (name: string) => (error instanceof ApiError ? error.fieldErrors?.[name]?.[0] : undefined);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn({ schoolCode: schoolCode.trim(), username: username.trim(), password });
      router.replace('/');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ paddingTop: insets.top + spacing[4], gap: spacing[5] }}>
      <StatusBar style="light" />
      <View style={[styles.brand, { marginTop: -(insets.top + spacing[4]), minHeight: 62 + insets.top, paddingTop: insets.top }]}>
        <View style={styles.logo}>
          <Ionicons name="school" size={26} color={colors.brand.night} />
        </View>
        <View style={{ flex: 1 }}><Text variant="heading" weight="700" style={{ color: '#FFFFFF' }}>{t('app.name')}</Text></View>
        <Ionicons name="sparkles-outline" size={22} color={colors.brand.lime} />
      </View>
      <View style={styles.hero}>
        <View style={styles.orbit} />
        <View style={styles.heroContent}>
          <View style={styles.pill}><Text variant="caption" weight="700">{t('app.name')}</Text></View>
          <Text variant="display" weight="700" style={styles.heroTitle}>{t('app.tagline')}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text variant="title" weight="700">{t('auth.signIn')}</Text>
        <TextField label={t('auth.schoolCode')} value={schoolCode} onChangeText={setSchoolCode} autoCapitalize="characters" autoCorrect={false} error={field('schoolCode')} textContentType="organizationName" />
        <TextField label={t('auth.username')} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} error={field('username')} textContentType="username" autoComplete="username" />
        <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry error={field('password')} textContentType="password" autoComplete="password" onSubmitEditing={submit} returnKeyType="go" />
        <InlineError error={error && !field('schoolCode') && !field('username') && !field('password') ? error : null} />
        <Button title={busy ? t('auth.signingIn') : t('auth.signIn')} loading={busy} disabled={!schoolCode || !username || !password} onPress={submit} />
        <Text variant="small" tone="muted">
          {t('auth.noAccountHint')}
        </Text>
      </View>
      <Button
        variant="ghost"
        icon="language-outline"
        title={lang === 'ur' ? t('common.english') : t('common.urdu')}
        onPress={() => void applyLocale(lang === 'ur' ? 'en' : 'ur')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginHorizontal: -spacing[4], marginTop: -spacing[4], paddingHorizontal: spacing[4], backgroundColor: colors.brand.night },
  logo: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.brand.lime, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 188, borderRadius: radius.xl, backgroundColor: colors.brand.lilac, overflow: 'hidden', justifyContent: 'center', padding: spacing[5] },
  heroContent: { zIndex: 1, maxWidth: '85%', alignItems: 'flex-start', gap: spacing[4] },
  heroTitle: { fontSize: 29, lineHeight: 36, color: colors.ink },
  pill: { backgroundColor: colors.brand.lime, borderRadius: radius.pill, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  orbit: { position: 'absolute', width: 155, height: 155, right: -60, top: -40, borderRadius: 55, borderColor: colors.brand.lime, borderWidth: 20, transform: [{ rotate: '-25deg' }] },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], gap: spacing[4], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
