import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useCallback, useEffect, useMemo, useState, createContext, useContext, type ReactNode } from 'react'
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
import { fetchOwnerDemoWorkspace, type OwnerDemoWorkspace, type OwnerJobRow } from '../lib/ownerDemoData'
import { clearAppViewMode, setAppViewMode } from '../lib/viewMode'
import { useTheme } from '../context/ThemeContext'
import { layout, typography } from '../theme'

const Tab = createBottomTabNavigator()

type DemoCtx = {
  data: OwnerDemoWorkspace | null
  loading: boolean
  error: string | null
  refreshing: boolean
  refresh: () => Promise<void>
}

const DemoContext = createContext<DemoCtx | null>(null)

function useDemo() {
  const v = useContext(DemoContext)
  if (!v) throw new Error('Owner demo tab outside DemoContext')
  return v
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function StatusPill({ status }: { status: string }) {
  const { colors } = useTheme()
  const s = status.replace(/_/g, ' ')
  const paid = status === 'paid' || status === 'completed'
  const cancelled = status === 'cancelled' || status === 'void'
  const bg = paid ? colors.successMuted : cancelled ? '#FEE2E2' : colors.surfaceMuted
  const fg = paid ? colors.success : cancelled ? colors.danger : colors.muted
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillTxt, { color: fg }]}>{s}</Text>
    </View>
  )
}

function DemoScroll({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode
  refreshing: boolean
  onRefresh: () => void
}) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {children}
    </ScrollView>
  )
}

function JobCard({ job }: { job: OwnerJobRow }) {
  const { colors } = useTheme()
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.cardRow}>
        <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]} numberOfLines={2}>
          {job.title}
        </Text>
        <StatusPill status={job.status} />
      </View>
      <Text style={[styles.cardMeta, { color: colors.muted }]}>
        {job.customers?.name ?? 'Customer'} · {job.technicians?.name ?? 'Unassigned'}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.muted2 }]}>{formatWhen(job.scheduled_at)} · {job.urgency}</Text>
    </View>
  )
}

function DashboardTab() {
  const { colors } = useTheme()
  const { data, loading, error, refreshing, refresh } = useDemo()

  const region = useMemo(() => {
    const pts = data?.dashboard.technicians ?? []
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
  }, [data?.dashboard.technicians])

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </View>
    )
  }
  if (!data) return null

  const d = data.dashboard
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <View style={styles.mapWrap}>
        <MapView style={styles.map} region={region}>
          {d.technicians.map((t) => (
            <Marker
              key={t.id}
              coordinate={{ latitude: t.last_lat, longitude: t.last_lng }}
              title={t.name}
              description={t.status ? `Status: ${t.status}` : undefined}
            />
          ))}
        </MapView>
        {d.technicians.length === 0 ? (
          <View style={[styles.mapOverlay, { backgroundColor: colors.overlay }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>No live technician locations yet</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{d.jobsToday}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Jobs today</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{d.techActive}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Active techs</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{formatUsd(d.revenueTodayCents)}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Revenue</Text>
        </View>
      </View>
    </DemoScroll>
  )
}

function JobsTab() {
  const { colors } = useTheme()
  const { data, loading, refreshing, refresh } = useDemo()
  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  const jobs = data?.jobs ?? []
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>All jobs</Text>
      {jobs.length === 0 ? (
        <Text style={{ color: colors.muted }}>No jobs yet.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </View>
      )}
    </DemoScroll>
  )
}

function TechniciansTab() {
  const { colors } = useTheme()
  const { data, loading, refreshing, refresh } = useDemo()
  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  const techs = data?.technicians ?? []
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Team</Text>
      {techs.length === 0 ? (
        <Text style={{ color: colors.muted }}>No technicians yet.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {techs.map((t) => (
            <View key={t.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.cardRow}>
                <Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>{t.name}</Text>
                <StatusPill status={t.status} />
              </View>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>
                {t.role ?? 'Technician'} · {t.clockedIn ? 'Clocked in' : 'Not clocked in'}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted2 }]}>
                {t.last_lat != null && t.last_lng != null
                  ? `Live: ${t.last_lat.toFixed(4)}, ${t.last_lng.toFixed(4)}`
                  : 'No GPS on file'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </DemoScroll>
  )
}

function ScheduleTab() {
  const { colors } = useTheme()
  const { data, loading, refreshing, refresh } = useDemo()
  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  const jobs = data?.schedule ?? []
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Today&apos;s schedule</Text>
      {jobs.length === 0 ? (
        <Text style={{ color: colors.muted }}>No jobs scheduled for today.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {jobs.map((j, i) => (
            <View key={j.id} style={styles.scheduleRow}>
              <Text style={[styles.scheduleIdx, { color: colors.muted2 }]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <JobCard job={j} />
              </View>
            </View>
          ))}
        </View>
      )}
    </DemoScroll>
  )
}

function PaymentsTab() {
  const { colors } = useTheme()
  const { data, loading, refreshing, refresh } = useDemo()
  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  const invoices = data?.invoices ?? []
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent invoices</Text>
      {invoices.length === 0 ? (
        <Text style={{ color: colors.muted }}>No invoices yet.</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {invoices.map((inv) => (
            <View key={inv.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.cardRow}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>#{inv.invoice_number}</Text>
                <StatusPill status={inv.status} />
              </View>
              <Text style={[styles.cardMeta, { color: colors.muted }]}>
                {inv.customers?.name ?? 'Customer'} · {formatUsd(inv.amount_cents)}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.muted2 }]}>
                Created {formatWhen(inv.created_at)}
                {inv.paid_at ? ` · Paid ${formatWhen(inv.paid_at)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </DemoScroll>
  )
}

function SettingsTab() {
  const { colors } = useTheme()
  const { data, loading, refreshing, refresh, error } = useDemo()
  const { signOut } = useAuth()

  async function onSignOut() {
    await clearAppViewMode()
    await signOut()
    router.replace('/login')
  }

  async function switchToTechnician() {
    await setAppViewMode('technician')
    router.replace('/(main)/(tabs)/home')
  }

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }
  const p = data?.profile
  return (
    <DemoScroll refreshing={refreshing} onRefresh={() => void refresh()}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Business profile</Text>
      {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.settingLbl, { color: colors.muted }]}>Company</Text>
        <Text style={[styles.settingVal, { color: colors.text }]}>{p?.company_name?.trim() || '—'}</Text>
        <Text style={[styles.settingLbl, { color: colors.muted, marginTop: 14 }]}>Owner name</Text>
        <Text style={[styles.settingVal, { color: colors.text }]}>{p?.full_name?.trim() || '—'}</Text>
        <Text style={[styles.settingLbl, { color: colors.muted, marginTop: 14 }]}>Business phone</Text>
        <Text style={[styles.settingVal, { color: colors.text }]}>{p?.business_phone?.trim() || '—'}</Text>
        <Text style={[styles.settingLbl, { color: colors.muted, marginTop: 14 }]}>Address</Text>
        <Text style={[styles.settingVal, { color: colors.text }]}>{p?.business_address?.trim() || '—'}</Text>
      </View>
      <Pressable
        onPress={() => void switchToTechnician()}
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
      >
        <Text style={[styles.actionTxt, { color: colors.text }]}>Switch to technician view</Text>
      </Pressable>
      <Pressable
        onPress={() => void onSignOut()}
        style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.actionTxt, { color: colors.danger }]}>Sign out</Text>
      </Pressable>
    </DemoScroll>
  )
}

function OwnerDemoTabs() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted2,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          minHeight: 56 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardTab}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsTab}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Technicians"
        component={TechniciansTab}
        options={{
          tabBarLabel: 'Team',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleTab}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsTab}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsTab}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  )
}

export default function OwnerDemoScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { user, signOut } = useAuth()
  const [data, setData] = useState<OwnerDemoWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setError(null)
    const snap = await fetchOwnerDemoWorkspace(user.id)
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
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load workspace'))
      .finally(() => setLoading(false))
  }, [user, load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh')
    }
    setRefreshing(false)
  }, [load])

  async function onSignOut() {
    await clearAppViewMode()
    await signOut()
    router.replace('/login')
  }

  const ctx = useMemo(
    () => ({
      data,
      loading,
      error,
      refreshing,
      refresh: onRefresh,
    }),
    [data, loading, error, refreshing, onRefresh],
  )

  return (
    <DemoContext.Provider value={ctx}>
      <View style={[styles.root, { backgroundColor: colors.page, paddingTop: insets.top }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.demoBadge, { color: colors.accent }]}>Owner demo</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {data?.dashboard.companyName ?? data?.profile.company_name ?? 'Your business'}
            </Text>
          </View>
          <Pressable onPress={() => void onSignOut()} hitSlop={8} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={22} color={colors.muted} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <OwnerDemoTabs />
        </View>
      </View>
    </DemoContext.Provider>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.pad },
  mapWrap: { height: 220, borderRadius: layout.radius, overflow: 'hidden', marginBottom: 16 },
  map: { flex: 1 },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 12,
  },
  statNum: { fontSize: 18, fontWeight: '800' },
  statLbl: { marginTop: 4, fontSize: typography.caption, fontWeight: '600' },
  sectionTitle: { fontSize: typography.body, fontWeight: '800', marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: layout.radius,
    padding: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: typography.body, fontWeight: '700' },
  cardMeta: { marginTop: 6, fontSize: typography.caption },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  scheduleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  scheduleIdx: { width: 20, marginTop: 14, fontSize: typography.caption, fontWeight: '800' },
  settingLbl: { fontSize: typography.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  settingVal: { marginTop: 4, fontSize: typography.body, fontWeight: '600' },
  actionBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: layout.radius,
    minHeight: layout.tapMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTxt: { fontSize: typography.small, fontWeight: '700' },
})
