import { useEffect, useMemo, useState } from 'react'
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
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../src/context/AuthContext'
import { useTechnician } from '../src/context/TechnicianContext'
import { useTheme } from '../src/context/ThemeContext'
import { parseInviteToken } from '../src/lib/inviteToken'
import { setAppViewMode } from '../src/lib/viewMode'
import { layout, typography } from '../src/theme'

type Step = 'form' | 'pending' | 'email_confirm'

export default function SignupRoute() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { signUp, configured } = useAuth()
  const { refresh: refreshTech } = useTechnician()
  const params = useLocalSearchParams<{ invite?: string }>()

  const initialInvite = useMemo(() => {
    const raw = params.invite
    const s = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
    return s ? parseInviteToken(s) : ''
  }, [params.invite])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInvite)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('form')

  useEffect(() => {
    if (initialInvite) setInviteCode(initialInvite)
  }, [initialInvite])

  async function onSubmit() {
    setError(null)
    if (!configured) {
      setError('Supabase is not configured.')
      return
    }
    const fn = firstName.trim()
    const ln = lastName.trim()
    const em = email.trim()
    if (!fn || !ln || !em || password.length < 6) {
      setError('Enter your name, email, and a password of at least 6 characters.')
      return
    }
    const token = parseInviteToken(inviteCode)
    setBusy(true)
    const { error: signErr, session: newSession } = await signUp(em, password, {
      fullName: `${fn} ${ln}`.trim(),
      technicianInviteToken: token || undefined,
    })
    if (signErr) {
      setBusy(false)
      setError(signErr.message)
      return
    }

    await setAppViewMode('technician')

    if (!newSession) {
      setBusy(false)
      setStep('email_confirm')
      return
    }

    const tech = await refreshTech()
    setBusy(false)
    if (tech) {
      router.replace('/(main)/(tabs)/home')
      return
    }
    setStep('pending')
  }

  if (step === 'pending') {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.page,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: layout.pad,
          },
        ]}
      >
        <Text style={[styles.wordmark, { color: colors.text }]}>Margen</Text>
        <Text style={[styles.title, { color: colors.text }]}>You're signed up!</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          Ask your employer to add you to their team or enter your invite code.
        </Text>
        <Pressable
          onPress={() => router.replace('/login')}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.88 : 1,
              minHeight: layout.tapMin,
              marginTop: 32,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.accentFg }]}>Back to sign in</Text>
        </Pressable>
      </View>
    )
  }

  if (step === 'email_confirm') {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.page,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: layout.pad,
          },
        ]}
      >
        <Text style={[styles.wordmark, { color: colors.text }]}>Margen</Text>
        <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
        <Text style={[styles.hint, { color: colors.muted }]}>
          We sent a confirmation link to {email.trim()}. After confirming, sign in — or ask your employer for an
          invite code if you are not linked to a team yet.
        </Text>
        <Pressable
          onPress={() => router.replace('/login')}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.88 : 1,
              minHeight: layout.tapMin,
              marginTop: 32,
            },
          ]}
        >
          <Text style={[styles.btnText, { color: colors.accentFg }]}>Back to sign in</Text>
        </Pressable>
      </View>
    )
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
        }}
      >
        <Text style={[styles.wordmark, { color: colors.text }]}>Margen</Text>
        <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>

        {error ? (
          <Text style={styles.err} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Text style={[styles.fieldLabel, { color: colors.text }]}>First name</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
          placeholder="First name"
          placeholderTextColor={colors.muted2}
          style={inputStyle(colors)}
        />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Last name</Text>
        <TextInput
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
          placeholder="Last name"
          placeholderTextColor={colors.muted2}
          style={inputStyle(colors)}
        />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@email.com"
          placeholderTextColor={colors.muted2}
          style={inputStyle(colors)}
        />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="At least 6 characters"
          placeholderTextColor={colors.muted2}
          style={inputStyle(colors)}
        />

        <Text style={[styles.fieldLabel, { color: colors.text }]}>
          Have an invite code? <Text style={{ fontWeight: '400', color: colors.muted }}>(optional)</Text>
        </Text>
        <TextInput
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Paste invite link or code"
          placeholderTextColor={colors.muted2}
          style={inputStyle(colors)}
        />
        <Text style={[styles.inviteHint, { color: colors.muted }]}>
          Your employer's invite links you to their team automatically.
        </Text>

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
          <Text style={[styles.btnText, { color: colors.accentFg }]}>
            {busy ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: colors.muted }]}>
            Already have an account?{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function inputStyle(colors: { border: string; surface: string; text: string }) {
  return [
    styles.input,
    {
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      minHeight: layout.tapMin,
    },
  ]
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wordmark: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  title: { marginTop: 12, fontSize: typography.hero, fontWeight: '700' },
  hint: { marginTop: 12, fontSize: typography.body, lineHeight: 24 },
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
  },
  inviteHint: {
    marginTop: 8,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  btn: {
    marginTop: 28,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: typography.body, fontWeight: '800' },
  backLink: { marginTop: 28, alignItems: 'center', paddingVertical: 12 },
  backLinkText: { fontSize: typography.body, textAlign: 'center' },
  err: {
    marginTop: 16,
    fontSize: typography.small,
    color: '#DC2626',
    lineHeight: 22,
  },
})
