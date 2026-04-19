import { MotiView } from 'moti'
import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import type { LoginProps } from '../navigation/types'
import { colors, layout, typography } from '../theme'

export function LoginScreen({ navigation }: LoginProps) {
  const { signIn, configured } = useAuth()
  const { refresh: refreshTech } = useTechnician()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit() {
    if (!configured) {
      Alert.alert('Configuration', 'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.')
      return
    }
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setBusy(false)
      Alert.alert('Sign in failed', error.message)
      return
    }
    const tech = await refreshTech()
    setBusy(false)
    if (!tech) {
      Alert.alert(
        'Not linked yet',
        'Your account is not linked to a technician profile. Accept an invite from your company owner.',
      )
    }
    navigation.replace('MainTabs')
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 500 }}
        style={styles.card}
      >
        <Text style={styles.label}>Margen</Text>
        <Text style={styles.title}>Technician sign in</Text>
        <Text style={styles.hint}>Use the email and password for your Margen account.</Text>

        <Text style={styles.fieldLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@company.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.fieldLabel}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Pressable
          onPress={() => void onSubmit()}
          disabled={busy}
          style={({ pressed }) => [
            styles.btn,
            { opacity: pressed || busy ? 0.85 : 1, minHeight: layout.tapMin },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentFg} />
          ) : (
            <Text style={styles.btnText}>Sign in</Text>
          )}
        </Pressable>
      </MotiView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: layout.pad,
  },
  card: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    marginTop: 8,
    fontSize: typography.title,
    fontWeight: '700',
    color: colors.text,
  },
  hint: { marginTop: 8, fontSize: typography.small, color: colors.muted, lineHeight: 20 },
  fieldLabel: {
    marginTop: 20,
    marginBottom: 6,
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: typography.body,
    color: colors.text,
    minHeight: layout.tapMin,
  },
  btn: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.accentFg, fontSize: typography.body, fontWeight: '700' },
})
