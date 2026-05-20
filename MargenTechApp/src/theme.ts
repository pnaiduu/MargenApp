/** Page + surfaces (light mode default). */
export const lightColors = {
  page: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F4F2',
  border: '#E8E8E4',
  text: '#111111',
  muted: '#555555',
  muted2: '#888888',
  urgent: '#DC2626',
  high: '#EA580C',
  success: '#16A34A',
  successMuted: '#DCFCE7',
  danger: '#DC2626',
  overlay: 'rgba(17,17,17,0.45)',
}

export const layout = {
  tapMin: 56,
  radius: 12,
  pad: 20,
}

export const typography = {
  hero: 28,
  title: 22,
  body: 17,
  small: 15,
  caption: 13,
}

const DEFAULT_ACCENT = '#2563EB'

export type ThemeColors = typeof lightColors & {
  accent: string
  accentFg: string
  /** Legacy dark-theme name → page background */
  bg: string
  /** Legacy dark-theme name → muted surface */
  surface2: string
}

function contrastFg(hex: string): string {
  const h = hex.replace('#', '').trim()
  if (h.length !== 6) return '#FFFFFF'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (![r, g, b].every((n) => Number.isFinite(n))) return '#FFFFFF'
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 160 ? '#111111' : '#FFFFFF'
}

export function buildTheme(accentHex: string | null | undefined): ThemeColors {
  const raw = (accentHex ?? '').trim()
  const accent = /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : DEFAULT_ACCENT
  const base = {
    ...lightColors,
    accent,
    accentFg: contrastFg(accent),
  }
  return {
    ...base,
    /** @deprecated legacy alias */
    bg: base.page,
    /** @deprecated legacy alias */
    surface2: base.surfaceMuted,
  } as ThemeColors
}

/** @deprecated Use `useTheme()` from ThemeContext for accent-aware colors. */
export const colors = buildTheme(DEFAULT_ACCENT)
