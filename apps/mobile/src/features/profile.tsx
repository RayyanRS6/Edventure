import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import type { Experience, SessionSummary } from '@edventure/contracts';
import { api } from '@/lib/api';
import { appVersion } from '@/lib/config';
import { formatDateTime } from '@/lib/format';
import { applyLocale } from '@/lib/i18n';
import { useAction, useApi, useLang, useLocalized } from '@/lib/queries';
import { useMe, useSession } from '@/lib/session';
import { Button, Card, Divider, ListRow, Segmented, type IconName } from '@/ui/controls';
import { Screen, SectionTitle } from '@/ui/screen';
import { Text } from '@/ui/text';
import { colors, spacing } from '@/ui/theme';

/** Account screen shared by every experience; `children` adds role-specific links. */
export function ProfileScreen({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const lang = useLang();
  const localized = useLocalized();
  const router = useRouter();
  const me = useMe();
  const { experience, chooseExperience, signOut } = useSession();
  const sessions = useApi<{ items: SessionSummary[] }>(['sessions'], '/sessions');
  const revoke = useAction((id: string) => api.delete(`/sessions/${id}`), { invalidate: [['sessions']], success: t('mobile.profile.signedOutDevice'), toastErrors: true });

  const setLanguage = async (l: 'en' | 'ur') => {
    if (l === lang) return;
    await api.patch('/me/preferences', { locale: l }).catch(() => undefined);
    await applyLocale(l);
  };

  const confirmSignOut = () =>
    Alert.alert(t('common.signOut'), t('mobile.profile.signOutQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.signOut'), style: 'destructive', onPress: () => void signOut().then(() => router.replace('/login')) },
    ]);

  return (
    <Screen onRefresh={() => void sessions.refetch()} refreshing={sessions.isRefetching}>
      <Card style={{ backgroundColor: colors.brand.lilac, borderColor: colors.brand.lilac, paddingVertical: spacing[6] }}>
        <Text variant="title" weight="700">{localized(me.displayName, me.displayNameUr)}</Text>
        <Text tone="soft" latin>
          {me.username} · {me.school.code}
        </Text>
        <Text tone="soft">{localized(me.school.name, me.school.nameUr)}</Text>
      </Card>

      {children}

      <SectionTitle>{t('common.language')}</SectionTitle>
      <Card>
        <Segmented
          accessibilityLabel={t('common.language')}
          value={lang}
          onChange={(l) => void setLanguage(l)}
          options={[
            { value: 'en', label: t('common.english') },
            { value: 'ur', label: t('common.urdu') },
          ]}
        />
        <Text variant="caption" tone="muted">
          {t('mobile.profile.languageHint')}
        </Text>
      </Card>

      {me.experiences.length > 1 && (
        <>
          <SectionTitle>{t('mobile.profile.switchView')}</SectionTitle>
          <Card>
            <Segmented<Experience>
              accessibilityLabel={t('mobile.profile.switchView')}
              value={experience}
              onChange={(e) => void chooseExperience(e).then(() => router.replace('/'))}
              options={me.experiences.map((e) => ({ value: e, label: t(`mobile.experience.${e}`) }))}
            />
          </Card>
        </>
      )}

      <SectionTitle>{t('auth.sessions')}</SectionTitle>
      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        {(sessions.data?.items ?? []).map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <ListRow
              icon={s.client === 'web' ? 'desktop-outline' : 'phone-portrait-outline'}
              title={s.deviceName ?? (s.client === 'web' ? t('mobile.profile.browser') : t('mobile.profile.phone'))}
              subtitle={s.current ? t('auth.thisDevice') : t('mobile.profile.lastActive', { time: formatDateTime(s.lastSeenAt, lang) })}
              trailing={!s.current ? <Button small variant="ghost" title={t('auth.signOutDevice')} onPress={() => revoke.mutate(s.id)} /> : undefined}
            />
          </View>
        ))}
      </Card>

      <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
        <ListRow icon="key-outline" title={t('auth.changePassword')} onPress={() => router.push('/change-password')} />
      </Card>
      <Button title={t('common.signOut')} variant="secondary" icon="log-out-outline" onPress={confirmSignOut} />
      <Text variant="caption" tone="subtle" center>
        {t('common.version', { version: appVersion })}
      </Text>
    </Screen>
  );
}

/** A card of navigation rows. */
export function LinkCard({ links }: { links: Array<{ title: string; icon: IconName; href: string; subtitle?: string }> }) {
  const router = useRouter();
  return (
    <Card style={{ gap: 0, paddingVertical: spacing[1] }}>
      {links.map((l, i) => (
        <View key={l.href}>
          {i > 0 && <Divider />}
          <ListRow icon={l.icon} title={l.title} subtitle={l.subtitle} onPress={() => router.push(l.href as never)} />
        </View>
      ))}
    </Card>
  );
}
