import * as ImagePicker from 'expo-image-picker'
import { MotiView } from 'moti'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import NetInfo from '@react-native-community/netinfo'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createInvoiceFromJobDirect } from '../lib/directSupabaseActions'
import { uploadJobPhoto } from '../lib/jobPhotos'
import { enqueueOp } from '../lib/offlineQueue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import { useTheme } from '../context/ThemeContext'
import { layout, typography } from '../theme'
import type { JobRow } from '../types/job'

type JobDetail = JobRow & {
  owner_id: string
  tech_notes: string | null
  before_photo_url: string | null
  after_photo_url: string | null
  assignment_note?: string | null
}

export default function JobDetailRoute() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user } = useAuth()
  const { technician } = useTechnician()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [notes, setNotes] = useState('')
  const [beforeUri, setBeforeUri] = useState<string | null>(null)
  const [afterUri, setAfterUri] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState<'before' | 'after' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!jobId) return
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, description, job_type, urgency, status, field_status, scheduled_at, tech_notes, before_photo_url, after_photo_url, owner_id, assignment_note, customers ( name, phone, address, lat, lng )',
      )
      .eq('id', jobId)
      .maybeSingle()
    if (error || !data) {
      setJob(null)
      return
    }
    const row = data as unknown as JobDetail
    setJob(row)
    setNotes(row.tech_notes ?? '')
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])

  async function patchJob(patch: Record<string, unknown>) {
    if (!technician || !jobId) return
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch })
      setJob((j) => (j ? { ...j, ...(patch as object) } : j))
      return
    }
    const { error } = await supabase.from('jobs').update(patch).eq('id', jobId)
    if (error) await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch })
    await load()
  }

  const fs = job?.field_status ?? 'scheduled'

  const primaryLabel = useMemo(() => {
    if (fs === 'scheduled') return 'On my way'
    if (fs === 'en_route') return "I've arrived"
    if (fs === 'arrived') return 'Start job'
    if (fs === 'working') return 'Complete job'
    return 'Job finished'
  }, [fs])

  async function onPrimary() {
    if (!job || !technician || !jobId) return
    setErr(null)
    if (fs === 'scheduled') {
      await patchJob({ field_status: 'en_route', status: 'in_progress' })
      return
    }
    if (fs === 'en_route') {
      await patchJob({ field_status: 'arrived' })
      return
    }
    if (fs === 'arrived') {
      await patchJob({ field_status: 'working', status: 'in_progress' })
      return
    }
    if (fs === 'working') {
      await onCompleteJob()
    }
  }

  async function pickPhoto(kind: 'before' | 'after') {
    if (!job || !technician) return
    setErr(null)
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setErr('Camera permission is required for job photos.')
      return
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.75 })
    if (res.canceled || !res.assets[0]) return
    const uri = res.assets[0].uri
    setPhotoBusy(kind)
    const { publicUrl, error } = await uploadJobPhoto(supabase, job.owner_id, jobId!, kind, uri)
    setPhotoBusy(null)
    if (error || !publicUrl) {
      setErr(error?.message ?? 'Could not upload photo. Is the job-photos bucket set up?')
      return
    }
    if (kind === 'before') {
      setBeforeUri(uri)
      await patchJob({ before_photo_url: publicUrl })
    } else {
      setAfterUri(uri)
      await patchJob({ after_photo_url: publicUrl })
    }
  }

  function openMaps() {
    const addr = job?.customers?.address
    if (!addr) return
    const q = encodeURIComponent(addr)
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${q}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`
    void Linking.openURL(url)
  }

  function callCustomer() {
    const p = job?.customers?.phone
    if (!p) return
    const raw = p.replace(/[^\d+]/g, '')
    void Linking.openURL(`tel:${raw}`)
  }

  async function onCompleteJob() {
    if (!job || !technician || !jobId || !user) return
    setBusy(true)
    setErr(null)
    const jobPatch = {
      field_status: 'completed',
      status: 'completed',
      completed_at: new Date().toISOString(),
      tech_notes: notes.trim() || null,
    }
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      await enqueueOp({ kind: 'job_patch', jobId, expectedTechnicianId: technician.id, patch: jobPatch })
      setBusy(false)
      router.back()
      return
    }
    const { error } = await supabase.from('jobs').update(jobPatch).eq('id', jobId)
    if (error) {
      setErr(error.message)
      setBusy(false)
      return
    }
    const { error: invErr, customerPhone } = await createInvoiceFromJobDirect(supabase, user.id, jobId, {
      send_sms: true,
    })
    if (invErr) setErr(invErr.message)
    else if (customerPhone) {
      await supabase.functions.invoke('send-payment-confirmation-sms', { body: { job_id: jobId } })
    }
    setBusy(false)
    router.replace({ pathname: '/(main)/rating', params: { jobId } })
  }

  if (!job) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: colors.page }]}>
        <Text style={{ color: colors.muted }}>Job not found.</Text>
      </View>
    )
  }

  const lat = job.customers?.lat
  const lng = job.customers?.lng
  const mapReady = lat != null && lng != null

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.page }]}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32 }}
    >
      <MotiView from={{ opacity: 0, translateX: 12 }} animate={{ opacity: 1, translateX: 0 }}>
        <Text style={[styles.title, { color: colors.text }]}>{job.title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{job.customers?.name ?? 'Customer'}</Text>

        <Pressable
          onPress={callCustomer}
          disabled={!job.customers?.phone}
          style={[
            styles.bigBtn,
            { backgroundColor: colors.accent, minHeight: layout.tapMin, opacity: job.customers?.phone ? 1 : 0.45 },
          ]}
        >
          <Text style={[styles.bigBtnTxt, { color: colors.accentFg }]}>Call {job.customers?.phone ?? '—'}</Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.muted }]}>Address</Text>
        <Text style={[styles.body, { color: colors.text }]}>{job.customers?.address ?? '—'}</Text>
        <Pressable
          onPress={openMaps}
          style={[
            styles.bigBtn,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: layout.tapMin,
              marginTop: 10,
            },
          ]}
        >
          <Text style={[styles.bigBtnTxt, { color: colors.text }]}>Navigate</Text>
        </Pressable>

        {mapReady ? (
          <View style={[styles.mapWrap, { borderColor: colors.border }]}>
            <MapView
              style={styles.map}
              scrollEnabled={false}
              region={{
                latitude: lat!,
                longitude: lng!,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
            >
              <Marker coordinate={{ latitude: lat!, longitude: lng! }} title={job.customers?.address ?? ''} />
            </MapView>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.muted }]}>Description</Text>
        <Text style={[styles.body, { color: colors.text }]}>{job.description ?? '—'}</Text>

        <Text style={[styles.label, { color: colors.muted }]}>Owner notes</Text>
        <Text style={[styles.body, { color: colors.text }]}>{job.assignment_note ?? '—'}</Text>

        <Text style={[styles.label, { color: colors.muted }]}>Your notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onEndEditing={() => void patchJob({ tech_notes: notes.trim() || null })}
          multiline
          placeholder="On-site notes…"
          placeholderTextColor={colors.muted2}
          style={[
            styles.notes,
            { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
          ]}
        />

        <Text style={[styles.label, { color: colors.muted }]}>Photos</Text>
        <View style={styles.photoRow}>
          <Pressable
            onPress={() => void pickPhoto('before')}
            disabled={photoBusy !== null}
            style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            {beforeUri || job.before_photo_url ? (
              <Image source={{ uri: beforeUri ?? job.before_photo_url! }} style={styles.photoImg} />
            ) : (
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Add before photo</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void pickPhoto('after')}
            disabled={photoBusy !== null}
            style={[styles.photoBox, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            {afterUri || job.after_photo_url ? (
              <Image source={{ uri: afterUri ?? job.after_photo_url! }} style={styles.photoImg} />
            ) : (
              <Text style={{ color: colors.muted, fontWeight: '700' }}>Add after photo</Text>
            )}
          </Pressable>
        </View>
        {photoBusy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}

        <Text style={[styles.label, { color: colors.muted }]}>Status</Text>
        {err ? (
          <Text style={{ color: colors.danger, marginBottom: 8 }} accessibilityRole="alert">
            {err}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void onPrimary()}
          disabled={busy || fs === 'completed' || fs === 'rated'}
          style={[
            styles.primaryFlow,
            {
              backgroundColor: colors.accent,
              minHeight: layout.tapMin,
              opacity: busy || fs === 'completed' || fs === 'rated' ? 0.55 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentFg} />
          ) : (
            <Text style={[styles.primaryFlowTxt, { color: colors.accentFg }]}>{primaryLabel}</Text>
          )}
        </Pressable>
      </MotiView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: typography.title, fontWeight: '800' },
  meta: { marginTop: 4, fontSize: typography.small },
  label: {
    marginTop: 20,
    marginBottom: 6,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  body: { fontSize: typography.body, lineHeight: 24 },
  bigBtn: { marginTop: 12, borderRadius: layout.radius, alignItems: 'center', justifyContent: 'center' },
  bigBtnTxt: { fontWeight: '800', fontSize: typography.body },
  mapWrap: {
    marginTop: 16,
    height: 200,
    borderRadius: layout.radius,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: { ...StyleSheet.absoluteFillObject },
  notes: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 12,
    fontSize: typography.body,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoBox: {
    flex: 1,
    height: 120,
    borderRadius: layout.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  primaryFlow: {
    marginTop: 8,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryFlowTxt: { fontSize: 18, fontWeight: '900' },
})
