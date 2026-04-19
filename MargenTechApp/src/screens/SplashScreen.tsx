import { MotiView } from 'moti'
import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import type { SplashProps } from '../navigation/types'
import { colors, typography } from '../theme'

export function SplashScreen({ navigation }: SplashProps) {
  const { user, loading: authLoading, configured } = useAuth()
  const { technician, loading: techLoading } = useTechnician()
  const doneRef = useRef(false)

  useEffect(() => {
    if (!configured) {
      const t = setTimeout(() => {
        if (doneRef.current) return
        doneRef.current = true
        navigation.replace('Login')
      }, 1200)
      return () => clearTimeout(t)
    }
    if (authLoading) return
    if (user && techLoading) return

    const t = setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      if (user && technician) navigation.replace('MainTabs')
      else navigation.replace('Login')
    }, 1400)

    return () => clearTimeout(t)
  }, [authLoading, configured, navigation, techLoading, technician, user])

  return (
    <View style={styles.root}>
      <MotiView
        from={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 900 }}
        style={styles.logoBlock}
      >
        <Text style={styles.wordmark}>Margen</Text>
        <Text style={styles.sub}>Technician</Text>
      </MotiView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: { alignItems: 'center' },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
    fontSize: typography.body,
    color: colors.muted,
    fontWeight: '500',
  },
})
