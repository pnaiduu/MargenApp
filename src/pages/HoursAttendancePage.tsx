import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import { localWeekRangeIso } from '../lib/dates'
import { easePremium } from '../lib/motion'
import { supabase } from '../lib/supabase'

type Tech = { id: string; name: string }
type Session = { technician_id: string; clock_in_at: string; clock_out_at: string | null }

function hoursBetween(startIso: string, endIso: string) {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 36e5
}

export function HoursAttendancePage() {
  const { user } = useAuth()
  const [techs, setTechs] = useState<Tech[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { startIso: weekStart, endIso: weekEnd } = useMemo(() => localWeekRangeIso(), [])

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const s = ac.signal
        const techQ = supabase.from('technicians').select('id, name').eq('owner_id', ownerId).order('name').abortSignal(s)
        const sessQ = supabase
          .from('technician_clock_sessions')
          .select('technician_id, clock_in_at, clock_out_at')
          .eq('owner_id', ownerId)
          .gte('clock_in_at', weekStart)
          .lte('clock_in_at', weekEnd)
          .abortSignal(s)
        const [tRes, sRes] = await Promise.all([techQ, sessQ])
        if (ac.signal.aborted) return
        if (tRes.error) setError(tRes.error.message)
        setTechs((tRes.data ?? []) as Tech[])
        if (sRes.error) setError(sRes.error.message)
        setSessions((sRes.data ?? []) as Session[])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => {
      ac.abort()
    }
  }, [user, weekStart, weekEnd])

  const byTech = useMemo(() => {
    const now = new Date().toISOString()
    const map = new Map<string, { hours: number; lateDays: number; absenceDays: number }>()
    for (const t of techs) map.set(t.id, { hours: 0, lateDays: 0, absenceDays: 0 })

    // Build per-day first clock-in for late/absence flags (Mon-Fri).
    const days: { start: Date; end: Date; key: string }[] = []
    const ws = new Date(weekStart)
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws)
      d.setDate(ws.getDate() + i)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
      days.push({ start, end, key: start.toISOString().slice(0, 10) })
    }

    const sessionsByTech = new Map<string, Session[]>()
    for (const s of sessions) {
      const arr = sessionsByTech.get(s.technician_id) ?? []
      arr.push(s)
      sessionsByTech.set(s.technician_id, arr)
    }

    for (const t of techs) {
      const arr = sessionsByTech.get(t.id) ?? []
      let total = 0
      for (const s of arr) {
        total += hoursBetween(s.clock_in_at, s.clock_out_at ?? now)
      }
      const stats = map.get(t.id)!
      stats.hours = total

      // Late/absence flags (heuristics): late if first clock-in after 9:15am local; absence if no clock-in on weekday.
      for (const d of days) {
        const dayOfWeek = d.start.getDay() // 0 Sun
        if (dayOfWeek === 0 || dayOfWeek === 6) continue
        const daySessions = arr.filter((s) => {
          const ts = new Date(s.clock_in_at).getTime()
          return ts >= d.start.getTime() && ts <= d.end.getTime()
        })
        if (daySessions.length === 0) {
          stats.absenceDays += 1
          continue
        }
        daySessions.sort((a, b) => new Date(a.clock_in_at).getTime() - new Date(b.clock_in_at).getTime())
        const first = new Date(daySessions[0]!.clock_in_at)
        const lateCutoff = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 9, 15, 0, 0)
        if (first.getTime() > lateCutoff.getTime()) stats.lateDays += 1
      }
    }

    return map
  }, [sessions, techs, weekStart])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Hours &amp; Attendance</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">Weekly hours and basic attendance flags.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="err"
            className="text-sm text-danger"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.22, ease: easePremium }}
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <p className="text-sm text-[var(--color-margen-muted)]">Loading hours…</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <div className="grid grid-cols-12 gap-3 border-b border-[var(--color-margen-border)] px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            <div className="col-span-4">Technician</div>
            <div className="col-span-3 text-right">Hours this week</div>
            <div className="col-span-2 text-right">Late days</div>
            <div className="col-span-3 text-right">Absence days</div>
          </div>
          <ul className="divide-y divide-[var(--color-margen-border)]">
            {techs.map((t) => {
              const s = byTech.get(t.id) ?? { hours: 0, lateDays: 0, absenceDays: 0 }
              return (
                <li key={t.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                  <div className="col-span-4 font-medium text-[var(--color-margen-text)]">{t.name}</div>
                  <div className="col-span-3 text-right font-semibold tabular-nums text-[var(--color-margen-text)]">
                    {s.hours.toFixed(1)}
                  </div>
                  <div className="col-span-2 text-right tabular-nums">
                    <span className={s.lateDays ? 'text-late-strong font-medium' : 'text-[var(--color-margen-muted)]'}>
                      {s.lateDays}
                    </span>
                  </div>
                  <div className="col-span-3 text-right tabular-nums">
                    <span className={s.absenceDays ? 'text-absence-strong font-medium' : 'text-[var(--color-margen-muted)]'}>
                      {s.absenceDays}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-[var(--color-margen-border)] px-4 py-3 text-xs text-[var(--color-margen-muted)]">
            Late = first clock-in after 9:15am (local). Absence = no clock-in on a weekday (Mon–Fri).
          </div>
        </div>
      )}
    </div>
  )
}

