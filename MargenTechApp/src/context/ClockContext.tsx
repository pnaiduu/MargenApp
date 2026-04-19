import * as Location from 'expo-location'
import NetInfo from '@react-native-community/netinfo'
import * as Notifications from 'expo-notifications'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { useTechnician } from './TechnicianContext'
import { enqueueOp, flushQueue, type QueuedOperation } from '../lib/offlineQueue'
import { supabase } from '../lib/supabase'

type ClockCtx = {
  isClockedIn: boolean
  activeSessionId: string | null
  isSyncing: boolean
  clockIn: () => Promise<void>
  clockOut: () => Promise<void>
}

const Ctx = createContext<ClockCtx | null>(null)

async function processQueueOp(op: QueuedOperation, context: { technicianId: string | null }) {
  if (op.kind === 'technician_patch') {
    const { error } = await supabase.from('technicians').update(op.patch).eq('id', op.technicianId)
    if (error) throw error
  }
  if (op.kind === 'job_patch') {
    // Conflict detection: if job was reassigned while offline, don't apply stale patch.
    if (op.expectedTechnicianId) {
      const { data: remote } = await supabase.from('jobs').select('technician_id, title').eq('id', op.jobId).maybeSingle()
      const remoteTech = (remote as { technician_id: string | null } | null)?.technician_id ?? null
      if (remoteTech && remoteTech !== op.expectedTechnicianId) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Job changed while you were offline',
            body: 'This job was reassigned. Your offline updates were not applied.',
          },
          trigger: null,
        })
        return
      }
    }
    const { error } = await supabase.from('jobs').update(op.patch).eq('id', op.jobId)
    if (error) throw error
  }
  if (op.kind === 'clock_in') {
    const { error } = await supabase.from('technician_clock_sessions').insert({
      technician_id: op.technicianId,
      owner_id: op.ownerId,
    })
    if (error) throw error
  }
  if (op.kind === 'clock_out') {
    const { error } = await supabase
      .from('technician_clock_sessions')
      .update({ clock_out_at: new Date().toISOString() })
      .eq('id', op.sessionId)
    if (error) throw error
  }
  if (op.kind === 'clock_out_open') {
    const { data: row } = await supabase
      .from('technician_clock_sessions')
      .select('id')
      .eq('technician_id', op.technicianId)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (row?.id) {
      const { error } = await supabase
        .from('technician_clock_sessions')
        .update({ clock_out_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
    }
  }
}

export function ClockProvider({ children }: { children: ReactNode }) {
  const { configured } = useAuth()
  const { technician } = useTechnician()
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pushLocation = useCallback(async () => {
    if (!technician || !configured) return
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const patch = {
      last_lat: loc.coords.latitude,
      last_lng: loc.coords.longitude,
      last_location_at: new Date().toISOString(),
    }
    const state = await NetInfo.fetch()
    if (!state.isConnected) {
      await enqueueOp({ kind: 'technician_patch', technicianId: technician.id, patch })
      return
    }
    const { error } = await supabase.from('technicians').update(patch).eq('id', technician.id)
    if (error) await enqueueOp({ kind: 'technician_patch', technicianId: technician.id, patch })

    // Location history for technician (today). Owner does not have access via RLS.
    try {
      await supabase.from('technician_location_events').insert({
        owner_id: technician.owner_id,
        technician_id: technician.id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      })
    } catch {
      // ignore (privacy rules / offline / transient)
    }
  }, [configured, technician])

  const stopLocationInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startLocationInterval = useCallback(() => {
    stopLocationInterval()
    void pushLocation()
    intervalRef.current = setInterval(() => void pushLocation(), 60_000)
  }, [pushLocation, stopLocationInterval])

  useEffect(() => {
    if (!isClockedIn) {
      stopLocationInterval()
      return
    }
    startLocationInterval()
    return () => stopLocationInterval()
  }, [isClockedIn, startLocationInterval, stopLocationInterval])

  const loadOpenSession = useCallback(async () => {
    if (!technician || !configured) {
      setIsClockedIn(false)
      setActiveSessionId(null)
      return
    }
    const { data } = await supabase
      .from('technician_clock_sessions')
      .select('id')
      .eq('technician_id', technician.id)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.id) {
      setActiveSessionId(data.id)
      setIsClockedIn(true)
    } else {
      setActiveSessionId(null)
      setIsClockedIn(false)
    }
  }, [configured, technician])

  useEffect(() => {
    void loadOpenSession()
  }, [loadOpenSession])

  useEffect(() => {
    void NetInfo.fetch().then((s) => {
      if (s.isConnected) {
        setIsSyncing(true)
        void flushQueue((op) => processQueueOp(op, { technicianId: technician?.id ?? null })).finally(() =>
          setIsSyncing(false),
        )
      }
    })
    const unsub = NetInfo.addEventListener((s) => {
      if (s.isConnected) {
        setIsSyncing(true)
        void flushQueue((op) => processQueueOp(op, { technicianId: technician?.id ?? null })).finally(() =>
          setIsSyncing(false),
        )
      }
    })
    return () => unsub()
  }, [technician?.id])

  const clockIn = useCallback(async () => {
    if (!technician) return
    const state = await NetInfo.fetch()
    if (!state.isConnected) {
      await enqueueOp({ kind: 'clock_in', technicianId: technician.id, ownerId: technician.owner_id })
      await enqueueOp({ kind: 'technician_patch', technicianId: technician.id, patch: { status: 'available' } })
      setIsClockedIn(true)
      setActiveSessionId('local-pending')
      return
    }
    const { data, error } = await supabase
      .from('technician_clock_sessions')
      .insert({ technician_id: technician.id, owner_id: technician.owner_id })
      .select('id')
      .single()
    if (error) throw error
    await supabase.from('technicians').update({ status: 'available' }).eq('id', technician.id)
    setActiveSessionId(data.id)
    setIsClockedIn(true)
  }, [technician])

  const clockOut = useCallback(async () => {
    stopLocationInterval()
    if (!technician) return
    const state = await NetInfo.fetch()
    if (!state.isConnected) {
      if (activeSessionId && activeSessionId !== 'local-pending') {
        await enqueueOp({ kind: 'clock_out', sessionId: activeSessionId })
      } else {
        await enqueueOp({ kind: 'clock_out_open', technicianId: technician.id })
      }
      await enqueueOp({ kind: 'technician_patch', technicianId: technician.id, patch: { status: 'off_duty' } })
      setIsClockedIn(false)
      setActiveSessionId(null)
      return
    }
    if (activeSessionId === 'local-pending') {
      await flushQueue((op) => processQueueOp(op, { technicianId: technician.id }))
      const { data: row } = await supabase
        .from('technician_clock_sessions')
        .select('id')
        .eq('technician_id', technician.id)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (row?.id) {
        await supabase
          .from('technician_clock_sessions')
          .update({ clock_out_at: new Date().toISOString() })
          .eq('id', row.id)
      }
      setIsClockedIn(false)
      setActiveSessionId(null)
      return
    }
    const sid = activeSessionId
    if (!sid) {
      setIsClockedIn(false)
      setActiveSessionId(null)
      return
    }
    const { error } = await supabase
      .from('technician_clock_sessions')
      .update({ clock_out_at: new Date().toISOString() })
      .eq('id', sid)
    if (error) {
      await enqueueOp({ kind: 'clock_out', sessionId: sid })
    }
    await supabase.from('technicians').update({ status: 'off_duty' }).eq('id', technician.id)
    setIsClockedIn(false)
    setActiveSessionId(null)
  }, [activeSessionId, loadOpenSession, stopLocationInterval, technician])

  const value = useMemo(
    () => ({ isClockedIn, activeSessionId, isSyncing, clockIn, clockOut }),
    [isClockedIn, activeSessionId, isSyncing, clockIn, clockOut],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useClock() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useClock outside ClockProvider')
  return v
}
