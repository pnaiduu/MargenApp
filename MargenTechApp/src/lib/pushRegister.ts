import type { SupabaseClient } from '@supabase/supabase-js'
import { registerExpoPushTokenDirect } from './directSupabaseActions'

/** Prefer Edge Function (matches web); fall back to direct upsert if invoke fails. */
export async function registerExpoPushToken(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  platform: string,
): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'register-expo-push-token',
    {
      body: { token: token.trim(), platform },
    },
  )
  if (!error && data && (data as { ok?: boolean }).ok === true) {
    return { error: null }
  }
  const edgeMsg = (data as { error?: string })?.error ?? error?.message ?? ''
  if (
    error?.message?.includes('Network') ||
    edgeMsg.includes('not found') ||
    edgeMsg.includes('Failed to fetch')
  ) {
    return registerExpoPushTokenDirect(supabase, userId, token, platform)
  }
  if (edgeMsg) return { error: new Error(edgeMsg) }
  if (error) return { error: new Error(error.message) }
  return registerExpoPushTokenDirect(supabase, userId, token, platform)
}
