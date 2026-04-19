import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { ensureOwnerProfile } from '../lib/ensureOwnerProfile'
import { foregroundOnAccent, normalizeHex } from '../lib/logoFilter'
import { useAuth } from './useAuth'
import { PreferencesContext } from './preferences-context'

function accentStorageKey(userId: string) {
  return `margen_accent_v1:${userId}`
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [accentHex, setAccentHexState] = useState('#111111')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const prevUserIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (user) {
      prevUserIdRef.current = user.id
      return
    }
    if (!prevUserIdRef.current) return
    prevUserIdRef.current = undefined
    startTransition(() => {
      setAccentHexState('#111111')
      setPersistError(null)
    })
  }, [user])

  useLayoutEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(accentStorageKey(user.id))
      if (!raw) return
      const t = raw.trim()
      if (/^#[0-9A-Fa-f]{6}$/i.test(t) || /^[0-9A-Fa-f]{6}$/i.test(t)) {
        setAccentHexState(normalizeHex(t.startsWith('#') ? t : `#${t}`))
      }
    } catch {
      /* ignore */
    }
  }, [user?.id])

  useEffect(() => {
    if (!supabaseConfigured || !user) return

    let cancelled = false

    void (async () => {
      const ensured = await ensureOwnerProfile(supabase, user)
      if (cancelled || !ensured.ok) return
      const { data, error } = await supabase.from('profiles').select('accent_color').eq('id', user.id).maybeSingle()
      if (cancelled || error) return
      if (data?.accent_color && typeof data.accent_color === 'string') {
        const n = normalizeHex(data.accent_color)
        setAccentHexState(n)
        try {
          localStorage.setItem(accentStorageKey(user.id), n)
        } catch {
          /* ignore */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  useLayoutEffect(() => {
    const root = document.documentElement
    const accent = normalizeHex(accentHex)
    const fg = foregroundOnAccent(accent)
    root.style.setProperty('--margen-accent', accent)
    root.style.setProperty('--margen-accent-fg', fg)
    root.style.setProperty('--margen-accent-muted', `color-mix(in srgb, ${accent} 10%, #fafaf8)`)
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }, [accentHex])

  const persist = useCallback(
    async (patch: { accent_color?: string }): Promise<boolean> => {
      if (!user || !supabaseConfigured) return false
      setSaving(true)
      setPersistError(null)
      const ensured = await ensureOwnerProfile(supabase, user)
      if (!ensured.ok) {
        setPersistError(ensured.error)
        setSaving(false)
        return false
      }
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
      setSaving(false)
      if (error) {
        setPersistError(error.message)
        return false
      }
      if (typeof patch.accent_color === 'string') {
        try {
          localStorage.setItem(accentStorageKey(user.id), patch.accent_color)
        } catch {
          /* ignore */
        }
      }
      return true
    },
    [user],
  )

  const setAccentHex = useCallback((hex: string) => {
    setAccentHexState(normalizeHex(hex))
  }, [])

  const persistAccentColor = useCallback(
    async (hex: string) => {
      const n = normalizeHex(hex)
      setAccentHexState(n)
      return persist({ accent_color: n })
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      accentHex: normalizeHex(accentHex),
      setAccentHex,
      persistAccentColor,
      persistError,
      saving,
    }),
    [accentHex, setAccentHex, persistAccentColor, persistError, saving],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
