import { MotiView } from 'moti'
import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/context/AuthContext'
import { useTechnician } from '../src/context/TechnicianContext'

export default function SplashRoute() {
  const { user, loading: authLoading } = useAuth()
  const { technician, loading: techLoading } = useTechnician()
  const started = useRef(Date.now())

  useEffect(() => {
    if (authLoading || (user && techLoading)) return

    const elapsed = Date.now() - started.current
    const wait = Math.max(0, 2000 - elapsed)
    const t = setTimeout(() => {
      if (user && technician) {
        router.replace('/(main)/(tabs)')
      } else {
        router.replace('/login')
      }
    }, wait)
    return () => clearTimeout(t)
  }, [authLoading, techLoading, user, technician])

  return (
    <View style={styles.root}>
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 700 }}
        style={styles.logoBlock}
      >
        <Text style={styles.wordmark}>Margen</Text>
      </MotiView>
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
