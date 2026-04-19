import { Ionicons } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
import { MotiView } from 'moti'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { useClock } from '../context/ClockContext'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import { cacheJobsJson, enqueueOp, readJobsCache } from '../lib/offlineQueue'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../navigation/types'
import { colors, layout, typography } from '../theme'

type Customer = {
  name: string
  phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

export type JobRow = {
  id: string
  title: string
  description: string | null
  job_type: string
  urgency: string
  status: string
  field_status: string
  scheduled_at: string | null
  customers: Customer | null
}

function localDayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

const statusOptions = [
  { key: 'available', label: 'Available' },
  { key: 'busy', label: 'Busy' },
  { key: 'off_duty', label: 'Off duty' },
] as const

export function HomeScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { signOut } = useAuth()
  const { technician, loading: techLoading, refresh: refreshTech } = useTechnician()
  const { isClockedIn, isSyncing, clockIn, clockOut } = useClock()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clockBusy, setClockBusy] = useState(false)
  const [offline, setOffline] = useState(false)

  const loadJobs = useCallback(async () => {
    if (!technician) {
      setJobs([])
      setLoadingJobs(false)
      return
    }
    const { startIso, endIso } = localDayIsoRange()
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, description, job_type, urgency, status, field_status, scheduled_at, tech_notes, customers ( name, phone, address, lat, lng )',
      )
      .eq('technician_id', technician.id)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })

    if (error || !data) {
      const cached = await readJobsCache(technician.id)
      if (cached) {
        try {
          setJobs(JSON.parse(cached) as JobRow[])
        } catch {
          setJobs([])
        }
      } else {
        setJobs([])
      }
    } else {
      const rows = data as unknown as JobRow[]
      const orderWeight = (u: string) => (u === 'emergency' ? 0 : u === 'urgent' ? 1 : u === 'high' ? 2 : 3)
      rows.sort((a, b) => {
        const wa = orderWeight(a.urgency)
        const wb = orderWeight(b.urgency)
        if (wa !== wb) return wa - wb
        return (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
      })
      setJobs(rows)
      await cacheJobsJson(technician.id, JSON.stringify(rows))
    }
    setLoadingJobs(false)
  }, [technician])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOffline(Boolean(s.isConnected === false)))
    return () => unsub()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshTech()
    await loadJobs()
    setRefreshing(false)
  }, [loadJobs, refreshTech])

  const coords = useMemo(() => {
    const pts: { latitude: number; longitude: number }[] = []
    for (const j of jobs) {
      const lat = j.customers?.lat
      const lng = j.customers?.lng
      if (lat != null && lng != null) pts.push({ latitude: lat, longitude: lng })
    }
    return pts
  }, [jobs])

  const mapRegion = useMemo(() => {
    if (coords.length === 0) {
      return { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 25, longitudeDelta: 25 }
    }
    const lats = coords.map((c) => c.latitude)
    const lngs = coords.map((c) => c.longitude)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.08) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, 0.08) * 1.4,
    }
  }, [coords])

  async function setTechStatus(next: string) {
    if (!technician) return
    const net = await NetInfo.fetch()
    if (!net.isConnected) {
      await enqueueOp({ kind: 'technician_patch', technicianId: technician.id, patch: { status: next } })
      await refreshTech()
      return
    }
    await supabase.from('technicians').update({ status: next }).eq('id', technician.id)
    await refreshTech()
  }

  async function onClockPress() {
    setClockBusy(true)
    try {
      if (isClockedIn) await clockOut()
      else {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          setClockBusy(false)
          return
        }
        await clockIn()
      }
    } finally {
      setClockBusy(false)
    }
  }

  if (techLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!technician) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24, paddingHorizontal: layout.pad }]}>
        <Text style={styles.blockedTitle}>No technician profile</Text>
        <Text style={styles.blockedBody}>
          This account is not linked to a technician. Ask your owner to send an invite from Margen web.
        </Text>
        <Pressable onPress={() => void signOut()} style={styles.blockedBtn}>
          <Text style={styles.blockedBtnText}>Sign out</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: insets.top + 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />}
    >
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 400 }}>
        {offline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineTxt}>Offline mode</Text>
          </View>
        ) : isSyncing ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncTxt}>Syncing…</Text>
          </View>
        ) : null}
        <Text style={styles.greet}>Hi, {technician.name}</Text>
        {technician.role ? <Text style={styles.role}>{technician.role}</Text> : null}

        <View style={styles.locRow}>
          <View style={[styles.locDot, { backgroundColor: isClockedIn ? colors.success : colors.border }]} />
          <Text style={[styles.locTxt, { color: isClockedIn ? colors.success : colors.muted }]}>
            {isClockedIn ? 'Location sharing on' : 'Location sharing off'}
          </Text>
        </View>

        <Pressable
          onPress={() => void onClockPress()}
          disabled={clockBusy}
          style={[
            styles.bigClockBtn,
            { backgroundColor: isClockedIn ? colors.success : colors.surface2, minHeight: layout.tapMin + 22 },
          ]}
        >
          <Ionicons name={isClockedIn ? 'log-out-outline' : 'log-in-outline'} size={26} color="#fff" />
          <Text style={styles.bigClockTxt}>{isClockedIn ? 'Clock out' : 'Clock in'}</Text>
        </Pressable>

        <Text style={styles.section}>Status</Text>
        <View style={styles.toggleRow}>
          {statusOptions.map((o) => {
            const active = technician.status === o.key
            return (
              <Pressable
                key={o.key}
                onPress={() => void setTechStatus(o.key)}
                style={[styles.toggleBtn, active && styles.toggleBtnOn, { minHeight: layout.tapMin }]}
              >
                <Text style={[styles.toggleTxt, active && styles.toggleTxtOn]}>{o.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.clockHint}>
          {isClockedIn ? 'Location updates about every minute while clocked in.' : 'GPS tracking is off while clocked out.'}
        </Text>

        <Text style={styles.section}>Route</Text>
        <View style={styles.mapWrap}>
          <MapView style={styles.map} region={mapRegion}>
            {coords.map((c, i) => (
              <Marker key={i} coordinate={c} title={`Stop ${i + 1}`} />
            ))}
            {coords.length > 1 ? (
              <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={3} />
            ) : null}
          </MapView>
          {coords.length === 0 ? (
            <Text style={styles.mapEmpty}>
              Add customer latitude and longitude in Margen admin to plot stops on the map.
            </Text>
          ) : null}
        </View>

        <Text style={styles.section}>Today&apos;s jobs</Text>
        {loadingJobs ? (
          <ActivityIndicator color={colors.muted} style={{ marginVertical: 16 }} />
        ) : jobs.length === 0 ? (
          <Text style={styles.empty}>No jobs scheduled for today.</Text>
        ) : (
          jobs.map((j) => (
            <Pressable
              key={j.id}
              onPress={() => navigation.navigate('JobDetail', { jobId: j.id })}
              style={styles.jobCard}
            >
              <View style={styles.jobTop}>
                <Text style={styles.jobTitle}>{j.title}</Text>
                <UrgencyBadge urgency={j.urgency} />
              </View>
              <Text style={styles.jobType}>{j.job_type}</Text>
              <Text style={styles.jobAddr}>{j.customers?.address ?? 'No address'}</Text>
            </Pressable>
          ))
        )}
      </MotiView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.pad },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center' },
  blocked: { flex: 1, backgroundColor: colors.bg },
  blockedTitle: { fontSize: typography.title, fontWeight: '700', color: colors.text },
  blockedBody: { marginTop: 12, fontSize: typography.body, color: colors.muted, lineHeight: 22 },
  blockedBtn: {
    marginTop: 24,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: layout.radius,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: layout.tapMin,
    justifyContent: 'center',
  },
  blockedBtnText: { color: colors.accent, fontWeight: '700', fontSize: typography.body },
  greet: { fontSize: 26, fontWeight: '800', color: colors.text },
  offlineBanner: {
    backgroundColor: 'rgba(107,114,128,0.25)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  offlineTxt: { color: colors.muted, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  syncBanner: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  syncTxt: { color: colors.text, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  role: { marginTop: 4, fontSize: typography.small, color: colors.muted },
  locRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locDot: { width: 10, height: 10, borderRadius: 999 },
  locTxt: { fontSize: typography.caption, fontWeight: '700' },
  bigClockBtn: {
    marginTop: 14,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
  },
  bigClockTxt: { color: '#fff', fontSize: 18, fontWeight: '900' },
  section: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  toggleBtnOn: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  toggleTxt: { color: colors.muted, fontWeight: '600', fontSize: typography.small },
  toggleTxtOn: { color: colors.text },
  clockHint: { marginTop: 8, fontSize: typography.caption, color: colors.muted },
  mapWrap: {
    height: 220,
    borderRadius: layout.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapEmpty: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontSize: typography.caption,
    color: colors.muted,
    textAlign: 'center',
    backgroundColor: 'rgba(17,24,39,0.75)',
    padding: 8,
    borderRadius: 8,
  },
  empty: { color: colors.muted, fontSize: typography.body },
  jobCard: {
    backgroundColor: colors.surface,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  jobTitle: { flex: 1, fontSize: typography.body, fontWeight: '700', color: colors.text },
  jobType: { marginTop: 6, fontSize: typography.caption, color: colors.muted, textTransform: 'capitalize' },
  jobAddr: { marginTop: 4, fontSize: typography.small, color: colors.muted },
})
