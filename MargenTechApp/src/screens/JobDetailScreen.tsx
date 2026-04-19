import * as ImagePicker from 'expo-image-picker'
import { MotiView } from 'moti'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createInvoiceFromJobDirect } from '../lib/directSupabaseActions'
import { enqueueOp } from '../lib/offlineQueue'
import { supabase } from '../lib/supabase'
import type { JobDetailProps } from '../navigation/types'
import type { JobRow } from './HomeScreen'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import { colors, layout, typography } from '../theme'

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function JobDetailScreen({ navigation, route }: JobDetailProps) {
  const { jobId } = route.params
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { technician } = useTechnician()
  const [job, setJob] = useState<JobRow | null>(null)
  const [notes, setNotes] = useState('')
  const [beforeUri, setBeforeUri] = useState<string | null>(null)
  const [afterUri, setAfterUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, description, job_type, urgency, status, field_status, scheduled_at, tech_notes, before_photo_url, after_photo_url, owner_id, customers ( name, phone, address, lat, lng )',
      )
      .eq('id', jobId)
      .maybeSingle()
    if (error || !data) {
      setJob(null)
      return
    }
    const row = data as unknown as JobRow & {
      owner_id: string
      tech_notes: string | null
      before_photo_url: string | null
      after_photo_url: string | null
    }
    setJob(row as JobRow)
    setNotes(row.tech_notes ?? '')
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  async function patchJob(patch: Record<string, unknown>) {
    if (!technician) return
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch })
      setJob((j) => (j ? { ...j, ...(patch as object) } : j))
      return
    }
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    if (error) {
      await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch })
    }
    await load()
  }

  async function pick(kind: 'before' | 'after') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    })
    if (res.canceled || !res.assets[0]) return
    const uri = res.assets[0].uri
    if (kind === 'before') setBeforeUri(uri)
    else setAfterUri(uri)
    Alert.alert(
      'Photo attached',
      'Preview is saved on device. Configure Supabase Storage bucket job-photos to sync images to the cloud.',
    )
  }

  function openMaps() {
    const addr = job?.customers?.address
    if (!addr) return
    const q = encodeURIComponent(addr)
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`)
  }

  function callCustomer() {
    const p = job?.customers?.phone
    if (!p) return
    const raw = p.replace(/[^\d+]/g, '')
    void Linking.openURL(`tel:${raw}`)
  }

  const fs = job?.field_status ?? 'scheduled'

  async function onCompleteJob() {
    if (!job || !technician) return
    const ownerId = (job as unknown as { owner_id: string }).owner_id
    setBusy(true)
    const token = randomToken()
    const net = await NetInfo.fetch()
    const ratingPayload = {
      job_id: jobId,
      owner_id: ownerId,
      rating_token: token,
    }
    const jobPatch = {
      field_status: 'completed',
      status: 'completed',
      tech_notes: notes.trim() || null,
    }

    if (!net.isConnected) {
      await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch: jobPatch })
      setBusy(false)
      Alert.alert(
        'Offline',
        'Job marked complete locally. Open this job again when online to generate the customer rating QR.',
      )
      navigation.goBack()
      return
    }

    const { error: rErr } = await supabase.from('job_customer_ratings').insert(ratingPayload)
    if (rErr) {
      setBusy(false)
      Alert.alert('Could not create rating link', rErr.message)
      return
    }
    await supabase.from('jobs').update(jobPatch).eq('id', jobId)

    if (user) {
      const { error: invErr, customerPhone } = await createInvoiceFromJobDirect(supabase, user.id, jobId, {
        send_sms: true,
      })
      if (invErr) {
        Alert.alert('Invoice', invErr.message)
      } else if (customerPhone) {
        const { error: smsErr } = await supabase.functions.invoke('send-payment-confirmation-sms', {
          body: { job_id: jobId },
        })
        if (smsErr) {
          Alert.alert(
            'SMS not sent',
            `${smsErr.message}\n\nThe invoice and payment link were saved; you can resend from the owner dashboard when Twilio is configured.`,
          )
        }
      }
    }
    setBusy(false)
    navigation.replace('CustomerRating', { jobId, ratingToken: token })
  }

  if (!job) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.muted}>Job not found.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32 }}
    >
      <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.meta}>{job.customers?.name ?? 'Customer'}</Text>

        <Pressable onPress={callCustomer} style={styles.bigBtn} disabled={!job.customers?.phone}>
          <Text style={styles.bigBtnTxt}>Call {job.customers?.phone ?? '—'}</Text>
        </Pressable>

        <Text style={styles.label}>Address</Text>
        <Text style={styles.body}>{job.customers?.address ?? '—'}</Text>
        <Pressable onPress={openMaps} style={[styles.bigBtn, styles.secondary]}>
          <Text style={styles.bigBtnTxtDark}>Navigate in Google Maps</Text>
        </Pressable>

        <Text style={styles.label}>Description</Text>
        <Text style={styles.body}>{job.description ?? '—'}</Text>

        <Text style={styles.label}>Your notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onEndEditing={() => void patchJob({ tech_notes: notes.trim() || null })}
          multiline
          placeholder="On-site notes…"
          placeholderTextColor={colors.muted}
          style={styles.notes}
        />

        <Text style={styles.label}>Photos</Text>
        <View style={styles.photoRow}>
          <Pressable onPress={() => void pick('before')} style={styles.photoBox}>
            {beforeUri ? <Image source={{ uri: beforeUri }} style={styles.photoImg} /> : <Text style={styles.photoPl}>Before</Text>}
          </Pressable>
          <Pressable onPress={() => void pick('after')} style={styles.photoBox}>
            {afterUri ? <Image source={{ uri: afterUri }} style={styles.photoImg} /> : <Text style={styles.photoPl}>After</Text>}
          </Pressable>
        </View>

        <Text style={styles.label}>Job progress</Text>
        <View style={styles.actions}>
          <Pressable
            style={styles.actionBtn}
            disabled={fs !== 'scheduled'}
            onPress={() => void patchJob({ field_status: 'en_route', status: 'in_progress' })}
          >
            <Text style={styles.actionTxt}>On my way</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            disabled={fs !== 'en_route'}
            onPress={() => void patchJob({ field_status: 'arrived' })}
          >
            <Text style={styles.actionTxt}>Arrived</Text>
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            disabled={fs !== 'arrived'}
            onPress={() => void patchJob({ field_status: 'working', status: 'in_progress' })}
          >
            <Text style={styles.actionTxt}>Job started</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.dangerOutline]}
            disabled={fs !== 'working' || busy}
            onPress={() => void onCompleteJob()}
          >
            <Text style={styles.actionTxt}>Job complete</Text>
          </Pressable>
        </View>
      </MotiView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  muted: { color: colors.muted },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: typography.small, color: colors.muted },
  label: {
    marginTop: 20,
    marginBottom: 6,
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  body: { fontSize: typography.body, color: colors.text, lineHeight: 22 },
  bigBtn: {
    marginTop: 12,
    backgroundColor: colors.accent,
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bigBtnTxt: { color: colors.accentFg, fontWeight: '800', fontSize: typography.body },
  bigBtnTxtDark: { color: colors.text, fontWeight: '800', fontSize: typography.body },
  notes: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radius,
    padding: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.body,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoBox: {
    flex: 1,
    height: 120,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPl: { color: colors.muted, fontWeight: '600' },
  photoImg: { width: '100%', height: '100%' },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: {
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerOutline: { borderWidth: 1, borderColor: colors.danger, backgroundColor: 'transparent' },
  actionTxt: { color: colors.text, fontWeight: '800', fontSize: typography.body },
})
