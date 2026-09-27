import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { homeFor } from '@/lib/links';
import { useSession } from '@/lib/session';
import { EmptyState, Loading } from '@/ui/screen';
import { colors } from '@/ui/theme';

/** Sends each account to the right place: sign-in, required security steps, or its experience. */
export default function Index() {
  const { t } = useTranslation();
  const { status, next, experience } = useSession();
  if (status === 'loading') return <Loading />;
  if (status === 'signedOut') return <Redirect href="/login" />;
  if (next === 'change_password') return <Redirect href="/change-password" />;
  if (next === 'mfa_enroll' || next === 'mfa_verify') return <Redirect href="/mfa" />;
  if (!experience) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.canvas }}>
        <EmptyState icon="lock-closed-outline" title={t('errors.forbidden')} hint={t('auth.noAccountHint')} />
      </View>
    );
  }
  return <Redirect href={homeFor[experience] as never} />;
}
