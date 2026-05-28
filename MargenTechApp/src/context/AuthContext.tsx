import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearAppViewMode } from '../lib/viewMode'
import { supabase, supabaseConfigured } from '../lib/supabase'

type AuthCtx = {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    meta?: { fullName?: string; technicianInviteToken?: string },
  ) => Promise<{ error: Error | null; session: Session | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session ?? null)
        setLoading(false)
      }
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, next) => setSession(next))
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) return { error: new Error('Supabase not configured') }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      meta?: { fullName?: string; technicianInviteToken?: string },
    ) => {
      if (!supabaseConfigured) return { error: new Error('Supabase not configured'), session: null }
      const data: Record<string, string> = {
        full_name: meta?.fullName?.trim() ?? '',
        signup_role: 'technician',
      }
      const tok = meta?.technicianInviteToken?.trim()
      if (tok) data.technician_invite_token = tok
      const { data: result, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data },
      })
      return {
        error: error ? new Error(error.message) : null,
        session: result.session ?? null,
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return
    await clearAppViewMode()
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: supabaseConfigured,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, signIn, signUp, signOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
