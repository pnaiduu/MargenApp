import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useTheme } from '../../src/context/ThemeContext'
import { parseInviteToken } from '../../src/lib/inviteToken'

export default function JoinDeepLinkRoute() {
  const { colors } = useTheme()
  const { token: raw } = useLocalSearchParams<{ token: string }>()

  useEffect(() => {
    const rawToken = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
    const token = parseInviteToken(rawToken ?? '')
    if (token) {
      router.replace({ pathname: '/signup', params: { invite: token } })
    } else {
      router.replace('/signup')
    }
  }, [raw])

  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
