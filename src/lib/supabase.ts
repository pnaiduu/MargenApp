import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // implicit avoids PKCE code-verifier requirements on token refresh (pkce + cleared storage → 400).
    flowType: 'implicit',
    storage: window.localStorage,
    storageKey: 'margen-auth-token',
    lock: undefined,
  },
})
