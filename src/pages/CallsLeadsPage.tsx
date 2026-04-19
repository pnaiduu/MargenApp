import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import { approveDraftJobDirect, callCallbackDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'
import type { PhoneCallStatus } from '../types/database'

type CallRow = {
  id: string
  caller_phone: string | null
  occurred_at: string
  status: PhoneCallStatus
  estimated_value_cents: number
  duration_seconds?: number | null
  ai_handled?: boolean
  transcript?: string | null
  collected?: unknown
  converted_job_id?: string | null
}

const statusLabel: Record<PhoneCallStatus, string> = {
  in_progress: 'In progress',
  answered: 'Answered',
  missed: 'Missed',
  called_back: 'Called back',
  converted: 'Converted',
}

function StatusPill({ status }: { status: PhoneCallStatus }) {
  const cls =
    status === 'answered'
      ? 'badge-neutral'
      : status === 'called_back' || status === 'converted'
        ? 'badge-completed'
        : status === 'in_progress'
          ? 'badge-info'
          : 'badge-pending'

  return (
    <span className={cls}>
      {statusLabel[status]}
    </span>
  )
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function CallsLeadsPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CallRow[]>([])
  const [draftJobsByCallId, setDraftJobsByCallId] = useState<Record<string, { id: string; title: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'missed' | 'answered' | 'converted'>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openRow, setOpenRow] = useState<CallRow | null>(null)
  const [callsRefresh, setCallsRefresh] = useState(0)

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('phone_calls')
          .select('id, caller_phone, occurred_at, status, estimated_value_cents, duration_seconds, ai_handled, transcript, collected, converted_job_id')
          .eq('owner_id', ownerId)
          .order('occurred_at', { ascending: false })
          .limit(300)
          .abortSignal(ac.signal)

        if (ac.signal.aborted) return
        if (qErr) {
          setError(qErr.message)
          setRows([])
        } else {
          setRows((data ?? []) as CallRow[])
        }

        const callIds = (data ?? []).map((r) => (r as { id: string }).id)
        if (!callIds.length) {
          setDraftJobsByCallId({})
        } else {
          const { data: jobs } = await supabase
            .from('jobs')
            .select('id, title, source_phone_call_id')
            .eq('owner_id', ownerId)
            .eq('needs_approval', true)
            .in('source_phone_call_id', callIds)
            .limit(300)
            .abortSignal(ac.signal)
          if (ac.signal.aborted) return
          const map: Record<string, { id: string; title: string }> = {}
          for (const j of (jobs ?? []) as { id: string; title: string; source_phone_call_id: string | null }[]) {
            if (j.source_phone_call_id) map[j.source_phone_call_id] = { id: j.id, title: j.title }
          }
          setDraftJobsByCallId(map)
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user, callsRefresh])

  const filtered = rows.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'missed') return r.status === 'missed'
    if (filter === 'answered') return r.status === 'answered'
    return r.status === 'converted' || Boolean(r.converted_job_id) || Boolean(draftJobsByCallId[r.id])
  })

  async function callback(row: CallRow) {
    if (!user) return
    setBusyId(row.id)
    setError(null)
    const { error: fnErr } = await callCallbackDirect(supabase, user.id, row.id)
    if (fnErr) setError(fnErr.message)
    else {
      setRows((prev) => prev.map((p) => (p.id === row.id ? { ...p, status: 'called_back' } : p)))
      setCallsRefresh((n) => n + 1)
    }
    setBusyId(null)
  }

  async function approveDraft(callId: string) {
    if (!user) return
    const draft = draftJobsByCallId[callId]
    if (!draft) return
    setBusyId(draft.id)
    setError(null)
    const { error: fnErr } = await approveDraftJobDirect(supabase, user.id, draft.id)
    if (fnErr) setError(fnErr.message)
    else {
      setDraftJobsByCallId((prev) => {
        const next = { ...prev }
        delete next[callId]
        return next
      })
      setCallsRefresh((n) => n + 1)
    }
    setBusyId(null)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Calls &amp; Leads</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">
          Incoming calls, outcomes, and estimated job value.
        </p>
      </motion.div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { id: 'all', label: 'All calls' },
            { id: 'missed', label: 'Missed' },
            { id: 'answered', label: 'Answered' },
            { id: 'converted', label: 'Converted to job' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={[
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              filter === t.id
                ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                : 'border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-[var(--color-margen-muted)] hover:bg-[var(--color-margen-hover)] hover:text-[var(--color-margen-text)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

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
          className="flex min-h-[200px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-sm text-[var(--color-margen-muted)]">Loading calls…</p>
        </motion.div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-12 text-center text-sm text-[var(--color-margen-muted)]">
          No call records yet. Log calls in Supabase or your integrations to populate this list.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-margen-border)] text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                <th className="px-4 py-3">Caller</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Est. job value</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-margen-border)]">
              {filtered.map((r) => (
                <tr key={r.id} className="text-[var(--color-margen-text)]">
                  <td className="px-4 py-3 font-mono text-sm">{r.caller_phone ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-margen-muted)]">
                    {new Date(r.occurred_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-margen-muted)] tabular-nums">
                    {typeof r.duration_seconds === 'number' ? `${Math.floor(r.duration_seconds / 60)}:${String(r.duration_seconds % 60).padStart(2, '0')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.status === 'missed' ? formatUsd(r.estimated_value_cents) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {draftJobsByCallId[r.id] ? (
                        <button
                          type="button"
                          disabled={busyId === draftJobsByCallId[r.id]!.id}
                          onClick={() => void approveDraft(r.id)}
                          className="rounded-md bg-[var(--margen-accent)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyId === draftJobsByCallId[r.id]!.id ? '…' : 'Approve & assign'}
                        </button>
                      ) : null}
                      {r.ai_handled && r.transcript ? (
                        <button
                          type="button"
                          onClick={() => setOpenRow(r)}
                          className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                        >
                          Transcript
                        </button>
                      ) : null}
                      {r.status === 'missed' ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void callback(r)}
                          className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-2.5 py-1 text-xs font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)] disabled:opacity-50"
                        >
                          {busyId === r.id ? '…' : 'Callback'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {openRow ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenRow(null)}
          >
            <motion.div
              className="w-full max-w-2xl rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 shadow-xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: easePremium }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-margen-text)]">AI call transcript</p>
                  <p className="mt-1 text-xs text-[var(--color-margen-muted)] font-mono">{openRow.caller_phone ?? 'Unknown'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenRow(null)}
                  className="rounded-md border border-[var(--color-margen-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Close
                </button>
              </div>
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] p-3 text-xs text-[var(--color-margen-text)]">
                {openRow.transcript}
              </pre>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
