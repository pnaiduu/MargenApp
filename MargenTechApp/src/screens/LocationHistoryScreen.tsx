import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTechnician } from '../context/TechnicianContext'
import { supabase } from '../lib/supabase'
import { colors, layout, typography } from '../theme'

type LocRow = {
  id: string
  recorded_at: string
  lat: number
  lng: number
}

function todayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function LocationHistoryScreen() {
  const insets = useSafeAreaInsets()
  const { technician } = useTechnician()
  const [rows, setRows] = useState<LocRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { startIso, endIso } = useMemo(() => todayIsoRange(), [])

  useEffect(() => {
    if (!technician) return
    const techId = technician.id
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: qErr } = await supabase
        .from('technician_location_events')
        .select('id, recorded_at, lat, lng')
        .eq('technician_id', techId)
        .gte('recorded_at', startIso)
        .lte('recorded_at', endIso)
        .order('recorded_at', { ascending: false })
        .limit(500)
      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setRows([])
      } else {
        setRows((data ?? []) as LocRow[])
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [technician, startIso, endIso])

  if (!technician) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingHorizontal: layout.pad }]}>
        <Text style={styles.muted}>No technician profile.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32, paddingTop: insets.top + 12 }}
    >
      <Text style={styles.title}>Today’s location history</Text>
      <Text style={styles.sub}>Visible only to you. Updates are recorded about every 60 seconds while clocked in.</Text>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>No location points recorded today.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.rowMain}>{new Date(r.recorded_at).toLocaleTimeString()}</Text>
            <Text style={styles.rowSub}>
              {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { marginTop: 8, color: colors.muted, fontSize: typography.small, lineHeight: 20 },
  muted: { marginTop: 18, color: colors.muted, fontSize: typography.body },
  err: { marginTop: 12, color: colors.danger, fontSize: typography.body },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { color: colors.text, fontSize: typography.body, fontWeight: '700' },
  rowSub: { marginTop: 4, color: colors.muted, fontSize: typography.small },
})

