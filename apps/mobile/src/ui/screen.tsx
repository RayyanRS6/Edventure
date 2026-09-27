import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Button, type IconName } from './controls';
import { Text } from './text';
import { colors, radius, spacing } from './theme';

/** Standard scrollable screen body with pull-to-refresh and keyboard avoidance. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  scroll = true,
  style,
  footer,
  safeTop = false,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  style?: ViewStyle;
  footer?: ReactNode;
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, safeTop && { paddingTop: insets.top + spacing[4] }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent[600]} colors={[colors.accent[600]]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }, safeTop && { paddingTop: insets.top + spacing[4] }, style]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfflineBanner />
      {body}
      {footer && <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.accent[600]} />
      <Text tone="muted">{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function EmptyState({ title, hint, icon = 'file-tray-outline', action, compact = false }: { title: string; hint?: string; icon?: IconName; action?: ReactNode; compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.emptyCompact}>
        <View style={styles.emptyIconCompact}>
          <Ionicons name={icon} size={20} color={colors.accent[700]} />
        </View>
        <View style={{ flex: 1, gap: spacing[1] }}>
          <Text weight="600">{title}</Text>
          {hint ? <Text tone="muted" variant="small">{hint}</Text> : null}
        </View>
        {action}
      </View>
    );
  }
  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.muted} />
      </View>
      <Text weight="600" center>
        {title}
      </Text>
      {hint ? (
        <Text tone="muted" center variant="small">
          {hint}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.emptyIcon, { backgroundColor: colors.danger.bg }]}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.danger.fg} />
      </View>
      <Text weight="600" center>
        {t('common.somethingWentWrong')}
      </Text>
      <Text tone="muted" center variant="small">
        {errorMessage(error)}
      </Text>
      {onRetry && <Button title={t('common.retry')} variant="secondary" icon="refresh" onPress={onRetry} small />}
    </View>
  );
}

export function InlineError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={styles.inlineError}>
      <Text variant="small" tone="danger">
        {errorMessage(error)}
      </Text>
    </View>
  );
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' | 'danger' | 'success' }) {
  const c = colors[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Text variant="small" style={{ color: c.fg }}>
        {text}
      </Text>
    </View>
  );
}

/** Shown while the device is offline; cached screens also show when they last synced. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const net = useNetworkState();
  if (net.isInternetReachable !== false && net.isConnected !== false) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning.fg} />
      <Text variant="small" tone="warning" style={{ flex: 1 }}>
        {t('common.offline')} · {t('common.offlineHint')}
      </Text>
    </View>
  );
}

export function LastSynced({ at }: { at: number | null | undefined }) {
  const { t, i18n } = useTranslation();
  if (!at) return null;
  return (
    <Text variant="caption" tone="muted">
      {t('common.lastSynced', { time: formatDateTime(new Date(at).toISOString(), i18n.language) })}
    </Text>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="heading" weight="700" tone="ink">
        {children}
      </Text>
      {action}
    </View>
  );
}

/* ---------------- Toasts ---------------- */

type ToastTone = 'success' | 'error';
const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null)), 3000);
    },
    [opacity],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.toast, { bottom: insets.bottom + 72, opacity }, toast.tone === 'error' && { backgroundColor: colors.danger.fg }]}>
          <Ionicons name={toast.tone === 'error' ? 'alert-circle' : 'checkmark-circle'} size={18} color="#FFFFFF" />
          <Text tone="inverse" variant="small" weight="500" style={{ flex: 1 }}>
            {toast.message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing[4], gap: spacing[5], paddingBottom: spacing[12] },
  footer: { paddingHorizontal: spacing[4], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[10], paddingHorizontal: spacing[6] },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  emptyCompact: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[4] },
  emptyIconCompact: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  inlineError: { backgroundColor: colors.danger.bg, borderRadius: radius.md, padding: spacing[3] },
  notice: { borderRadius: radius.md, padding: spacing[3] },
  offline: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: colors.warning.bg, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toast: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
});
