import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../src/context/AuthContext'
import { setAppViewMode } from '../src/lib/viewMode'
import { layout, typography } from '../src/theme'

export default function OwnerLoginRoute() {
  const insets = useSafeAreaInsets()
  const { signIn, configured } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setError(null)
    if (!configured) {
      setError('Supabase is not configured.')
      return
    }
    setBusy(true)
    const { error: signErr } = await signIn(email.trim(), password)
    if (signErr) {
      setBusy(false)
      setError(signErr.message)
      return
    }
    await setAppViewMode('owner_demo')
    setBusy(false)
    router.replace('/owner-demo')
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: layout.pad,
        }}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.wordmark}>Margen</Text>
          <Text style={styles.title}>Owner login</Text>
        </View>

        {error ? (
          <Text style={styles.err} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@company.com"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <View style={styles.pwRow}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPw}
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor="#8A8A8A"
            style={[styles.input, styles.pwInput]}
          />
          <Pressable
            onPress={() => setShowPw((v) => !v)}
            style={({ pressed }) => [styles.pwToggle, pressed ? styles.pressed : null]}
            hitSlop={6}
          >
            <Text style={styles.pwToggleText}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void onSubmit()}
          disabled={busy}
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Text style={styles.footer}>
          Manage your team at <Text style={styles.footerBold}>trymargen.com</Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  backText: { fontSize: typography.body, fontWeight: '700', color: '#111111' },
  header: { marginTop: 8, marginBottom: 12 },
  wordmark: { fontSize: 32, fontWeight: '900', letterSpacing: -0.6, color: '#111111' },
  title: { marginTop: 10, fontSize: typography.title, fontWeight: '800', color: '#111111' },
  fieldLabel: { marginTop: 18, marginBottom: 8, fontSize: typography.small, fontWeight: '700', color: '#111111' },
  input: {
    minHeight: layout.tapMin,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    borderRadius: layout.radius,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: typography.body,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pwInput: { flex: 1 },
  pwToggle: {
    minHeight: layout.tapMin,
    paddingHorizontal: 14,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: '#E8E8E4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  pwToggleText: { fontSize: typography.small, fontWeight: '800', color: '#111111' },
  primaryBtn: {
    marginTop: 26,
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: typography.body, fontWeight: '900', color: '#FFFFFF' },
  pressed: { opacity: 0.9 },
  err: { marginTop: 12, fontSize: typography.small, color: '#DC2626', lineHeight: 22 },
  footer: { marginTop: 28, fontSize: typography.caption, color: '#111111', opacity: 0.75, textAlign: 'center' },
  footerBold: { fontWeight: '800', color: '#111111' },
})

