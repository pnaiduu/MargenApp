import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from './auth-context'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { isDevBypassEmail } from '../lib/subscriptionAccess'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabaseConfigured)

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.warn('[auth] getSession:', error.message)
        setSession(data.session ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.warn('[auth] getSession failed:', err)
        setSession(null)
        setLoading(false)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) return
    const uid = session?.user?.id
    const email = session?.user?.email
    if (!uid || !email || !isDevBypassEmail(email)) return
    void supabase.rpc('sync_dev_bypass_subscription').then(({ error }) => {
      if (error) console.warn('[auth] sync_dev_bypass_subscription:', error.message)
    })
  }, [session?.user?.id, session?.user?.email])

  useEffect(() => {
    if (!supabaseConfigured) return
    const id = window.setTimeout(() => {
      setLoading((stillLoading) => {
        if (stillLoading) {
          setSession(null)
          return false
        }
        return stillLoading
      })
    }, 3000)
    return () => window.clearTimeout(id)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) {
      return { error: new Error('Supabase is not configured.') }
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error ? new Error(error.message) : null }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { error: new Error(message) }
    }
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      meta?: { fullName?: string; companyName?: string; technicianInviteToken?: string },
    ) => {
      if (!supabaseConfigured) {
        return { error: new Error('Supabase is not configured.') }
      }
      const data: Record<string, string> = {
        full_name: meta?.fullName ?? '',
      }
      if (meta?.companyName != null && meta.companyName !== '') {
        data.company_name = meta.companyName
      }
      if (meta?.technicianInviteToken) {
        data.technician_invite_token = meta.technicianInviteToken
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data },
      })
      return { error: error ? new Error(error.message) : null }
    },
    [],
  )

  const signOut = useCallback(async () => {
    if (!supabaseConfigured) return
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
