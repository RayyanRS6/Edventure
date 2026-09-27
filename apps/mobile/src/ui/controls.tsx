import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { colors, fontFamily, mirrorInRtl, radius, spacing, toneColors, touchTarget, type StatusTone } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const bg = { primary: colors.brand.night, secondary: colors.surface, ghost: 'transparent', danger: colors.danger.fg }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'ghost' ? colors.accent[700] : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.lineStrong },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text variant={small ? 'small' : 'body'} weight="600" style={{ color: fg }}>
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style, title, action }: { children: ReactNode; style?: ViewStyle; title?: string; action?: ReactNode }) {
  return (
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.cardHeader}>
          {title ? <Text variant="heading">{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text variant="caption" style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Row({ children, style, gap = spacing[2] }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** A tappable list row: title, optional subtitle and trailing content, with a direction-aware chevron. */
export function ListRow({
  title,
  subtitle,
  trailing,
  onPress,
  icon,
  latinTitle,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  latinTitle?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && onPress ? { backgroundColor: colors.surfaceSunken } : null]}
    >
      {icon && (
        <View style={styles.listIcon}>
          <Ionicons name={icon} size={18} color={colors.accent[700]} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="500" latin={latinTitle} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.subtle} style={mirrorInRtl} />}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />;
}

export function TextField({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { i18n } = useTranslation();
  const urdu = i18n.language === 'ur';
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" weight="500" tone="soft">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.subtle}
        style={[
          styles.input,
          { fontFamily: urdu ? fontFamily.urdu['400'] : fontFamily.latin['400'] },
          input.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 10 },
          error ? { borderColor: colors.danger.fg } : null,
          style,
        ]}
        {...input}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A select that opens a bottom sheet of options (no native picker dependency). */
export function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: T | '' | null;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" weight="500" tone="soft">
        {label}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[styles.input, styles.choice]}>
        <Text tone={selected ? 'ink' : 'subtle'} numberOfLines={1} style={{ flex: 1 }}>
          {selected?.label ?? placeholder ?? '—'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[3] }]}>
          <Text variant="heading" style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3] }}>
            {label}
          </Text>
          <FlatList
            showsVerticalScrollIndicator={false}
            data={options}
            keyExtractor={(o) => o.value}
            ItemSeparatorComponent={Divider}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.value === value }}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={styles.option}
              >
                <Text weight={item.value === value ? '600' : '400'} style={{ flex: 1 }}>
                  {item.label}
                </Text>
                {item.value === value && <Ionicons name="checkmark" size={20} color={colors.accent[600]} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

/** Segmented choice (e.g. attendance status). Every segment has a text label; color only reinforces it. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tones,
  disabled,
  accessibilityLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  tones?: Partial<Record<T, StatusTone>>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        const tone = tones?.[o.value];
        const c = tone ? toneColors[tone] : { fg: colors.accent[800], bg: colors.accent[50] };
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            onPress={disabled ? undefined : () => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.bg, borderColor: c.fg }]}
          >
            <Text variant="small" weight={on ? '600' : '500'} style={{ color: on ? c.fg : colors.muted }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stat({ label, value, hint, tone, feature, prefix, style }: { label: string; value: string; hint?: string; tone?: 'danger'; feature?: 'lilac' | 'lime' | 'apricot' | 'pink'; prefix?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.stat, feature && { backgroundColor: colors.brand[feature], borderColor: colors.brand[feature] }, style]}>
      <Text variant="caption" tone="soft" weight="600">
        {label}
      </Text>
      <View style={styles.statValue}>
        {prefix ? <Text variant="caption" latin tone={tone === 'danger' ? 'danger' : 'ink'} weight="700">{prefix}</Text> : null}
        <Text variant="title" latin tone={tone === 'danger' ? 'danger' : 'ink'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
      </View>
      {hint ? (
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: spacing[4] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing[5],
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  listRow: {
    minHeight: touchTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[1],
  },
  listIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.accent[50], alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  backdrop: { flex: 1, backgroundColor: 'rgba(21,32,43,0.35)' },
  sheet: { maxHeight: '70%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  option: { minHeight: touchTarget + 8, paddingHorizontal: spacing[4], flexDirection: 'row', alignItems: 'center' },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segment: {
    minHeight: 38,
    minWidth: 64,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stat: { flex: 1, minWidth: 140, minHeight: 132, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing[4], gap: spacing[2], justifyContent: 'space-between' },
  statValue: { minWidth: 0, justifyContent: 'center' },
});
