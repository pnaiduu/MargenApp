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
import { claimTechnicianInvite } from '../src/lib/claimInvite'
import { layout, typography } from '../src/theme'

export default function LinkInviteRoute() {
  const insets = useSafeAreaInsets()
  const { signOut } = useAuth()
  const { refresh: refreshTech } = useTechnician()
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    setError(null)
    const code = inviteCode.trim()
    if (!code) {
      setError('Invite code is required')
      return
    }
    setBusy(true)
    const { error: claimErr } = await claimTechnicianInvite(code)
    if (claimErr) {
      setBusy(false)
      setError(claimErr)
      return
    }
    const tech = await refreshTech()
    setBusy(false)
    if (!tech) {
      setError('Could not link your account. Check the code and try again.')
      return
    }
    router.replace('/(main)/(tabs)/home')
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        <Text style={styles.wordmark}>Margen</Text>
        <Text style={styles.title}>Join your team</Text>
        <Text style={styles.hint}>
          Your account isn&apos;t linked to a team yet. Enter your invite code below to join your employer&apos;s team.
        </Text>

        {error ? (
          <Text style={styles.err} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Text style={styles.fieldLabel}>Invite code</Text>
        <TextInput
          value={inviteCode}
          onChangeText={(v) => {
            setInviteCode(v)
            if (error) setError(null)
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="e.g. A7X2K9"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
        />

        <Pressable
          onPress={() => void onSubmit()}
          disabled={busy}
          style={({ pressed }) => [styles.primaryBtn, (pressed || busy) && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>{busy ? 'Linking…' : 'Join team'}</Text>
        </Pressable>

        <Pressable onPress={() => void signOut()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  wordmark: { fontSize: 32, fontWeight: '900', letterSpacing: -0.6, color: '#111111' },
  title: { marginTop: 12, fontSize: typography.hero, fontWeight: '700', color: '#111111' },
  hint: { marginTop: 12, fontSize: typography.body, lineHeight: 24, color: '#555555' },
  fieldLabel: { marginTop: 24, marginBottom: 8, fontSize: typography.small, fontWeight: '700', color: '#111111' },
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
  primaryBtn: {
    marginTop: 28,
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: typography.body, fontWeight: '900', color: '#FFFFFF' },
  pressed: { opacity: 0.9 },
  secondaryBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { fontSize: typography.body, fontWeight: '700', color: '#555555' },
  err: { marginTop: 16, fontSize: typography.small, color: '#DC2626', lineHeight: 22 },
})
