import { Ionicons } from '@expo/vector-icons'
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
import MapView, { Marker } from 'react-native-maps'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isDemoOwnerEmail } from '../constants/demoOwner'
import { useAuth } from '../context/AuthContext'
import { fetchOwnerDashboard, type OwnerDashboardSnapshot } from '../lib/ownerDashboard'
import { clearAppViewMode, setAppViewMode } from '../lib/viewMode'
import { useTheme } from '../context/ThemeContext'
import { layout, typography } from '../theme'

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function OwnerDemoScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user, signOut } = useAuth()
  const [data, setData] = useState<OwnerDashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setError(null)
    const snap = await fetchOwnerDashboard(user.id)
    setData(snap)
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      router.replace('/login')
      return
    }
    if (!isDemoOwnerEmail(user.email)) {
      router.replace('/login')
      return
    }
    void setAppViewMode('owner_demo')
    setLoading(true)
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load dashboard'))
      .finally(() => setLoading(false))
  }, [user, load])

  const region = useMemo(() => {
    const pts = data?.technicians ?? []
    if (pts.length === 0) {
      return { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 25, longitudeDelta: 25 }
    }
    const lats = pts.map((p) => p.last_lat)
    const lngs = pts.map((p) => p.last_lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.08) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.08) * 1.5,
    }
  }, [data?.technicians])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  async function switchToTechnician() {
    await setAppViewMode('technician')
    router.replace('/(main)/(tabs)/home')
  }

  async function onSignOut() {
    await clearAppViewMode()
    await signOut()
    router.replace('/login')
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.page, paddingTop: insets.top }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.demoBadge, { color: colors.accent }]}>Owner demo</Text>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {data?.companyName ?? 'Your business'}
          </Text>
        </View>
        <Pressable onPress={() => void onSignOut()} hitSlop={8} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : error ? (
          <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
        ) : data ? (
          <>
            <View style={styles.mapWrap}>
              <MapView style={styles.map} region={region}>
                {data.technicians.map((t) => (
                  <Marker
                    key={t.id}
                    coordinate={{ latitude: t.last_lat, longitude: t.last_lng }}
                    title={t.name}
                    description={t.status ? `Status: ${t.status}` : undefined}
                    pinColor={t.map_color ? undefined : '#2563EB'}
                  />
                ))}
              </MapView>
              {data.technicians.length === 0 ? (
                <View style={[styles.mapOverlay, { backgroundColor: colors.overlay }]}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>No live technician locations yet</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.statsRow, { paddingHorizontal: layout.pad }]}>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{data.jobsToday}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Jobs today</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{data.techActive}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Techs active</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{formatUsd(data.revenueTodayCents)}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Revenue today</Text>
              </View>
            </View>

            <Text style={[styles.section, { color: colors.muted, paddingHorizontal: layout.pad }]}>Recent jobs</Text>
            <View style={{ paddingHorizontal: layout.pad, gap: 10 }}>
              {data.recentJobs.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: typography.body }}>No jobs yet.</Text>
              ) : (
                data.recentJobs.map((j) => (
                  <View
                    key={j.id}
                    style={[styles.jobCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={2}>
                      {j.title}
                    </Text>
                    <Text style={[styles.jobMeta, { color: colors.muted }]}>
                      {j.technicians?.name ?? 'Unassigned'} · {j.status} · {formatWhen(j.scheduled_at)}
                    </Text>
                    <Text style={[styles.jobUrgency, { color: colors.muted2 }]}>{j.urgency}</Text>
                  </View>
                ))
              )}
            </View>

            <Pressable
              onPress={() => void switchToTechnician()}
              style={[
                styles.switchBtn,
                {
                  marginHorizontal: layout.pad,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceMuted,
                  minHeight: layout.tapMin,
                },
              ]}
            >
              <Text style={[styles.switchTxt, { color: colors.text }]}>Switch to technician view</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  demoBadge: { fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { marginTop: 2, fontSize: typography.title, fontWeight: '800' },
  mapWrap: { height: 260, marginTop: 8 },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 12,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { marginTop: 4, fontSize: typography.caption, fontWeight: '600' },
  section: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  jobCard: {
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 14,
  },
  jobTitle: { fontSize: typography.body, fontWeight: '700' },
  jobMeta: { marginTop: 6, fontSize: typography.caption },
  jobUrgency: { marginTop: 4, fontSize: typography.caption, textTransform: 'capitalize' },
  switchBtn: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTxt: { fontSize: typography.small, fontWeight: '700' },
  err: { margin: layout.pad, fontSize: typography.small },
})
