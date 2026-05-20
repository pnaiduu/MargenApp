import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useTechnician } from './TechnicianContext'
import { supabase } from '../lib/supabase'
import { buildTheme } from '../theme'

type ThemeCtx = {
  colors: ReturnType<typeof buildTheme>
  refreshAccent: () => Promise<void>
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { technician } = useTechnician()
  const [accent, setAccent] = useState<string | null>(null)

  const refreshAccent = useCallback(async () => {
    if (!user || !technician) {
      setAccent(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('accent_hex, accent_color')
      .eq('id', technician.owner_id)
      .maybeSingle()
    const row = data as { accent_color?: string | null; accent_hex?: string | null } | null
    const hex = (row?.accent_hex ?? row?.accent_color ?? '').trim()
    setAccent(hex || null)
  }, [user, technician])

  useEffect(() => {
    void refreshAccent()
  }, [refreshAccent])

  const colors = useMemo(() => buildTheme(accent), [accent])
  const value = useMemo(() => ({ colors, refreshAccent }), [colors, refreshAccent])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}

export type Theme = ReturnType<typeof buildTheme>
