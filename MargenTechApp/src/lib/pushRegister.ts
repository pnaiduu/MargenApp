import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerExpoPushTokenDirect } from './directSupabaseActions'

/** Fallback when `extra.eas.projectId` is not set in app.json (replace with your EAS project id). */
const FALLBACK_EAS_PROJECT_ID = '65c7cf37-80a7-4253-911b-7c4af151449d'

export function resolveExpoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined
  const fromExtra = extra?.eas?.projectId?.trim()
  const fromEasConfig = (
    Constants as unknown as { easConfig?: { projectId?: string } }
  ).easConfig?.projectId?.trim()
  const fromRoot = (Constants.expoConfig as { projectId?: string } | null)?.projectId?.trim()
  const id = fromExtra || fromEasConfig || fromRoot || FALLBACK_EAS_PROJECT_ID
  if (!id || id.length < 8) return null
  return id
}

async function acquireExpoPushTokenAsync(): Promise<string | null> {
  const projectId = resolveExpoProjectId()
  if (!projectId) {
    console.warn('[push] No Expo projectId in app config; skipping push token registration.')
    return null
  }

  const perm = await Notifications.getPermissionsAsync()
  let status = perm.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  return token.data?.trim() || null
}

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

/**
 * Request permissions, obtain Expo push token, and register with Margen.
 * Never throws — logs and returns on failure so the app keeps running.
 */
export async function setupPushNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ token: string | null; error: string | null }> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
      await Notifications.setNotificationChannelAsync('emergency', {
        name: 'Emergency jobs',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
      })
    }

    const tok = await acquireExpoPushTokenAsync()
    if (!tok) return { token: null, error: null }

    const { error } = await registerExpoPushToken(supabase, userId, tok, Platform.OS)
    if (error) {
      console.warn('[push] registerExpoPushToken:', error.message)
      return { token: tok, error: error.message }
    }
    return { token: tok, error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[push] setupPushNotifications failed:', message)
    return { token: null, error: message }
  }
}
