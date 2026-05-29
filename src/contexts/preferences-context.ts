import { createContext } from 'react'
import type { ThemeMode } from '../lib/appearanceTheme'

export type PreferencesContextValue = {
  accentHex: string
  setAccentHex: (hex: string) => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  persistAppearance: (patch: {
    accent_color?: string
    theme_mode?: ThemeMode
  }) => Promise<boolean>
  persistError: string | null
  saving: boolean
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
