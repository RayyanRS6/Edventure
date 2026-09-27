import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/text';
import { colors, radius, spacing } from '@/ui/theme';

/** The role dashboards share one expressive welcome panel and clear first action. */
export function HomeHero({ role, title, subtitle, action, onAction, icon = 'arrow-forward' }: {
  role: string;
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.orbit} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      <View style={styles.content}>
        <View style={styles.eyebrow}><Text variant="caption" weight="700">{role}</Text></View>
        <Text variant="display" weight="700" style={styles.title}>{title}</Text>
        <Text variant="small" tone="soft" style={styles.subtitle}>{subtitle}</Text>
        {action && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.action, pressed && { opacity: 0.84 }]}>
            <Text variant="small" weight="700" style={{ color: '#FFFFFF' }}>{action}</Text>
            <Ionicons name={icon} size={17} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 222, borderRadius: radius.xl, backgroundColor: colors.brand.lilac, overflow: 'hidden', padding: spacing[5], justifyContent: 'center' },
  content: { maxWidth: '85%', alignItems: 'flex-start', gap: spacing[2], zIndex: 1 },
  eyebrow: { borderRadius: radius.pill, backgroundColor: colors.brand.lime, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
  title: { fontSize: 29, lineHeight: 34, color: colors.ink },
  subtitle: { maxWidth: 275 },
  action: { minHeight: 40, marginTop: spacing[2], borderRadius: radius.pill, paddingHorizontal: spacing[4], backgroundColor: colors.brand.night, flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  orbit: { position: 'absolute', width: 168, height: 168, borderRadius: 54, borderWidth: 22, borderColor: colors.brand.lime, right: -60, top: -45, transform: [{ rotate: '-25deg' }] },
  dot: { position: 'absolute', width: 25, height: 25, borderRadius: 13, backgroundColor: colors.brand.pink, right: 38, bottom: 28 },
});
