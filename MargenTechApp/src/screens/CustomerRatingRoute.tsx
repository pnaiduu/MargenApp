import { useCallback, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTechnician } from '../context/TechnicianContext'
import { useTheme } from '../context/ThemeContext'
import { submitJobRating } from '../lib/jobRatings'
import { supabase } from '../lib/supabase'
import { layout, typography } from '../theme'

function digits10(s: string) {
  const d = s.replace(/\D/g, '')
  return d.length <= 10 ? d : d.slice(-10)
}

export default function CustomerRatingRoute() {
  const raw = useLocalSearchParams<{ jobId?: string }>().jobId
  const jobId = Array.isArray(raw) ? raw[0] : raw
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { technician } = useTechnician()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [customerPhone, setCustomerPhone] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!jobId) return
    const { data: existing, error: exErr } = await supabase.from('job_ratings').select('id').eq('job_id', jobId).maybeSingle()
    if (!exErr && existing) {
      setErr('A rating was already submitted for this job.')
    }
    const { data: job } = await supabase
      .from('jobs')
      .select('owner_id, customers(phone)')
      .eq('id', jobId)
      .maybeSingle()
    const row = job as { owner_id: string; customers?: { phone?: string | null } | null } | null
    const p = row?.customers?.phone?.trim() ?? null
    setCustomerPhone(p)
    if (!p) {
      setErr('This job has no customer phone on file. Ratings require a customer phone — ask your office to add it.')
    }
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => {
      router.replace('/(main)/(tabs)/home')
    }, 3000)
    return () => clearTimeout(t)
  }, [done])

  async function onSubmit() {
    setErr(null)
    if (!jobId || !technician) return
    if (rating < 1 || rating > 5) {
      setErr('Please choose a star rating.')
      return
    }
    const entered = digits10(phone.trim())
    if (entered.length < 10) {
      setErr('Enter the customer phone number (10 digits) to confirm.')
      return
    }
    const expected = customerPhone ? digits10(customerPhone) : ''
    if (!expected) {
      setErr('Customer phone is missing on this job.')
      return
    }
    if (entered !== expected) {
      setErr('Phone number does not match this job’s customer. Hand the device to your customer.')
      return
    }
    setBusy(true)
    const { data: job } = await supabase.from('jobs').select('owner_id').eq('id', jobId).maybeSingle()
    const ownerId = (job as { owner_id?: string } | null)?.owner_id
    if (!ownerId) {
      setErr('Could not load job.')
      setBusy(false)
      return
    }
    const { error } = await submitJobRating(supabase, {
      job_id: jobId,
      technician_id: technician.id,
      owner_id: ownerId,
      rating,
      comment: comment.trim() || null,
      customer_phone: phone.trim(),
    })
    setBusy(false)
    if (error) {
      setErr(
        error.message.includes('relation') || error.message.includes('job_ratings')
          ? 'Ratings table is not installed yet. Ask your admin to run MargenTechApp/schema/job_ratings.sql.'
          : error.message,
      )
      return
    }
    setDone(true)
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + 16 }]}>
      {done ? (
        <View style={styles.centerThank}>
          <View style={[styles.check, { backgroundColor: colors.successMuted }]}>
            <Text style={{ fontSize: 48, color: colors.success }}>✓</Text>
          </View>
          <Text style={[styles.thankTitle, { color: colors.text }]}>Thank you!</Text>
          <Text style={[styles.thankSub, { color: colors.muted }]}>Your feedback was submitted.</Text>
        </View>
      ) : (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>How did we do today?</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Your feedback helps us improve.</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = rating >= n
              return (
                <Pressable
                  key={n}
                  onPress={() => setRating(n)}
                  style={[
                    styles.starBtn,
                    {
                      borderColor: on ? colors.accent : colors.border,
                      backgroundColor: on ? colors.surfaceMuted : colors.surface,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 32 }}>{on ? '★' : '☆'}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>Any comments? (optional)</Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Tell us how the visit went…"
            placeholderTextColor={colors.muted2}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.page },
            ]}
          />

          <Text style={[styles.label, { color: colors.muted }]}>Customer phone (verification)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Customer mobile number"
            placeholderTextColor={colors.muted2}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.page, minHeight: layout.tapMin },
            ]}
          />

          {err ? (
            <Text style={[styles.err, { color: colors.danger }]} accessibilityRole="alert">
              {err}
            </Text>
          ) : null}

          <Pressable
            onPress={() => void onSubmit()}
            disabled={busy}
            style={[
              styles.submit,
              { backgroundColor: colors.accent, minHeight: layout.tapMin, opacity: busy ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.submitTxt, { color: colors.accentFg }]}>{busy ? 'Submitting…' : 'Submit'}</Text>
          </Pressable>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: layout.pad },
  heading: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  sub: { marginTop: 10, fontSize: typography.body, textAlign: 'center', lineHeight: 24 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 28, flexWrap: 'wrap' },
  starBtn: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 14,
    fontSize: typography.body,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  err: { marginTop: 12, fontSize: typography.small },
  submit: { marginTop: 28, borderRadius: layout.radius, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: typography.body, fontWeight: '900' },
  centerThank: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankTitle: { marginTop: 24, fontSize: typography.hero, fontWeight: '800' },
  thankSub: { marginTop: 8, fontSize: typography.body },
})
