import type { HsvaColor } from 'react-colorful'
import { foregroundOnAccent, normalizeHex } from './logoFilter'

export type ThemeMode = 'light' | 'dark' | 'system'

export function parseThemeMode(value: unknown): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return systemPrefersDark()
}

export function applyThemeToRoot(mode: ThemeMode): void {
  const root = document.documentElement
  const isDark = resolveIsDark(mode)
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

export function applyAccentToRoot(hex: string): void {
  const root = document.documentElement
  const accent = normalizeHex(hex)
  const fg = foregroundOnAccent(accent)
  root.style.setProperty('--margen-accent', accent)
  root.style.setProperty('--margen-accent-fg', fg)
  root.style.setProperty(
    '--margen-accent-muted',
    `color-mix(in srgb, ${accent} 12%, var(--color-margen-surface))`,
  )
}

/** react-colorful HSVA: h 0–360, s/v 0–100, a 0–1 */
export function hexToHsva(hex: string): HsvaColor {
  const n = normalizeHex(hex).slice(1)
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return { h, s, v, a: 1 }
}

export function hsvaToHex(hsva: HsvaColor): string {
  const sat = hsva.s / 100
  const val = hsva.v / 100
  const c = val * sat
  const x = c * (1 - Math.abs(((hsva.h / 60) % 2) - 1))
  const m = val - c
  let r = 0
  let g = 0
  let b = 0
  if (hsva.h < 60) {
    r = c
    g = x
  } else if (hsva.h < 120) {
    r = x
    g = c
  } else if (hsva.h < 180) {
    g = c
    b = x
  } else if (hsva.h < 240) {
    g = x
    b = c
  } else if (hsva.h < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }
  const R = Math.round((r + m) * 255)
  const G = Math.round((g + m) * 255)
  const B = Math.round((b + m) * 255)
  return `#${[R, G, B].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
