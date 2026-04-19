import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { registerExpoPushTokenDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'

type NotificationsCtx = {
  expoPushToken: string | null
  lastError: string | null
}

const Ctx = createContext<NotificationsCtx | null>(null)

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

async function registerForPushNotificationsAsync() {
  const perm = await Notifications.getPermissionsAsync()
  let status = perm.status
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== 'granted') return null

  const token = await Notifications.getExpoPushTokenAsync()
  return token.data
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user) return
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('emergency', {
          name: 'Emergency jobs',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF0000',
          sound: 'default',
        })
      }
      setLastError(null)
      const tok = await registerForPushNotificationsAsync()
      if (cancelled) return
      setExpoPushToken(tok)
      if (!tok) return

      const { error } = await registerExpoPushTokenDirect(supabase, user.id, tok, Platform.OS)
      if (error && !cancelled) setLastError(error.message)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user])

  const value = useMemo(() => ({ expoPushToken, lastError }), [expoPushToken, lastError])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNotifications() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNotifications outside NotificationsProvider')
  return v
}

