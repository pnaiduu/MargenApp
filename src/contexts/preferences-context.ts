import { createContext } from 'react'

export type PreferencesContextValue = {
  accentHex: string
  setAccentHex: (hex: string) => void
  /** Persist accent to profile immediately (use for explicit Save in Settings). Returns false on failure. */
  persistAccentColor: (hex: string) => Promise<boolean>
  persistError: string | null
  saving: boolean
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
