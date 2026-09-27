import { I18nManager } from 'react-native';
import { colors, radius, spacing, touchTarget, typography, type StatusTone } from '@edventure/design-tokens';

export { colors, radius, spacing, touchTarget, typography, type StatusTone };

export const fontFamily = {
  latin: { '400': 'DMSans_400Regular', '500': 'DMSans_500Medium', '600': 'DMSans_600SemiBold', '700': 'DMSans_700Bold' },
  urdu: { '400': 'NotoNastaliqUrdu_400Regular', '500': 'NotoNastaliqUrdu_500Medium', '600': 'NotoNastaliqUrdu_600SemiBold', '700': 'NotoNastaliqUrdu_700Bold' },
} as const;

export const toneColors: Record<StatusTone, { fg: string; bg: string }> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.neutral,
};

/** Icons that point "forward" must mirror in right-to-left layouts. */
export const mirrorInRtl = I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined;

export const shadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.045,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 5 },
  elevation: 2,
} as const;

export const darkTheme = {
  canvas: '#12111A',
  surface: '#1A1926',
  card: '#1F1E2E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardBorderActive: 'rgba(212, 255, 50, 0.45)',
  lime: '#D4FF32',
  limeDim: 'rgba(212, 255, 50, 0.15)',
  limeText: '#12111A',
  violet: '#7C3AED',
  violetGlow: 'rgba(124, 58, 237, 0.35)',
  violetDim: 'rgba(124, 58, 237, 0.18)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A5A2B8',
  textMuted: '#68657B',
  dockBg: '#1C1B28',
  dockBorder: 'rgba(255, 255, 255, 0.12)',
} as const;

