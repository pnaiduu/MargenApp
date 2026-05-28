import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { layout, typography } from '../src/theme'

export default function LoginRoute() {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: layout.pad,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={styles.wordmark}>Margen</Text>
        <Text style={styles.tagline}>Field operations, simplified</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/technician-login')}
          style={({ pressed }) => [styles.primaryBtn, pressed ? styles.btnPressed : null]}
        >
          <Text style={styles.primaryBtnText}>Sign in as Technician</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/signup')}
          style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.btnPressed : null]}
        >
          <Text style={styles.secondaryBtnText}>Sign up as Technician</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/owner-login')}
          style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.btnPressed : null]}
        >
          <Text style={styles.secondaryBtnText}>Owner Login</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  top: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wordmark: { fontSize: 40, fontWeight: '900', letterSpacing: -0.7, color: '#111111' },
  tagline: { marginTop: 10, fontSize: typography.body, color: '#111111', opacity: 0.85 },
  actions: { gap: 12 },
  btnPressed: { opacity: 0.9 },
  primaryBtn: {
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnText: { fontSize: typography.body, fontWeight: '800', color: '#FFFFFF' },
  secondaryBtn: {
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtnText: { fontSize: typography.body, fontWeight: '800', color: '#111111' },
})
