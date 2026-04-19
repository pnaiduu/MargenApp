import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { createJobDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  owner_notes: string | null
}

type HistoryRow = {
  id: string
  title: string
  job_type: string
  status: string
  completed_at: string | null
  technicians: { name: string } | null
  invoices: { amount_cents: number; status: string; paid_at: string | null }[] | null
  rating: { rating: number | null; comment: string | null; submitted_at: string | null } | null
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CustomerProfilePage() {
  const { user } = useAuth()
  const { id } = useParams()
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const customerId = id ?? ''

  useEffect(() => {
    if (!user || !customerId) return
    const ownerId = user.id
    const ac = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
      const s = ac.signal

      const custQ = supabase
        .from('customers')
        .select('id, name, phone, email, address, owner_notes')
        .eq('owner_id', ownerId)
        .eq('id', customerId)
        .abortSignal(s)
        .maybeSingle()

      const histQ = supabase
        .from('jobs')
        .select(
          'id, title, job_type, status, completed_at, technicians(name), invoices(amount_cents, status, paid_at)',
        )
        .eq('owner_id', ownerId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .abortSignal(s)
        .limit(250)

      const [custRes, histRes] = await Promise.all([custQ, histQ])
      if (ac.signal.aborted) return

      if (custRes.error || !custRes.data) {
        setError(custRes.error?.message ?? 'Customer not found')
        setCustomer(null)
        setHistory([])
        return
      }

      setCustomer(custRes.data as CustomerRow)
      setNotesDraft((custRes.data as CustomerRow).owner_notes ?? '')

      if (histRes.error) {
        setHistory([])
      } else {
        const base = (histRes.data ?? []) as unknown as Omit<HistoryRow, 'rating'>[]
        const jobIds = base.map((j) => j.id).filter(Boolean)
        let ratingsMap = new Map<string, HistoryRow['rating']>()
        if (jobIds.length) {
          const { data: ratings } = await supabase
            .from('job_customer_ratings')
            .select('job_id, rating, comment, submitted_at')
            .in('job_id', jobIds)
            .eq('owner_id', ownerId)
            .abortSignal(s)
          if (ac.signal.aborted) return
          ratingsMap = new Map(
            (ratings ?? []).map((r) => [
              (r as { job_id: string }).job_id,
              {
                rating: (r as { rating: number | null }).rating ?? null,
                comment: (r as { comment: string | null }).comment ?? null,
                submitted_at: (r as { submitted_at: string | null }).submitted_at ?? null,
              },
            ]),
          )
        }
        setHistory(
          base.map((j) => ({
            ...(j as HistoryRow),
            rating: ratingsMap.get(j.id) ?? null,
          })),
        )
      }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user, customerId, historyRefresh])

  const lifetimeValueCents = useMemo(() => {
    let sum = 0
    for (const j of history) {
      const inv = j.invoices?.find((i) => i.status === 'paid') ?? null
      if (inv) sum += inv.amount_cents ?? 0
    }
    return sum
  }, [history])

  const lastServiceAt = useMemo(() => {
    const dates = history.map((h) => h.completed_at).filter(Boolean) as string[]
    if (dates.length === 0) return null
    dates.sort()
    return dates[dates.length - 1] ?? null
  }, [history])

  async function saveNotes() {
    if (!user || !customer) return
    setSaveBusy(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('customers')
      .update({ owner_notes: notesDraft.trim() || null })
      .eq('id', customer.id)
      .eq('owner_id', user.id)
    if (upErr) setError(upErr.message)
    setSaveBusy(false)
  }

  async function bookJob() {
    if (!customer || !user) return
    setError(null)
    const { error: fnErr } = await createJobDirect(supabase, user.id, {
      customer_id: customer.id,
      title: `Service for ${customer.name}`,
      urgency: 'routine',
    })
    if (fnErr) setError(fnErr.message)
    else setHistoryRefresh((n) => n + 1)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="page-title truncate">{customer?.name ?? 'Customer'}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#555555]">Customer profile and full history.</p>
        </div>
        <button
          type="button"
          onClick={() => void bookJob()}
          className="margen-btn-accent shrink-0 px-4 py-2 text-sm"
        >
          Book job
        </button>
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
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <p className="text-sm text-[var(--color-margen-muted)]">Loading customer…</p>
        </div>
      ) : !customer ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          Customer not found.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4 md:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Contact details
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--color-margen-text)]">
                <p>
                  <span className="text-[var(--color-margen-muted)]">Phone:</span>{' '}
                  <span className="font-mono">{customer.phone ?? '—'}</span>
                </p>
                <p>
                  <span className="text-[var(--color-margen-muted)]">Email:</span> {customer.email ?? '—'}
                </p>
                <p>
                  <span className="text-[var(--color-margen-muted)]">Address:</span> {customer.address ?? '—'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Value</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">
                {formatUsd(lifetimeValueCents)}
              </p>
              <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
                Last service: <span className="font-medium">{formatWhen(lastServiceAt)}</span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Owner notes</p>
              <button
                type="button"
                disabled={saveBusy}
                onClick={() => void saveNotes()}
                className="rounded-md border border-[var(--color-margen-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
              >
                Save
              </button>
            </div>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              placeholder="Private notes about this customer…"
            />
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
            <div className="border-b border-[var(--color-margen-border)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Job history
              </p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                Every job, with technician, cost, and rating when available.
              </p>
            </div>
            {history.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--color-margen-muted)]">No jobs for this customer yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-margen-border)]">
                {history.map((j) => {
                  const paidInv = j.invoices?.find((i) => i.status === 'paid') ?? null
                  return (
                    <li key={j.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--color-margen-text)]">{j.title}</p>
                          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                            {j.job_type} · {j.technicians?.name ?? 'Unassigned'} · Completed {formatWhen(j.completed_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums text-[var(--color-margen-text)]">
                            {paidInv ? formatUsd(paidInv.amount_cents) : '—'}
                          </p>
                          <p className="text-xs text-[var(--color-margen-muted)]">{paidInv ? 'Paid' : 'Not paid'}</p>
                        </div>
                      </div>
                      {j.rating?.rating ? (
                        <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
                          Rating: <span className="font-medium text-[var(--color-margen-text)]">{j.rating.rating}/5</span>
                          {j.rating.comment ? <span className="ml-2">“{j.rating.comment}”</span> : null}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

