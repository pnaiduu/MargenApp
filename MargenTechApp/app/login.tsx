import { MotiView } from 'moti'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../src/context/AuthContext'
import { useTechnician } from '../src/context/TechnicianContext'
import { useTheme } from '../src/context/ThemeContext'
import { layout, typography } from '../src/theme'

export default function LoginRoute() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { signIn, configured } = useAuth()
  const { refresh: refreshTech } = useTechnician()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noTech, setNoTech] = useState(false)

  async function onSubmit() {
    setError(null)
    setNoTech(false)
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
    const tech = await refreshTech()
    setBusy(false)
    if (!tech) {
      setNoTech(true)
      return
    }
    router.replace('/(main)/(tabs)')
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.page }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: layout.pad,
          justifyContent: 'center',
        }}
      >
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 450 }}
        >
          <Text style={[styles.wordmark, { color: colors.text }]}>Margen</Text>
          <Text style={[styles.title, { color: colors.text }]}>Technician sign in</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>Use the email and password from your employer.</Text>

          {error ? (
            <Text style={styles.err} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          {noTech ? (
            <Text style={styles.err}>
              Ask your employer to send you an invite link so this account can be linked to a technician profile.
            </Text>
          ) : null}

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@company.com"
            placeholderTextColor={colors.muted2}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
          />

          <Text style={[styles.fieldLabel, { color: colors.text }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            placeholderTextColor={colors.muted2}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text,
              },
            ]}
          />

          <Pressable
            onPress={() => void onSubmit()}
            disabled={busy}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: colors.accent,
                opacity: pressed || busy ? 0.88 : 1,
                minHeight: layout.tapMin,
              },
            ]}
          >
            <Text style={[styles.btnText, { color: colors.accentFg }]}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
        </MotiView>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wordmark: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  title: { marginTop: 12, fontSize: typography.hero, fontWeight: '700' },
  hint: { marginTop: 8, fontSize: typography.body, lineHeight: 24 },
  fieldLabel: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: typography.small,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: layout.radius,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: typography.body,
    minHeight: layout.tapMin,
  },
  btn: {
    marginTop: 28,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: typography.body, fontWeight: '800' },
  err: {
    marginTop: 16,
    fontSize: typography.small,
    color: '#DC2626',
    lineHeight: 22,
  },
})
