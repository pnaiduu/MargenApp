import { Ionicons } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UrgencyBadge } from '../../components/UrgencyBadge'
import { useAuth } from '../../context/AuthContext'
import { useClock } from '../../context/ClockContext'
import { useTechnician } from '../../context/TechnicianContext'
import { useTheme } from '../../context/ThemeContext'
import { cacheJobsJson, readJobsCache } from '../../lib/offlineQueue'
import { supabase } from '../../lib/supabase'
import { fetchTechnicianHomeStats, type TechHomeStats } from '../../lib/technicianStats'
import { layout, typography } from '../../theme'
import type { JobRow } from '../../types/job'

function localDayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function SkeletonBlock({ colors }: { colors: { surfaceMuted: string; border: string } }) {
  return (
    <View style={{ gap: 10 }}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            height: 96,
            borderRadius: layout.radius,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
      ))}
    </View>
  )
}

export default function HomeTabScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { signOut } = useAuth()
  const { technician, loading: techLoading, refresh: refreshTech } = useTechnician()
  const { isClockedIn, isSyncing, clockIn, clockOut, clockInAt } = useClock()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clockBusy, setClockBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [company, setCompany] = useState<string | null>(null)
  const [homeStats, setHomeStats] = useState<TechHomeStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [shiftTick, setShiftTick] = useState(0)

  const loadStats = useCallback(async () => {
    if (!technician) {
      setHomeStats(null)
      setLoadingStats(false)
      return
    }
    setLoadingStats(true)
    try {
      const stats = await fetchTechnicianHomeStats(technician.id, technician.owner_id, technician.name)
      setHomeStats(stats)
    } finally {
      setLoadingStats(false)
    }
  }, [technician])

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
        'id, title, description, job_type, urgency, status, field_status, scheduled_at, completed_at, tech_notes, customers ( name, phone, address, lat, lng )',
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
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (!isClockedIn || !clockInAt) return
    const id = setInterval(() => setShiftTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [isClockedIn, clockInAt])

  useEffect(() => {
    if (!technician) return
    const ch = supabase
      .channel(`tech-jobs-${technician.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `technician_id=eq.${technician.id}`,
        },
        () => void loadJobs(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [technician, loadJobs])

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setOffline(Boolean(s.isConnected === false)))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!technician) return
    void supabase
      .from('profiles')
      .select('company_name')
      .eq('id', technician.owner_id)
      .maybeSingle()
      .then(({ data }) => {
        setCompany((data as { company_name?: string | null } | null)?.company_name ?? null)
      })
  }, [technician])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshTech()
    await Promise.all([loadJobs(), loadStats()])
    setRefreshing(false)
  }, [loadJobs, loadStats, refreshTech])

  const shiftDurationLabel = useMemo(() => {
    if (!isClockedIn || !clockInAt) return null
    const ms = Date.now() - new Date(clockInAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return null
    const totalMin = Math.floor(ms / 60000)
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return h > 0 ? `${h}h ${m}m on shift` : `${m}m on shift`
  }, [isClockedIn, clockInAt, shiftTick])

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

  const statusLabel = useMemo(() => {
    if (!technician) return ''
    const m: Record<string, string> = {
      available: 'Available',
      busy: 'Busy',
      off_duty: 'Off duty',
      on_break: 'On break',
      pending: 'Pending',
    }
    return m[technician.status] ?? technician.status
  }, [technician])

  if (techLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: colors.page }]}>
        <SkeletonBlock colors={colors} />
      </View>
    )
  }

  if (!technician) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24, backgroundColor: colors.page }]}>
        <Text style={[styles.blockedTitle, { color: colors.text }]}>No technician profile</Text>
        <Text style={[styles.blockedBody, { color: colors.muted }]}>
          Ask your employer to send you an invite link so this account can be linked in Margen.
        </Text>
        <Pressable
          onPress={() => void signOut()}
          style={[styles.blockedBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.blockedBtnText, { color: colors.accent }]}>Sign out</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.page }]}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: insets.top + 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
      }
    >
      <View style={{ paddingHorizontal: layout.pad }}>
        {offline ? (
          <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.bannerTxt, { color: colors.muted }]}>Offline mode</Text>
          </View>
        ) : isSyncing ? (
          <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.bannerTxt, { color: colors.text }]}>Syncing…</Text>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greet, { color: colors.text }]}>
              {homeStats?.greeting ?? technician.name}
            </Text>
            <Text style={[styles.company, { color: colors.muted }]}>{company ?? 'Your company'}</Text>
          </View>
          <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.badgeTxt, { color: colors.text }]}>{statusLabel}</Text>
          </View>
        </View>

        {loadingStats ? (
          <SkeletonBlock colors={colors} />
        ) : homeStats ? (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{homeStats.jobsToday}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Jobs today</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{homeStats.hoursToday}h</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Hours today</Text>
              </View>
              <View style={[styles.statCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{homeStats.jobsWeek}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Jobs this week</Text>
              </View>
            </View>

            <View style={[styles.weekCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.weekTitle, { color: colors.muted }]}>This week</Text>
              <Text style={[styles.weekLine, { color: colors.text }]}>
                On-time:{' '}
                {homeStats.onTimeRateWeek != null
                  ? `${Math.round(homeStats.onTimeRateWeek * 100)}%`
                  : '—'}
                {' · '}
                Avg rating: {homeStats.avgRatingWeek != null ? `${homeStats.avgRatingWeek}★` : '—'}
              </Text>
              {homeStats.teamRank != null && homeStats.teamSize > 1 ? (
                <Text style={[styles.rankLine, { color: colors.accent }]}>
                  You&apos;re #{homeStats.teamRank} on your team this week
                </Text>
              ) : null}
              {homeStats.streakDays >= 2 ? (
                <Text style={[styles.streakLine, { color: colors.muted }]}>
                  {homeStats.streakDays} days in a row with 5-star ratings
                </Text>
              ) : null}
              <View style={styles.barRow}>
                {homeStats.jobsPerDay.map((d) => {
                  const max = Math.max(1, ...homeStats.jobsPerDay.map((x) => x.count))
                  const h = Math.max(4, (d.count / max) * 48)
                  return (
                    <View key={d.label} style={styles.barCol}>
                      <View style={[styles.bar, { height: h, backgroundColor: colors.accent }]} />
                      <Text style={[styles.barLbl, { color: colors.muted2 }]}>{d.label}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {homeStats.nextJob ? (
              <Pressable
                onPress={() => router.push(`/(main)/job/${homeStats.nextJob!.id}`)}
                style={[styles.nextJob, { borderColor: colors.accent, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.nextLbl, { color: colors.muted }]}>Next job</Text>
                <Text style={[styles.nextTitle, { color: colors.text }]} numberOfLines={2}>
                  {homeStats.nextJob.title}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{homeStats.nextJob.customer}</Text>
                <Text style={{ color: colors.text, marginTop: 4, fontWeight: '700' }}>
                  {formatTime(homeStats.nextJob.scheduledAt)}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={{ color: colors.muted, marginTop: 8 }}>No productivity data yet this week.</Text>
        )}

        <Pressable
          onPress={() => void onClockPress()}
          disabled={clockBusy}
          style={[
            styles.bigClockBtn,
            {
              backgroundColor: isClockedIn ? '#dc2626' : '#16a34a',
              minHeight: 56,
              marginTop: 20,
            },
          ]}
        >
          <Ionicons name={isClockedIn ? 'log-out-outline' : 'log-in-outline'} size={26} color="#fff" />
          <Text style={styles.bigClockTxt}>{isClockedIn ? 'Clock Out' : 'Clock In'}</Text>
        </Pressable>
        {shiftDurationLabel ? (
          <Text style={[styles.shiftDur, { color: colors.text }]}>{shiftDurationLabel}</Text>
        ) : null}
        <Text style={[styles.clockHint, { color: colors.muted2 }]}>
          {isClockedIn
            ? 'GPS updates about every minute while clocked in.'
            : 'Clock in to start your shift and share location with dispatch.'}
        </Text>

        <Text style={[styles.section, { color: colors.muted }]}>Today&apos;s jobs</Text>
        {loadingJobs ? (
          <SkeletonBlock colors={colors} />
        ) : jobs.length === 0 ? (
          <Text style={{ color: colors.muted, fontSize: typography.body }}>No jobs scheduled for today.</Text>
        ) : (
          jobs.map((j) => {
            const em = j.urgency === 'emergency'
            return (
              <Pressable
                key={j.id}
                onPress={() => router.push(`/(main)/job/${j.id}`)}
                style={[
                  styles.jobCard,
                  {
                    borderColor: em ? colors.urgent : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <View style={styles.jobTop}>
                  <Text style={[em ? styles.jobTitleEm : styles.jobTitle, { color: colors.text }]} numberOfLines={2}>
                    {j.customers?.address ?? j.title}
                  </Text>
                  <UrgencyBadge urgency={j.urgency} />
                </View>
                <Text style={[styles.jobType, { color: colors.muted }]}>{j.job_type}</Text>
                <Text style={[styles.jobTime, { color: colors.text }]}>{formatTime(j.scheduled_at)}</Text>
              </Pressable>
            )
          })
        )}

      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, paddingHorizontal: layout.pad },
  blocked: { flex: 1, paddingHorizontal: layout.pad },
  blockedTitle: { fontSize: typography.title, fontWeight: '800' },
  blockedBody: { marginTop: 12, fontSize: typography.body, lineHeight: 24 },
  blockedBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: layout.radius,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: layout.tapMin,
    justifyContent: 'center',
  },
  blockedBtnText: { fontWeight: '800', fontSize: typography.body },
  banner: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  bannerTxt: { fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greet: { fontSize: 26, fontWeight: '800' },
  company: { marginTop: 4, fontSize: typography.small },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeTxt: { fontSize: typography.caption, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statCard: {
    flex: 1,
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { marginTop: 4, fontSize: 10, textAlign: 'center' },
  weekCard: {
    marginTop: 14,
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 14,
  },
  weekTitle: { fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  weekLine: { marginTop: 8, fontSize: typography.small },
  rankLine: { marginTop: 8, fontSize: typography.body, fontWeight: '800' },
  streakLine: { marginTop: 6, fontSize: typography.small },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, gap: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '70%', borderRadius: 4, minHeight: 4 },
  barLbl: { marginTop: 4, fontSize: 10, fontWeight: '700' },
  nextJob: {
    marginTop: 14,
    borderRadius: layout.radius,
    borderWidth: 2,
    padding: 14,
  },
  nextLbl: { fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  nextTitle: { marginTop: 6, fontSize: typography.body, fontWeight: '800' },
  shiftDur: { marginTop: 10, textAlign: 'center', fontSize: typography.body, fontWeight: '800' },
  bigClockBtn: {
    marginTop: 16,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  bigClockTxt: { color: '#fff', fontSize: 18, fontWeight: '900' },
  clockHint: { marginTop: 8, fontSize: typography.caption },
  section: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  jobCard: {
    borderRadius: layout.radius,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  jobTitle: { flex: 1, fontSize: typography.body, fontWeight: '700' },
  jobTitleEm: { flex: 1, fontSize: 20, fontWeight: '900' },
  jobType: { marginTop: 8, fontSize: typography.caption, textTransform: 'capitalize' },
  jobTime: { marginTop: 4, fontSize: typography.small, fontWeight: '600' },
})
