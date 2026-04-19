import type { EventDropArg } from '@fullcalendar/core'
import type { EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import { addHoursIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'

type JobCalRow = {
  id: string
  title: string
  scheduled_at: string
  technicians: { map_color: string | null } | null
}

function normalizeHex(hex: string | null | undefined) {
  if (!hex) return '#6b7280'
  const h = hex.trim()
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return h
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  return '#6b7280'
}

function scheduledJobsQuery(ownerId: string, signal: AbortSignal) {
  return supabase
    .from('jobs')
    .select('id, title, scheduled_at, technicians(map_color)')
    .eq('owner_id', ownerId)
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
    .abortSignal(signal)
}

export function SchedulePage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobCalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await scheduledJobsQuery(ownerId, ac.signal)
        if (ac.signal.aborted) return
        if (qErr) {
          setError(qErr.message)
          setJobs([])
        } else {
          setJobs((data ?? []) as JobCalRow[])
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user])

  const events = useMemo<EventInput[]>(
    () =>
      jobs.map((j) => {
        const color = normalizeHex(j.technicians?.map_color ?? null)
        return {
          id: j.id,
          title: j.title,
          start: j.scheduled_at,
          end: addHoursIso(j.scheduled_at, 2),
          backgroundColor: color,
          borderColor: color,
          textColor: '#ffffff',
        }
      }),
    [jobs],
  )

  async function handleEventDrop(info: EventDropArg) {
    if (!user) return
    const start = info.event.start
    if (!start) {
      info.revert()
      return
    }
    const newIso = start.toISOString()
    const { error: upErr } = await supabase
      .from('jobs')
      .update({ scheduled_at: newIso })
      .eq('id', info.event.id)
      .eq('owner_id', user.id)
    if (upErr) {
      info.revert()
      setError(upErr.message)
      return
    }
    const { data, error: qErr } = await scheduledJobsQuery(user.id, new AbortController().signal)
    if (qErr) {
      setError(qErr.message)
    } else {
      setJobs((data ?? []) as JobCalRow[])
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Schedule</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">
          Jobs by day. Drag an event to reschedule; colors follow each technician.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="err"
            className="mb-4 text-sm text-danger"
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
        <motion.div
          className="flex min-h-[320px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm text-[var(--color-margen-muted)]">Loading schedule…</p>
        </motion.div>
      ) : (
        <div className="schedule-calendar overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-2 sm:p-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek',
            }}
            height="auto"
            editable
            eventDurationEditable={false}
            events={events}
            eventDrop={handleEventDrop}
            dayMaxEvents
            nowIndicator
          />
        </div>
      )}
    </div>
  )
}
