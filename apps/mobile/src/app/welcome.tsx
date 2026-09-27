import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { applyLocale } from '@/lib/i18n';
import { useLang } from '@/lib/queries';
import { FadeInView, FloatingView, PressableScale } from '@/ui/animated';
import { Text } from '@/ui/text';
import { darkTheme, radius } from '@/ui/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function Welcome() {
  const { t } = useTranslation();
  const lang = useLang();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      <StatusBar style="light" />

      {/* Top Header Navbar */}
      <FadeInView delay={30} duration={260} style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>E</Text>
          </View>
          <Text style={styles.brandName}>edventure</Text>
        </View>

        <PressableScale
          onPress={() => void applyLocale(lang === 'ur' ? 'en' : 'ur')}
          style={styles.langPill}
        >
          <Text style={styles.langText}>
            {lang === 'ur' ? 'English' : 'English | اردو'}
          </Text>
        </PressableScale>
      </FadeInView>

      {/* Hero Stage with Independent 3D Floating Avatars */}
      <View style={styles.heroStage}>
        {/* Ambient Aurora Glow Lights behind avatars */}
        <View pointerEvents="none" style={styles.auroraGlowWrap}>
          <View style={styles.glowViolet} />
          <View style={styles.glowLime} />
        </View>

        {/* 3D Character Bubbles Cluster with Independent Physics */}
        <View style={styles.bubbleCluster}>
          {/* Avatar 1: Boy in Mint Bubble (Top Left - Independent Drift) */}
          <FloatingView distance={6} duration={3200} style={[styles.avatarWrap, styles.boyAvatarWrap]}>
            <View style={styles.boyBubbleGlow}>
              <Image
                source={require('../../assets/gemini_3d_boy.png')}
                style={styles.avatarImageSmall}
                resizeMode="cover"
              />
            </View>
          </FloatingView>

          {/* Avatar 2: Girl in Lavender Bubble (Top Right - Independent Drift) */}
          <FloatingView distance={7} duration={3800} style={[styles.avatarWrap, styles.girlAvatarWrap]}>
            <View style={styles.girlBubbleGlow}>
              <Image
                source={require('../../assets/gemini_3d_girl.png')}
                style={styles.avatarImageSmall}
                resizeMode="cover"
              />
            </View>
          </FloatingView>

          {/* Avatar 3: Teacher in Warm Apricot Bubble (Center Foreground - Independent Drift) */}
          <FloatingView distance={5} duration={2600} style={[styles.avatarWrap, styles.teacherAvatarWrap]}>
            <View style={styles.teacherBubbleGlow}>
              <Image
                source={require('../../assets/gemini_3d_teacher.png')}
                style={styles.avatarImageLarge}
                resizeMode="cover"
              />
            </View>
          </FloatingView>

          {/* Floating Atmospheric Sparkle Orbs */}
          <FloatingView distance={8} duration={2400}>
            <View style={[styles.orb, styles.orbTopLeft]} />
          </FloatingView>
          <FloatingView distance={6} duration={3000}>
            <View style={[styles.orb, styles.orbTopRight]} />
          </FloatingView>
          <FloatingView distance={5} duration={3400}>
            <View style={[styles.orb, styles.orbBottomLeft]} />
          </FloatingView>
          <FloatingView distance={7} duration={2800}>
            <View style={[styles.orb, styles.orbBottomRight]} />
          </FloatingView>
        </View>

        {/* Headline Typography matching 01_welcome.jpg */}
        <FadeInView delay={180} duration={380} offsetY={12} style={styles.headlineArea}>
          <Text style={styles.titleLine1}>School life,</Text>
          <Text style={styles.titleLine2}>in perfect sync.</Text>
        </FadeInView>

        {/* Frosted Role Chips Row */}
        <FadeInView delay={260} duration={340} offsetY={10} style={styles.rolesRow}>
          <View style={styles.roleChip}>
            <Text style={styles.roleEmoji}>🎒</Text>
            <Text style={styles.roleLabel}>Student</Text>
          </View>
          <View style={styles.roleChip}>
            <Text style={styles.roleEmoji}>👩‍🏫</Text>
            <Text style={styles.roleLabel}>Teacher</Text>
          </View>
          <View style={styles.roleChip}>
            <Text style={styles.roleEmoji}>⚡</Text>
            <Text style={styles.roleLabel}>Admin</Text>
          </View>
        </FadeInView>
      </View>

      {/* Flexible Space */}
      <View style={styles.flexSpacer} />

      {/* Bottom Action Card matching 01_welcome.jpg */}
      <FadeInView
        delay={340}
        duration={320}
        style={[styles.bottomContainer, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}
      >
        <View style={styles.bottomCard}>
          <PressableScale
            onPress={() => router.push('/login')}
            style={styles.neonActionButton}
          >
            <Text style={styles.neonButtonText}>
              Sign In to Your School →
            </Text>
          </PressableScale>

          <View style={styles.securityRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#68657B" />
            <Text style={styles.securityCaption}>
              Private by design · Live campus sync
            </Text>
          </View>
        </View>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E0E16',
    justifyContent: 'space-between',
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#1A1926',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 17,
    fontWeight: '800',
    color: darkTheme.lime,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  langPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#181724',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  langText: {
    color: '#A29FB5',
    fontSize: 12,
    fontWeight: '500',
  },
  heroStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    position: 'relative',
  },
  auroraGlowWrap: {
    position: 'absolute',
    top: -20,
    width: SCREEN_WIDTH,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowViolet: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 200,
    height: 180,
    borderRadius: 100,
    backgroundColor: 'rgba(124, 58, 237, 0.22)',
    transform: [{ scaleX: 1.4 }],
  },
  glowLime: {
    position: 'absolute',
    top: 30,
    right: 30,
    width: 170,
    height: 160,
    borderRadius: 85,
    backgroundColor: 'rgba(212, 255, 50, 0.15)',
    transform: [{ scaleY: 1.3 }],
  },
  bubbleCluster: {
    width: 320,
    height: 230,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'absolute',
  },
  boyAvatarWrap: {
    top: 6,
    left: 32,
    zIndex: 2,
  },
  boyBubbleGlow: {
    width: 108,
    height: 108,
    borderRadius: 54,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImageSmall: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  girlAvatarWrap: {
    top: 0,
    right: 28,
    zIndex: 2,
  },
  girlBubbleGlow: {
    width: 112,
    height: 112,
    borderRadius: 56,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  teacherAvatarWrap: {
    bottom: 2,
    left: 96,
    zIndex: 10,
  },
  teacherBubbleGlow: {
    width: 128,
    height: 128,
    borderRadius: 64,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 14,
  },
  avatarImageLarge: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTopLeft: {
    top: 14,
    left: 18,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#A78BFA',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  orbTopRight: {
    top: 8,
    right: 22,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#D4FF32',
    shadowColor: '#D4FF32',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  orbBottomLeft: {
    bottom: 26,
    left: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6EE7B7',
    shadowColor: '#6EE7B7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  orbBottomRight: {
    bottom: 30,
    right: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FCD34D',
    shadowColor: '#FCD34D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  headlineArea: {
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
  titleLine1: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  titleLine2: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    color: darkTheme.lime,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(212, 255, 50, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  rolesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  roleEmoji: {
    fontSize: 13,
  },
  roleLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  flexSpacer: {
    flex: 1,
    minHeight: 16,
  },
  bottomContainer: {
    paddingHorizontal: 16,
  },
  bottomCard: {
    backgroundColor: 'rgba(22, 21, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 12,
  },
  neonActionButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#151422',
    borderWidth: 2,
    borderColor: darkTheme.lime,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: darkTheme.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  neonButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  securityCaption: {
    color: '#68657B',
    fontSize: 11,
  },
});
