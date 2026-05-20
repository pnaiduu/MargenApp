import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTechnician } from '../context/TechnicianContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { layout, typography } from '../theme'

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
  const { colors } = useTheme()
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
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingHorizontal: layout.pad, backgroundColor: colors.page }]}>
        <Text style={{ color: colors.muted }}>No technician profile.</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.page }]}
      contentContainerStyle={{ padding: layout.pad, paddingBottom: insets.bottom + 32, paddingTop: 12 }}
    >
      <Text style={[styles.title, { color: colors.text }]}>Today&apos;s location history</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>
        Visible only to you. Updates are recorded about every 60 seconds while clocked in.
      </Text>

      {error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {loading ? (
        <Text style={{ color: colors.muted, marginTop: 16 }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: colors.muted, marginTop: 16 }}>No location points recorded today.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowMain, { color: colors.text }]}>{new Date(r.recorded_at).toLocaleTimeString()}</Text>
            <Text style={[styles.rowSub, { color: colors.muted }]}>
              {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

export default LocationHistoryScreen

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: typography.small, lineHeight: 20 },
  err: { marginTop: 12, fontSize: typography.body },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowMain: { fontSize: typography.body, fontWeight: '700' },
  rowSub: { marginTop: 4, fontSize: typography.small },
})
