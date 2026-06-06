import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from './supabaseConfig'

let client: SupabaseClient | null = null

export function getSupabase() {
  if (client) return client
  const { url, key } = getSupabaseConfig()
  if (!url || !key) return null
  client = createClient(url, key)
  return client
}
