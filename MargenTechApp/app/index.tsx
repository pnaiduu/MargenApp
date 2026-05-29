import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/context/AuthContext'
import { useTechnician } from '../src/context/TechnicianContext'
import { getAppViewMode, type AppViewMode } from '../src/lib/viewMode'

export default function SplashRoute() {
  const { user, loading: authLoading } = useAuth()
  const { technician, loading: techLoading } = useTechnician()
  const started = useRef(Date.now())
  const [viewMode, setViewMode] = useState<AppViewMode | null>(null)
  const [viewModeReady, setViewModeReady] = useState(false)

  useEffect(() => {
    void getAppViewMode().then((mode) => {
      setViewMode(mode)
      setViewModeReady(true)
    })
  }, [])

  useEffect(() => {
    if (authLoading || !viewModeReady) return
    if (user && techLoading) return

    const elapsed = Date.now() - started.current
    const wait = Math.max(0, 2000 - elapsed)
    const t = setTimeout(() => {
      if (user && viewMode === 'owner_demo') {
        router.replace('/owner-demo')
        return
      }
      if (user && technician) {
        router.replace('/(main)/(tabs)/home')
        return
      }
      if (user && !technician) {
        router.replace('/link-invite')
        return
      }
      router.replace('/login')
    }, wait)
    return () => clearTimeout(t)
  }, [authLoading, techLoading, user, technician, viewMode, viewModeReady])

  return (
    <View style={styles.root}>
      <View style={styles.logoBlock}>
        <Text style={styles.wordmark}>Margen</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: { alignItems: 'center' },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.5,
  },
})
