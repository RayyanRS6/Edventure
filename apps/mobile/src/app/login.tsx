import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api';
import { useLang } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { FadeInView, PressableScale } from '@/ui/animated';
import { InlineError } from '@/ui/screen';
import { Text } from '@/ui/text';
import { darkTheme, radius, spacing } from '@/ui/theme';

export default function Login() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();

  const [schoolCode, setSchoolCode] = useState('DEMO');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const field = (name: string) => (error instanceof ApiError ? error.fieldErrors?.[name]?.[0] : undefined);

  const submit = async () => {
    if (!schoolCode || !username || !password) return;
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

  const isSchoolVerified = schoolCode.trim().length >= 3;
  const schoolAbbrev = (schoolCode.trim() || 'SCH').slice(0, 3).toUpperCase();
  const canSubmit = Boolean(schoolCode.trim() && username.trim() && password);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Top Navbar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing[1] }]}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </PressableScale>

        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>E</Text>
          </View>
          <Text variant="title" weight="700" style={styles.brandText}>
            edventure
          </Text>
        </View>

        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark" size={13} color={darkTheme.lime} />
          <Text style={styles.secureBadgeText}>Secure</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Title & Subtitle */}
          <FadeInView delay={60} duration={320} offsetY={10} style={styles.headerTitles}>
            <Text variant="display" weight="700" style={styles.headerHeading}>
              Welcome Back
            </Text>
            <Text variant="body" style={styles.headerSubtitle}>
              Sign in with the credentials shared by your school administration.
            </Text>
          </FadeInView>

          {/* Verified School Badge Card */}
          <FadeInView delay={120} duration={340} offsetY={10}>
            <View style={styles.schoolCard}>
              <View style={styles.schoolAvatar}>
                <Text style={styles.schoolAvatarText}>{schoolAbbrev}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.schoolName}>
                  {schoolCode.toUpperCase() === 'DEMO' ? 'Beaconhouse Model School' : 'Connected Institution'}
                </Text>
                <Text style={styles.schoolLocation}>
                  {schoolCode.toUpperCase() === 'DEMO' ? 'Islamabad Campus · Active' : `${schoolCode.toUpperCase()} Gateway`}
                </Text>
              </View>
              <Pressable onPress={() => setSchoolCode('')} hitSlop={10}>
                <Text style={styles.changeLink}>Change</Text>
              </Pressable>
            </View>
          </FadeInView>

          {/* Form Bento Container */}
          <View style={styles.formContainer}>
            {/* Input 1: School Code */}
            <FadeInView delay={180} duration={340} style={styles.inputGroup}>
              <View
                style={[
                  styles.inputBox,
                  isSchoolVerified ? styles.inputBoxVerified : null,
                  field('schoolCode') ? styles.inputBoxError : null,
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={isSchoolVerified ? darkTheme.lime : '#7A778D'}
                />
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>{t('auth.schoolCode')}</Text>
                  <TextInput
                    value={schoolCode}
                    onChangeText={setSchoolCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="e.g. DEMO"
                    placeholderTextColor="#545266"
                    style={styles.textInput}
                  />
                </View>
                {isSchoolVerified && (
                  <Ionicons name="checkmark-circle" size={20} color={darkTheme.lime} />
                )}
              </View>
              {field('schoolCode') && (
                <Text variant="caption" tone="danger" style={styles.errorText}>
                  {field('schoolCode')}
                </Text>
              )}
            </FadeInView>

            {/* Input 2: Username */}
            <FadeInView delay={240} duration={340} style={styles.inputGroup}>
              <View style={[styles.inputBox, field('username') ? styles.inputBoxError : null]}>
                <Ionicons name="person-outline" size={20} color="#7A778D" />
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>{t('auth.username')}</Text>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="e.g. admin or t.ayesha"
                    placeholderTextColor="#545266"
                    style={styles.textInput}
                  />
                </View>
              </View>
              {field('username') && (
                <Text variant="caption" tone="danger" style={styles.errorText}>
                  {field('username')}
                </Text>
              )}
            </FadeInView>

            {/* Input 3: Password */}
            <FadeInView delay={300} duration={340} style={styles.inputGroup}>
              <View style={[styles.inputBox, field('password') ? styles.inputBoxError : null]}>
                <Ionicons name="lock-closed-outline" size={20} color="#7A778D" />
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="••••••••••••"
                    placeholderTextColor="#545266"
                    onSubmitEditing={submit}
                    returnKeyType="go"
                    style={styles.textInput}
                  />
                </View>
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#7A778D"
                  />
                </Pressable>
              </View>
              {field('password') && (
                <Text variant="caption" tone="danger" style={styles.errorText}>
                  {field('password')}
                </Text>
              )}
            </FadeInView>

            {/* Inline Generic Error */}
            <InlineError
              error={error && !field('schoolCode') && !field('username') && !field('password') ? error : null}
            />

            {/* Primary CTA Button with Spring Physics */}
            <FadeInView delay={360} duration={340}>
              <PressableScale
                disabled={!canSubmit || busy}
                onPress={submit}
                style={[
                  styles.signInButton,
                  !canSubmit ? styles.signInButtonDisabled : null,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#10121C" size="small" />
                ) : (
                  <Text style={[styles.signInButtonText, !canSubmit ? styles.signInButtonTextDisabled : null]}>
                    {t('auth.signIn')} →
                  </Text>
                )}
              </PressableScale>
            </FadeInView>

            {/* Password Help */}
            <View style={styles.helpRow}>
              <Text style={styles.helpMuted}>Forgot password? </Text>
              <Pressable>
                <Text style={styles.helpLink}>Contact office</Text>
              </Pressable>
            </View>

            {/* Encryption & Security Banner */}
            <View style={styles.securityBanner}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#A78BFA" />
              <Text style={styles.securityText}>
                Your account is protected with school-grade encryption.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F101A',
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#191826',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1C1B28',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 15,
    fontWeight: '800',
    color: darkTheme.lime,
  },
  brandText: {
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 255, 50, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 255, 50, 0.20)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  secureBadgeText: {
    color: darkTheme.lime,
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerTitles: {
    marginBottom: 20,
  },
  headerHeading: {
    fontSize: 30,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#8E8B9E',
    marginTop: 6,
  },
  schoolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161522',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 20,
  },
  schoolAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  schoolLocation: {
    fontSize: 12,
    color: '#8E8B9E',
    marginTop: 2,
  },
  changeLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161522',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  inputBoxVerified: {
    borderColor: 'rgba(212, 255, 50, 0.35)',
  },
  inputBoxError: {
    borderColor: '#EF4444',
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8B9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    paddingLeft: 4,
  },
  signInButton: {
    width: '100%',
    height: 54,
    backgroundColor: darkTheme.lime,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: darkTheme.lime,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginTop: 8,
  },
  signInButtonDisabled: {
    backgroundColor: '#232230',
    shadowOpacity: 0,
    elevation: 0,
  },
  signInButtonText: {
    color: '#10121C',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  signInButtonTextDisabled: {
    color: '#545266',
  },
  helpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  helpMuted: {
    fontSize: 13,
    color: '#8E8B9E',
  },
  helpLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.20)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 11,
    color: '#C4B5FD',
    lineHeight: 16,
  },
});
