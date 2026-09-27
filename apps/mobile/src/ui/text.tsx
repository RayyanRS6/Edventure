import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, typography } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption';
type Tone = 'ink' | 'soft' | 'muted' | 'subtle' | 'accent' | 'danger' | 'success' | 'warning' | 'inverse';

const sizes: Record<Variant, number> = {
  display: typography.size['2xl'],
  title: typography.size.xl,
  heading: typography.size.md,
  body: typography.size.base,
  small: typography.size.sm,
  caption: typography.size.xs,
};
const defaultWeight: Record<Variant, keyof typeof fontFamily.latin> = { display: '700', title: '600', heading: '600', body: '400', small: '400', caption: '500' };
const toneColor: Record<Tone, string> = {
  ink: colors.ink,
  soft: colors.inkSoft,
  muted: colors.muted,
  subtle: colors.subtle,
  accent: colors.accent[700],
  danger: colors.danger.fg,
  success: colors.success.fg,
  warning: colors.warning.fg,
  inverse: '#FFFFFF',
};

/**
 * Text that picks DM Sans or Noto Nastaliq Urdu from the current language, with the generous line
 * height Nastaliq needs. `latin` keeps identifiers, numbers and codes in the Latin face.
 */
export function Text({
  variant = 'body',
  weight,
  tone = 'ink',
  latin,
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; weight?: keyof typeof fontFamily.latin; tone?: Tone; latin?: boolean; center?: boolean }) {
  const { i18n } = useTranslation();
  const urdu = i18n.language === 'ur' && !latin;
  const size = sizes[variant];
  const w = weight ?? defaultWeight[variant];
  const base: TextStyle = {
    fontFamily: (urdu ? fontFamily.urdu : fontFamily.latin)[w],
    fontSize: urdu ? size - 1 : size,
    lineHeight: Math.round(size * (urdu ? typography.urduLineHeight : typography.latinLineHeight)),
    color: toneColor[tone],
    textAlign: center ? 'center' : undefined,
  };
  return <RNText style={[base, style]} {...rest} />;
}
