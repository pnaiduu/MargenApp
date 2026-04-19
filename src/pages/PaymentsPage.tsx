import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import { localMonthRangeIso } from '../lib/dates'
import { easePremium } from '../lib/motion'
import { sendInvoiceReminderDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'

type InvoiceRow = {
  id: string
  status: 'draft' | 'sent' | 'paid' | 'void'
  amount_cents: number
  stripe_checkout_url: string | null
  created_at: string
  paid_at: string | null
  last_reminder_at: string | null
  payment_method: string | null
  customers: { name: string } | null
  jobs: { title: string; job_type: string } | null
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric' })
}

function statusPill(status: InvoiceRow['status']) {
  const base = 'inline-flex items-center'
  if (status === 'paid') return `${base} invoice-paid`
  if (status === 'sent') return `${base} invoice-sent`
  if (status === 'void') return `${base} invoice-void`
  return `${base} invoice-draft`
}

export function PaymentsPage() {
  const { user } = useAuth()
  const invoicesRealtimeSeq = useRef(0)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { startIso, endIso } = useMemo(() => localMonthRangeIso(), [])

  async function load(ownerId: string, signal: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qErr } = await supabase
        .from('invoices')
        .select(
          'id, status, amount_cents, stripe_checkout_url, created_at, paid_at, last_reminder_at, payment_method, customers(name), jobs(title, job_type)',
        )
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .abortSignal(signal)
      if (signal.aborted) return
      if (qErr) {
        setError(qErr.message)
        setRows([])
      } else {
        setRows((data ?? []) as InvoiceRow[])
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const ac = new AbortController()
    void load(user.id, ac.signal)

    invoicesRealtimeSeq.current += 1
    const topic = `invoices:${user.id}:${invoicesRealtimeSeq.current}`
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `owner_id=eq.${user.id}` },
        () => void load(user.id, ac.signal),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      ac.abort()
    }
  }, [user])

  const collectedThisMonthCents = useMemo(() => {
    const start = new Date(startIso).getTime()
    const end = new Date(endIso).getTime()
    return rows
      .filter((r) => r.status === 'paid' && r.paid_at)
      .filter((r) => {
        const t = new Date(r.paid_at as string).getTime()
        return t >= start && t <= end
      })
      .reduce((a, r) => a + (r.amount_cents ?? 0), 0)
  }, [rows, startIso, endIso])

  const outstandingCents = useMemo(
    () => rows.filter((r) => r.status !== 'paid' && r.status !== 'void').reduce((a, r) => a + (r.amount_cents ?? 0), 0),
    [rows],
  )

  async function sendReminder(invoiceId: string) {
    if (!user) return
    setBusyId(invoiceId)
    setError(null)
    const { error: fnErr } = await sendInvoiceReminderDirect(supabase, user.id, invoiceId)
    if (fnErr) setError(fnErr.message)
    setBusyId(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Payments</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">Invoices, collection status, and cash flow.</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Collected this month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-margen-text)]">{formatUsd(collectedThisMonthCents)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Outstanding balance</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-margen-text)]">{formatUsd(outstandingCents)}</p>
        </div>
      </div>

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
          <p className="text-sm text-[var(--color-margen-muted)]">Loading invoices…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          No invoices yet. Send an invoice from a completed job to start collecting.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <div className="grid grid-cols-12 gap-3 border-b border-[var(--color-margen-border)] px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            <div className="col-span-4">Customer / Job</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Amount</div>
            <div className="col-span-2">Created</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <ul className="divide-y divide-[var(--color-margen-border)]">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                <div className="col-span-4 min-w-0">
                  <p className="truncate font-medium text-[var(--color-margen-text)]">{r.customers?.name ?? '—'}</p>
                  <p className="truncate text-sm text-[var(--color-margen-muted)]">
                    {r.jobs?.job_type ?? 'job'} · {r.jobs?.title ?? '—'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className={statusPill(r.status)}>{r.status}</span>
                  {r.status === 'paid' && r.payment_method ? (
                    <p className="mt-1 text-xs capitalize text-[var(--color-margen-muted)]">via {r.payment_method}</p>
                  ) : null}
                </div>
                <div className="col-span-2 text-right font-medium tabular-nums text-[var(--color-margen-text)]">
                  {formatUsd(r.amount_cents)}
                </div>
                <div className="col-span-2 text-sm text-[var(--color-margen-muted)]">{formatWhen(r.created_at)}</div>
                <div className="col-span-2 flex justify-end gap-2">
                  {r.stripe_checkout_url ? (
                    <a
                      href={r.stripe_checkout_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-[var(--color-margen-border)] px-2.5 py-1 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                    >
                      Link
                    </a>
                  ) : null}
                  {r.status !== 'paid' && r.status !== 'void' ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void sendReminder(r.id)}
                      className="rounded-md bg-[var(--margen-accent)] px-2.5 py-1 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Send reminder
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

