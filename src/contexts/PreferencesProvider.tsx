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
import { normalizeHex } from '../lib/logoFilter'
import {
  applyAccentToRoot,
  applyThemeToRoot,
  parseThemeMode,
  type ThemeMode,
} from '../lib/appearanceTheme'
import { useAuth } from './useAuth'
import { PreferencesContext } from './preferences-context'

function accentStorageKey(userId: string) {
  return `margen_accent_v1:${userId}`
}

function themeStorageKey(userId: string) {
  return `margen_theme_v1:${userId}`
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [accentHex, setAccentHexState] = useState('#111111')
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
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
      setThemeModeState('system')
      setPersistError(null)
      applyThemeToRoot('system')
      applyAccentToRoot('#111111')
    })
  }, [user])

  useLayoutEffect(() => {
    if (!user?.id) return
    try {
      const rawAccent = localStorage.getItem(accentStorageKey(user.id))
      if (rawAccent) {
        const t = rawAccent.trim()
        if (/^#[0-9A-Fa-f]{6}$/i.test(t) || /^[0-9A-Fa-f]{6}$/i.test(t)) {
          setAccentHexState(normalizeHex(t.startsWith('#') ? t : `#${t}`))
        }
      }
      const rawTheme = localStorage.getItem(themeStorageKey(user.id))
      if (rawTheme) setThemeModeState(parseThemeMode(rawTheme))
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
      const { data, error } = await supabase
        .from('profiles')
        .select('accent_color, theme_mode, theme')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled || error) return

      const row = data as {
        accent_color?: string | null
        theme_mode?: string | null
        theme?: string | null
      } | null

      if (row?.accent_color && typeof row.accent_color === 'string') {
        const n = normalizeHex(row.accent_color)
        setAccentHexState(n)
        try {
          localStorage.setItem(accentStorageKey(user.id), n)
        } catch {
          /* ignore */
        }
      }

      const mode = parseThemeMode(row?.theme_mode ?? row?.theme)
      setThemeModeState(mode)
      try {
        localStorage.setItem(themeStorageKey(user.id), mode)
      } catch {
        /* ignore */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  useLayoutEffect(() => {
    applyThemeToRoot(themeMode)
  }, [themeMode])

  useLayoutEffect(() => {
    applyAccentToRoot(accentHex)
  }, [accentHex, themeMode])

  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeToRoot('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themeMode])

  const persist = useCallback(
    async (patch: { accent_color?: string; theme_mode?: ThemeMode }): Promise<boolean> => {
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
      if (typeof patch.theme_mode === 'string') {
        try {
          localStorage.setItem(themeStorageKey(user.id), patch.theme_mode)
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

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  const persistAppearance = useCallback(
    async (patch: { accent_color?: string; theme_mode?: ThemeMode }) => {
      const payload: { accent_color?: string; theme_mode?: ThemeMode } = {}
      if (typeof patch.accent_color === 'string') {
        const n = normalizeHex(patch.accent_color)
        setAccentHexState(n)
        payload.accent_color = n
      }
      if (typeof patch.theme_mode === 'string') {
        setThemeModeState(patch.theme_mode)
        payload.theme_mode = patch.theme_mode
      }
      if (Object.keys(payload).length === 0) return true
      return persist(payload)
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      accentHex: normalizeHex(accentHex),
      setAccentHex,
      themeMode,
      setThemeMode,
      persistAppearance,
      persistError,
      saving,
    }),
    [accentHex, setAccentHex, themeMode, setThemeMode, persistAppearance, persistError, saving],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
