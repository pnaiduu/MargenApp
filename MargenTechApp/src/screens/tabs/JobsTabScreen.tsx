import NetInfo from '@react-native-community/netinfo'
import { MotiView } from 'moti'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UrgencyBadge } from '../../components/UrgencyBadge'
import { useTechnician } from '../../context/TechnicianContext'
import { useTheme } from '../../context/ThemeContext'
import { cacheJobsJson, readJobsCache } from '../../lib/offlineQueue'
import { supabase } from '../../lib/supabase'
import { layout, typography } from '../../theme'
import type { JobRow } from '../../types/job'

type FilterKey = 'today' | 'upcoming' | 'completed'

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export default function JobsTabScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { technician } = useTechnician()
  const [filter, setFilter] = useState<FilterKey>('today')
  const [rows, setRows] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [offline, setOffline] = useState(false)

  const load = useCallback(async () => {
    if (!technician) {
      setRows([])
      setLoading(false)
      return
    }
    const now = new Date()
    const todayStart = startOfLocalDay(now).toISOString()
    const todayEnd = endOfLocalDay(now).toISOString()

    let q = supabase
      .from('jobs')
      .select(
        'id, title, description, job_type, urgency, status, field_status, scheduled_at, completed_at, tech_notes, customers ( name, phone, address, lat, lng )',
      )
      .eq('technician_id', technician.id)

    if (filter === 'today') {
      q = q.gte('scheduled_at', todayStart).lte('scheduled_at', todayEnd)
    } else if (filter === 'upcoming') {
      q = q.gt('scheduled_at', todayEnd).neq('status', 'completed').neq('status', 'cancelled')
    } else {
      q = q.eq('status', 'completed').order('completed_at', { ascending: false })
    }

    if (filter !== 'completed') {
      q = q.order('scheduled_at', { ascending: true })
    } else {
      q = q.limit(80)
    }

    const { data, error } = await q

    if (error || !data) {
      const cached = await readJobsCache(technician.id)
      if (cached) {
        try {
          setRows(JSON.parse(cached) as JobRow[])
        } catch {
          setRows([])
        }
      } else {
        setRows([])
      }
    } else {
      const list = data as unknown as JobRow[]
      setRows(list)
      if (filter === 'today') await cacheJobsJson(technician.id, JSON.stringify(list))
    }
    setLoading(false)
  }, [technician, filter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOffline(Boolean(s.isConnected === false)))
    return () => unsub()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const emptyMsg = useMemo(() => {
    if (filter === 'today') return 'Nothing on your schedule for today.'
    if (filter === 'upcoming') return 'No upcoming jobs after today.'
    return 'No completed jobs yet.'
  }, [filter])

  return (
    <View style={[styles.root, { backgroundColor: colors.page, paddingTop: insets.top }]}>
      {offline ? (
        <View style={[styles.offline, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Text style={{ color: colors.muted, fontWeight: '700' }}>Offline mode</Text>
        </View>
      ) : null}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['today', 'upcoming', 'completed'] as const).map((k) => {
          const on = filter === k
          return (
            <Pressable
              key={k}
              onPress={() => {
                setLoading(true)
                setFilter(k)
              }}
              style={[
                styles.tab,
                {
                  backgroundColor: on ? colors.accent : colors.surface,
                  borderColor: on ? colors.accent : colors.border,
                  minHeight: layout.tapMin,
                },
              ]}
            >
              <Text style={{ color: on ? colors.accentFg : colors.text, fontWeight: '800', fontSize: typography.small }}>
                {k === 'today' ? 'Today' : k === 'upcoming' ? 'Upcoming' : 'Completed'}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: layout.pad,
          paddingBottom: insets.bottom + 24,
          paddingTop: 12,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading…</Text>
        ) : rows.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: typography.body, marginTop: 24 }}>{emptyMsg}</Text>
        ) : (
          rows.map((j) => (
            <MotiView key={j.id} from={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Pressable
                onPress={() => router.push(`/(main)/job/${j.id}`)}
                style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <View style={styles.row}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                    {j.title}
                  </Text>
                  <UrgencyBadge urgency={j.urgency} />
                </View>
                <Text style={[styles.sub, { color: colors.muted }]}>{j.job_type}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>{j.customers?.address ?? '—'}</Text>
                <View style={[styles.badge, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: typography.caption }}>{j.status}</Text>
                </View>
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  offline: { paddingVertical: 8, alignItems: 'center', borderBottomWidth: 1 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: layout.pad, paddingBottom: 8, borderBottomWidth: 1 },
  tab: { flex: 1, borderRadius: layout.radius, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: typography.body, fontWeight: '700' },
  sub: { marginTop: 6, fontSize: typography.small },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
})
