import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { Platform, Alert } from 'react-native'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { registerExpoPushToken } from '../lib/pushRegister'
import { supabase } from '../lib/supabase'

type NotificationsCtx = {
  expoPushToken: string | null
  lastError: string | null
}

const Ctx = createContext<NotificationsCtx | null>(null)

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const urgent = (n.request.content.data as { urgency?: string })?.urgency === 'emergency'
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: urgent,
      shouldSetBadge: false,
    }
  },
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
  const foregroundSub = useRef<Notifications.Subscription | null>(null)
  const responseSub = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    foregroundSub.current = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as { type?: string; job_id?: string; urgency?: string }
      if (data?.type === 'job_cancelled') {
        Alert.alert('Job cancelled', n.request.content.body ?? 'This job was cancelled.')
      }
      if (data?.urgency === 'emergency' && data?.job_id) {
        Alert.alert('Emergency job', n.request.content.body ?? 'A new emergency job needs you.', [
          { text: 'Open', onPress: () => router.push(`/(main)/job/${data.job_id}`) },
          { text: 'OK', style: 'cancel' },
        ])
      }
    })
    responseSub.current = Notifications.addNotificationResponseReceivedListener((res) => {
      const data = res.notification.request.content.data as {
        type?: string
        job_id?: string
        urgency?: string
      }
      if (data?.job_id) {
        router.push(`/(main)/job/${data.job_id}`)
      }
    })
    return () => {
      foregroundSub.current?.remove()
      responseSub.current?.remove()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!user) return
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
      setLastError(null)
      const tok = await registerForPushNotificationsAsync()
      if (cancelled) return
      setExpoPushToken(tok)
      if (!tok) return

      const { error } = await registerExpoPushToken(supabase, user.id, tok, Platform.OS)
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
