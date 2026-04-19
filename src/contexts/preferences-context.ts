import { createContext } from 'react'

export type PreferencesContextValue = {
  accentHex: string
  setAccentHex: (hex: string) => void
  persistError: string | null
  saving: boolean
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
