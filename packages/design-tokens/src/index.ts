/**
 * Edventure visual foundations. Status colors are always paired
 * with text so meaning never depends on color alone. Web consumes these as CSS custom properties,
 * mobile as plain values.
 */
export const colors = {
  accent: {
    50: '#F1EDFF',
    100: '#E4DCFF',
    200: '#CBBEFF',
    500: '#8168E8',
    600: '#6C52D5',
    700: '#523CB4',
    800: '#3B2B83',
  },
  brand: { lilac: '#BCA8F4', lime: '#D9F56B', apricot: '#FFC67E', pink: '#F5C0E8', night: '#202030' },
  ink: '#202030',
  inkSoft: '#414255',
  muted: '#626579',
  subtle: '#9295A6',
  line: '#E9E7EF',
  lineStrong: '#D5D2E0',
  canvas: '#F7F6F3',
  surface: '#FFFFFF',
  surfaceSunken: '#F1EFF8',
  success: { fg: '#146C43', bg: '#E6F4EC' },
  warning: { fg: '#8A4B06', bg: '#FDF1DE' },
  danger: { fg: '#B42318', bg: '#FDECEA' },
  info: { fg: '#1F4F99', bg: '#E7EFFB' },
  neutral: { fg: '#46515C', bg: '#EEF1F4' },
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Attendance statuses map to tones; labels always accompany the color. */
export const attendanceTone: Record<'present' | 'absent' | 'late' | 'excused', StatusTone> = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
};

export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const typography = {
  fontLatin: 'DM Sans',
  fontUrdu: 'Noto Nastaliq Urdu',
  size: { xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 34 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  /** Nastaliq needs generous line height; use this multiplier for Urdu text. */
  urduLineHeight: 2,
  latinLineHeight: 1.45,
} as const;

/** Minimum touch target on mobile (points). */
export const touchTarget = 44;

/** Flattened CSS custom properties for the website (`:root { ... }`). */
export function cssVariables(): Record<string, string> {
  return {
    '--accent-50': colors.accent[50],
    '--accent-100': colors.accent[100],
    '--accent-200': colors.accent[200],
    '--accent-500': colors.accent[500],
    '--accent-600': colors.accent[600],
    '--accent-700': colors.accent[700],
    '--accent-800': colors.accent[800],
    '--brand-lilac': colors.brand.lilac,
    '--brand-lime': colors.brand.lime,
    '--brand-apricot': colors.brand.apricot,
    '--brand-pink': colors.brand.pink,
    '--brand-night': colors.brand.night,
    '--ink': colors.ink,
    '--ink-soft': colors.inkSoft,
    '--muted': colors.muted,
    '--subtle': colors.subtle,
    '--line': colors.line,
    '--line-strong': colors.lineStrong,
    '--canvas': colors.canvas,
    '--surface': colors.surface,
    '--surface-sunken': colors.surfaceSunken,
    '--success-fg': colors.success.fg,
    '--success-bg': colors.success.bg,
    '--warning-fg': colors.warning.fg,
    '--warning-bg': colors.warning.bg,
    '--danger-fg': colors.danger.fg,
    '--danger-bg': colors.danger.bg,
    '--info-fg': colors.info.fg,
    '--info-bg': colors.info.bg,
    '--neutral-fg': colors.neutral.fg,
    '--neutral-bg': colors.neutral.bg,
  };
}
