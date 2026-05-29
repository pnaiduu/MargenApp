import { useCallback, useEffect, useMemo, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../context/AuthContext'
import { useTechnician } from '../../context/TechnicianContext'
import { useTheme } from '../../context/ThemeContext'
import { enqueueOp } from '../../lib/offlineQueue'
import { supabase } from '../../lib/supabase'
import { fetchTechnicianProfileStats, type TechProfileStats } from '../../lib/technicianStats'
import { layout, typography } from '../../theme'

type SessionRow = {
  id: string
  clock_in_at: string
  clock_out_at: string | null
}

const statusOptions = [
  { key: 'available', label: 'Available' },
  { key: 'busy', label: 'Busy' },
  { key: 'off_duty', label: 'Off duty' },
] as const

function startOfLocalDay() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
}

function Skeleton({ colors }: { colors: { surfaceMuted: string; border: string } }) {
  return (
    <View
      style={{
        height: 120,
        borderRadius: layout.radius,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: 16,
      }}
    />
  )
}

export default function ProfileTabScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { signOut, user } = useAuth()
  const { technician, refresh: refreshTech } = useTechnician()
  const [company, setCompany] = useState<string | null>(null)
  const [profileStats, setProfileStats] = useState<TechProfileStats | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [hoursTodayMs, setHoursTodayMs] = useState(0)

  const load = useCallback(async () => {
    if (!technician) return
    setLoadingProfile(true)
    const { data: prof } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', technician.owner_id)
      .maybeSingle()
    setCompany((prof as { company_name: string | null } | null)?.company_name ?? null)

    try {
      const stats = await fetchTechnicianProfileStats(technician.id)
      setProfileStats(stats)
    } finally {
      setLoadingProfile(false)
    }

    const { data: sess } = await supabase
      .from('technician_clock_sessions')
      .select('id, clock_in_at, clock_out_at')
      .eq('technician_id', technician.id)
      .order('clock_in_at', { ascending: false })
      .limit(40)

    const all = (sess ?? []) as SessionRow[]
    setSessions(all)

    const day0 = startOfLocalDay()
    let ms = 0
    for (const s of all) {
      const inT = new Date(s.clock_in_at).getTime()
      if (inT < day0) continue
      const outT = s.clock_out_at ? new Date(s.clock_out_at).getTime() : Date.now()
      ms += Math.max(0, outT - inT)
    }
    setHoursTodayMs(ms)
  }, [technician])

  useEffect(() => {
    void load()
  }, [load])

  const hoursTodayLabel = useMemo(() => {
    const h = hoursTodayMs / 3600000
    if (h < 0.05) return '0h'
    return `${h.toFixed(1)}h`
  }, [hoursTodayMs])

  const sessionsToday = useMemo(() => {
    const day0 = startOfLocalDay()
    return sessions.filter((s) => new Date(s.clock_in_at).getTime() >= day0)
  }, [sessions])

  const maxMonthJobs = useMemo(() => {
    if (!profileStats) return 1
    return Math.max(1, ...profileStats.jobsPerMonth.map((m) => m.count))
  }, [profileStats])

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

  if (!technician) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24, backgroundColor: colors.page }]}>
        <Text style={{ color: colors.muted }}>No technician profile.</Text>
      </View>
    )
  }

  const initials = technician.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.page }]}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 40, paddingTop: insets.top + 8 }}
    >
      <View>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarTxt, { color: colors.accentFg }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{technician.name}</Text>
        <Text style={[styles.line, { color: colors.muted }]}>{technician.role ?? 'Technician'}</Text>
        <Text style={[styles.line, { color: colors.muted }]}>{company ?? 'Company'}</Text>
        <Text style={[styles.email, { color: colors.muted2 }]}>{user?.email}</Text>

        {loadingProfile ? (
          <Skeleton colors={colors} />
        ) : profileStats ? (
          <>
            <Text style={[styles.section, { color: colors.muted }]}>All-time</Text>
            <View style={styles.stats}>
              <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{profileStats.totalJobs}</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Total jobs</Text>
              </View>
              <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>{profileStats.totalHours}h</Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Total hours</Text>
              </View>
              <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.statNum, { color: colors.text }]}>
                  {profileStats.avgRating != null ? profileStats.avgRating.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.statLbl, { color: colors.muted }]}>Avg. rating</Text>
              </View>
            </View>

            <Text style={[styles.section, { color: colors.muted }]}>Monthly jobs</Text>
            <View style={[styles.chartCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {profileStats.jobsPerMonth.every((m) => m.count === 0) ? (
                <Text style={{ color: colors.muted }}>No jobs completed yet.</Text>
              ) : (
                <View style={styles.barRow}>
                  {profileStats.jobsPerMonth.map((m) => {
                    const h = Math.max(4, (m.count / maxMonthJobs) * 64)
                    return (
                      <View key={m.label} style={styles.barCol}>
                        <Text style={[styles.barCount, { color: colors.text }]}>{m.count}</Text>
                        <View style={[styles.bar, { height: h, backgroundColor: colors.accent }]} />
                        <Text style={[styles.barLbl, { color: colors.muted2 }]}>{m.label}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>

            <Text style={[styles.section, { color: colors.muted }]}>Badges</Text>
            {profileStats.badges.length === 0 ? (
              <Text style={{ color: colors.muted }}>Complete jobs to earn badges.</Text>
            ) : (
              <View style={styles.badgeWrap}>
                {profileStats.badges.map((b) => (
                  <View key={b} style={[styles.badgePill, { borderColor: colors.accent, backgroundColor: colors.surfaceMuted }]}>
                    <Text style={{ color: colors.accent, fontWeight: '800', fontSize: typography.caption }}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.section, { color: colors.muted }]}>Recent jobs</Text>
            {profileStats.recentJobs.length === 0 ? (
              <Text style={{ color: colors.muted }}>No completed jobs yet.</Text>
            ) : (
              profileStats.recentJobs.map((j) => (
                <Pressable
                  key={j.id}
                  onPress={() => router.push(`/(main)/job/${j.id}`)}
                  style={[styles.jobRow, { borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.jobTitle, { color: colors.text }]} numberOfLines={1}>
                    {j.title}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: typography.small, marginTop: 4 }}>
                    {j.status}
                    {j.rating != null ? ` · ${j.rating}★` : ''}
                    {j.completedAt
                      ? ` · ${new Date(j.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                      : ''}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        ) : null}

        <View style={[styles.stat, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 20 }]}>
          <Text style={[styles.statNum, { color: colors.text }]}>{hoursTodayLabel}</Text>
          <Text style={[styles.statLbl, { color: colors.muted }]}>Hours today</Text>
        </View>

        <Text style={[styles.section, { color: colors.muted }]}>Availability</Text>
        <View style={styles.toggleRow}>
          {statusOptions.map((o) => {
            const active = technician.status === o.key
            return (
              <Pressable
                key={o.key}
                onPress={() => void setTechStatus(o.key)}
                style={[
                  styles.toggleBtn,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.surfaceMuted : colors.surface,
                    minHeight: layout.tapMin,
                  },
                ]}
              >
                <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '800' }}>{o.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={[styles.section, { color: colors.muted }]}>Clock in/out today</Text>
        {sessionsToday.length === 0 ? (
          <Text style={{ color: colors.muted }}>No clock sessions yet today.</Text>
        ) : (
          sessionsToday.map((s) => (
            <View key={s.id} style={[styles.sess, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sessMain, { color: colors.text }]}>
                In {new Date(s.clock_in_at).toLocaleTimeString()}
              </Text>
              <Text style={[styles.sessSub, { color: colors.muted }]}>
                {s.clock_out_at ? `Out ${new Date(s.clock_out_at).toLocaleTimeString()}` : 'On shift'}
              </Text>
            </View>
          ))
        )}

        <Text style={[styles.section, { color: colors.muted }]}>Privacy</Text>
        <Text style={[styles.privacy, { color: colors.muted }]}>
          Location is only shared while clocked in.
        </Text>
        <Pressable
          style={[styles.linkBtn, { borderColor: colors.border, backgroundColor: colors.surface, minHeight: layout.tapMin }]}
          onPress={() => router.push('/(main)/location-history')}
        >
          <Text style={[styles.linkTxt, { color: colors.text }]}>Today&apos;s location history</Text>
        </Pressable>
        <Pressable
          style={[styles.linkBtn, { borderColor: colors.border, backgroundColor: colors.surface, minHeight: layout.tapMin }]}
          onPress={() => router.push('/(main)/privacy')}
        >
          <Text style={[styles.linkTxt, { color: colors.text }]}>Privacy policy</Text>
        </Pressable>

        <Pressable
          style={[styles.out, { borderColor: colors.border, backgroundColor: colors.surface, minHeight: layout.tapMin }]}
          onPress={() => void signOut()}
        >
          <Text style={[styles.outTxt, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  avatarTxt: { fontSize: 28, fontWeight: '900' },
  name: { marginTop: 16, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  line: { marginTop: 4, fontSize: typography.body, textAlign: 'center' },
  email: { marginTop: 8, fontSize: typography.small, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stat: {
    flex: 1,
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { marginTop: 4, fontSize: 11, textAlign: 'center' },
  chartCard: {
    borderRadius: layout.radius,
    borderWidth: 1,
    padding: 14,
  },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  barCount: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bar: { width: '70%', borderRadius: 4, minHeight: 4 },
  barLbl: { marginTop: 4, fontSize: 10, fontWeight: '700' },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  jobRow: { paddingVertical: 12, borderBottomWidth: 1 },
  jobTitle: { fontSize: typography.body, fontWeight: '700' },
  section: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    borderRadius: layout.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sess: { paddingVertical: 12, borderBottomWidth: 1 },
  sessMain: { fontSize: typography.body, fontWeight: '600' },
  sessSub: { fontSize: typography.small, marginTop: 4 },
  privacy: { fontSize: typography.small, lineHeight: 22, marginBottom: 8 },
  linkBtn: {
    borderRadius: layout.radius,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  linkTxt: { fontWeight: '700', fontSize: typography.body },
  out: {
    marginTop: 28,
    borderRadius: layout.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outTxt: { fontWeight: '800', fontSize: typography.body },
})
