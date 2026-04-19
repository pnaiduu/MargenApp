import { MotiView } from 'moti'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../context/AuthContext'
import { useTechnician } from '../context/TechnicianContext'
import { supabase } from '../lib/supabase'
import type { RootStackParamList } from '../navigation/types'
import { colors, layout, typography } from '../theme'

type SessionRow = {
  id: string
  clock_in_at: string
  clock_out_at: string | null
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { signOut, user } = useAuth()
  const { technician } = useTechnician()
  const [company, setCompany] = useState<string | null>(null)
  const [completed, setCompleted] = useState(0)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])

  const load = useCallback(async () => {
    if (!technician) return
    const { data: prof } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('id', technician.owner_id)
      .maybeSingle()
    setCompany((prof as { company_name: string | null } | null)?.company_name ?? null)

    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technician.id)
      .eq('status', 'completed')

    setCompleted(count ?? 0)

    const { data: jobRows } = await supabase.from('jobs').select('id').eq('technician_id', technician.id)
    const jobIds = (jobRows ?? []).map((j) => j.id)
    let list: { rating: number | null }[] = []
    if (jobIds.length > 0) {
      const { data: ratings } = await supabase
        .from('job_customer_ratings')
        .select('rating')
        .in('job_id', jobIds)
        .not('submitted_at', 'is', null)
      list = (ratings ?? []) as { rating: number | null }[]
    }
    const nums = list.map((r) => r.rating).filter((n): n is number => n != null)
    if (nums.length === 0) setAvgRating(null)
    else setAvgRating(nums.reduce((a, b) => a + b, 0) / nums.length)

    const { data: sess } = await supabase
      .from('technician_clock_sessions')
      .select('id, clock_in_at, clock_out_at')
      .eq('technician_id', technician.id)
      .order('clock_in_at', { ascending: false })
      .limit(40)

    setSessions((sess ?? []) as SessionRow[])
  }, [technician])

  useEffect(() => {
    void load()
  }, [load])

  if (!technician) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>No technician profile.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 40, paddingTop: insets.top + 8 }}
    >
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 450 }}>
        <Text style={styles.name}>{technician.name}</Text>
        <Text style={styles.line}>{technician.role ?? 'Technician'}</Text>
        <Text style={styles.line}>{company ?? 'Company'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{completed}</Text>
            <Text style={styles.statLbl}>Jobs completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{avgRating != null ? avgRating.toFixed(1) : '—'}</Text>
            <Text style={styles.statLbl}>Avg. rating</Text>
          </View>
        </View>

        <Text style={styles.section}>Clock history</Text>
        {sessions.length === 0 ? (
          <Text style={styles.muted}>No sessions yet.</Text>
        ) : (
          sessions.map((s) => (
            <View key={s.id} style={styles.sess}>
              <Text style={styles.sessMain}>
                In {new Date(s.clock_in_at).toLocaleString()}
              </Text>
              <Text style={styles.sessSub}>
                {s.clock_out_at ? `Out ${new Date(s.clock_out_at).toLocaleString()}` : 'Open shift'}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.section}>Privacy</Text>
        <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('LocationHistory')}>
          <Text style={styles.linkTxt}>Today’s location history</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={() => navigation.navigate('PrivacyPolicy')}>
          <Text style={styles.linkTxt}>Privacy policy</Text>
        </Pressable>

        <Pressable style={styles.out} onPress={() => void signOut()}>
          <Text style={styles.outTxt}>Sign out</Text>
        </Pressable>
      </MotiView>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  muted: { color: colors.muted, fontSize: typography.body },
  name: { fontSize: 26, fontWeight: '800', color: colors.text },
  line: { marginTop: 4, fontSize: typography.body, color: colors.muted },
  email: { marginTop: 8, fontSize: typography.small, color: colors.muted },
  stats: { flexDirection: 'row', gap: 12, marginTop: 24 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  statNum: { fontSize: 28, fontWeight: '800', color: colors.text },
  statLbl: { marginTop: 4, fontSize: typography.caption, color: colors.muted },
  section: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  sess: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessMain: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  sessSub: { color: colors.muted, fontSize: typography.small, marginTop: 4 },
  linkBtn: {
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  linkTxt: { color: colors.text, fontWeight: '700', fontSize: typography.body },
  out: {
    marginTop: 32,
    minHeight: layout.tapMin,
    borderRadius: layout.radius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  outTxt: { color: colors.danger, fontWeight: '800', fontSize: typography.body },
})
