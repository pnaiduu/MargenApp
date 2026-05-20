import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, type LatLng } from 'react-native-maps'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTechnician } from '../../context/TechnicianContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { layout, typography } from '../../theme'
import type { JobRow } from '../../types/job'

function localDayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export default function MapTabScreen() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const { technician } = useTechnician()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [me, setMe] = useState<LatLng | null>(null)
  const [selected, setSelected] = useState<JobRow | null>(null)

  const load = useCallback(async () => {
    if (!technician) return
    const { startIso, endIso } = localDayIsoRange()
    const { data } = await supabase
      .from('jobs')
      .select(
        'id, title, job_type, urgency, status, field_status, scheduled_at, customers ( name, address, lat, lng )',
      )
      .eq('technician_id', technician.id)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
    setJobs((data as unknown as JobRow[]) ?? [])
  }, [technician])

  useEffect(() => {
    void load()
  }, [load])

  useFocusEffect(
    useCallback(() => {
      let alive = true
      ;(async () => {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted' || !alive) return
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (!alive) return
        setMe({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      })()
      return () => {
        alive = false
      }
    }, []),
  )

  const coords = useMemo(() => {
    const pts: LatLng[] = []
    for (const j of jobs) {
      const lat = j.customers?.lat
      const lng = j.customers?.lng
      if (lat != null && lng != null) pts.push({ latitude: lat, longitude: lng })
    }
    return pts
  }, [jobs])

  const region = useMemo(() => {
    const all = me ? [...coords, me] : coords
    if (all.length === 0) {
      return { latitude: 39.8283, longitude: -98.5795, latitudeDelta: 25, longitudeDelta: 25 }
    }
    const lats = all.map((c) => c.latitude)
    const lngs = all.map((c) => c.longitude)
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
  }, [coords, me])

  const nextJob = useMemo(() => {
    for (const j of jobs) {
      const lat = j.customers?.lat
      const lng = j.customers?.lng
      const addr = j.customers?.address
      if (lat != null && lng != null && addr) return j
    }
    return jobs[0] ?? null
  }, [jobs])

  function openNavigate() {
    const addr = nextJob?.customers?.address
    if (!addr) return
    const q = encodeURIComponent(addr)
    const url = `http://maps.apple.com/?daddr=${q}`
    void Linking.openURL(url)
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.page, paddingTop: insets.top }]}>
      <MapView style={styles.map} initialRegion={region} region={region}>
        {coords.map((c, i) => {
          const j = jobs[i]
          return (
            <Marker
              key={j?.id ?? `${i}`}
              coordinate={c}
              title={`${i + 1}`}
              onPress={() => j && setSelected(j)}
            >
              <View style={[styles.pin, { backgroundColor: colors.accent }]}>
                <Text style={[styles.pinTxt, { color: colors.accentFg }]}>{i + 1}</Text>
              </View>
            </Marker>
          )
        })}
        {me ? (
          <Marker coordinate={me} title="You">
            <View style={[styles.me, { borderColor: colors.accent }]} />
          </Marker>
        ) : null}
        {coords.length > 1 ? <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={3} /> : null}
      </MapView>

      <Pressable
        onPress={openNavigate}
        disabled={!nextJob?.customers?.address}
        style={[
          styles.navBtn,
          {
            backgroundColor: colors.accent,
            bottom: insets.bottom + (selected ? 120 : 20),
            minHeight: layout.tapMin,
            opacity: nextJob?.customers?.address ? 1 : 0.5,
          },
        ]}
      >
        <Ionicons name="navigate" size={22} color={colors.accentFg} />
        <Text style={[styles.navTxt, { color: colors.accentFg }]}>Navigate to next job</Text>
      </Pressable>

      {selected ? (
        <View
          style={[
            styles.sheet,
            {
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{selected.title}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{selected.customers?.address ?? ''}</Text>
          <Pressable
            onPress={() => router.push(`/(main)/job/${selected.id}`)}
            style={[styles.openJob, { borderColor: colors.border, minHeight: layout.tapMin }]}
          >
            <Text style={{ color: colors.accent, fontWeight: '800' }}>Open job</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTxt: { fontWeight: '900', fontSize: 14 },
  me: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    borderWidth: 2,
  },
  navBtn: {
    position: 'absolute',
    left: layout.pad,
    right: layout.pad,
    borderRadius: layout.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  navTxt: { fontSize: typography.body, fontWeight: '800' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: layout.pad,
  },
  sheetTitle: { fontSize: typography.title, fontWeight: '800' },
  openJob: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
