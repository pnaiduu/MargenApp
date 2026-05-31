import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '../contexts/useAuth'
import { createStripeInvoice } from '../lib/createStripeInvoice'
import { localMonthRangeIso } from '../lib/dates'
import { sendInvoiceReminderDirect } from '../lib/directSupabaseActions'
import { formatUsdFromCents } from '../lib/formatUsd'
import { easePremium } from '../lib/motion'
import { supabase } from '../lib/supabase'
import { disconnectStripeConnect, stripeConnectOAuthUrl } from '../lib/stripeConnect'

type InvoiceRow = {
  id: string
  status: 'draft' | 'sent' | 'paid' | 'void'
  amount_cents: number
  stripe_checkout_url: string | null
  created_at: string
  paid_at: string | null
  last_reminder_at: string | null
  payment_method: string | null
  customers: { name: string; email?: string | null } | null
  jobs: { title: string; job_type: string; id?: string } | null
}

type LedgerRow = {
  id: string
  amount_cents: number
  stripe_created_at: string
  description: string | null
  reporting_category: string | null
}

type PayoutRow = {
  id: string
  amount_cents: number
  stripe_created_at: string
  description: string | null
}

type StripeProfile = {
  stripe_connect_account_id: string | null
  stripe_connect_email: string | null
  stripe_charges_enabled: boolean
  stripe_details_submitted: boolean
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric' })
}

function displayStatus(status: InvoiceRow['status'], createdAt: string): string {
  if (status === 'paid') return 'paid'
  if (status === 'void') return 'void'
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / (86400000)
  if (status === 'sent' && ageDays > 30) return 'overdue'
  if (status === 'sent') return 'pending'
  return status
}

function statusPill(label: string) {
  const base = 'inline-flex items-center capitalize'
  if (label === 'paid') return `${base} invoice-paid`
  if (label === 'pending') return `${base} invoice-sent`
  if (label === 'overdue') return `${base} badge-overdue`
  if (label === 'void') return `${base} invoice-void`
  return `${base} invoice-draft`
}

function stripeAccountStatusLabel(profile: StripeProfile): string {
  if (!profile.stripe_connect_account_id) return 'Not connected'
  if (profile.stripe_charges_enabled) return 'Active — ready to accept payments'
  if (profile.stripe_details_submitted) return 'Pending — Stripe is reviewing your account'
  return 'Incomplete — finish setup in Stripe'
}

export function PaymentsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const invoicesRealtimeSeq = useRef(0)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [stripeProfile, setStripeProfile] = useState<StripeProfile>({
    stripe_connect_account_id: null,
    stripe_connect_email: null,
    stripe_charges_enabled: false,
    stripe_details_submitted: false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualEmail, setManualEmail] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const [manualDesc, setManualDesc] = useState('')
  const [connectNotice, setConnectNotice] = useState<string | null>(null)

  const { startIso, endIso } = useMemo(() => localMonthRangeIso(), [])

  async function load(ownerId: string, signal: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const [invRes, profRes, ledgerRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(
            'id, status, amount_cents, stripe_checkout_url, created_at, paid_at, last_reminder_at, payment_method, customers(name, email), jobs(title, job_type, id)',
          )
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false })
          .abortSignal(signal),
        supabase
          .from('profiles')
          .select('stripe_connect_account_id, stripe_connect_email, stripe_charges_enabled, stripe_details_submitted')
          .eq('id', ownerId)
          .maybeSingle(),
        supabase
          .from('stripe_ledger_lines')
          .select('id, amount_cents, stripe_created_at, description, reporting_category')
          .eq('owner_id', ownerId)
          .order('stripe_created_at', { ascending: false })
          .limit(200)
          .abortSignal(signal),
      ])
      if (signal.aborted) return
      if (invRes.error) {
        setError(invRes.error.message)
        setRows([])
      } else setRows((invRes.data ?? []) as InvoiceRow[])
      const prof = profRes.data as StripeProfile | null
      if (prof) {
        setStripeProfile({
          stripe_connect_account_id: prof.stripe_connect_account_id ?? null,
          stripe_connect_email: prof.stripe_connect_email ?? null,
          stripe_charges_enabled: Boolean(prof.stripe_charges_enabled),
          stripe_details_submitted: Boolean(prof.stripe_details_submitted),
        })
      }
      if (!ledgerRes.error && ledgerRes.data) setLedger(ledgerRes.data as LedgerRow[])
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `owner_id=eq.${user.id}` }, () =>
        void load(user.id, ac.signal),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      ac.abort()
    }
  }, [user])

  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    if (stripeParam === 'connected') {
      setConnectNotice('Stripe connected successfully.')
      searchParams.delete('stripe')
      setSearchParams(searchParams, { replace: true })
    } else if (stripeParam === 'error') {
      setConnectNotice(null)
      searchParams.delete('stripe')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const stripeConnected = Boolean(stripeProfile.stripe_connect_account_id)

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

  const overdueCents = useMemo(
    () =>
      rows
        .filter((r) => displayStatus(r.status, r.created_at) === 'overdue')
        .reduce((a, r) => a + (r.amount_cents ?? 0), 0),
    [rows],
  )

  const weeklyChart = useMemo(() => {
    const weeks: { label: string; revenue: number }[] = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const end = new Date(now)
      end.setDate(end.getDate() - i * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const rev = rows
        .filter((r) => r.status === 'paid' && r.paid_at)
        .filter((r) => {
          const t = new Date(r.paid_at!).getTime()
          return t >= start.getTime() && t <= end.getTime() + 86400000
        })
        .reduce((a, r) => a + r.amount_cents, 0)
      weeks.push({ label, revenue: rev / 100 })
    }
    return weeks
  }, [rows])

  const payouts = useMemo((): PayoutRow[] => {
    return ledger
      .filter((l) => (l.reporting_category ?? '').includes('payout') || (l.description ?? '').toLowerCase().includes('payout'))
      .slice(0, 20)
  }, [ledger])

  async function sendReminder(invoiceId: string) {
    if (!user) return
    setBusyId(invoiceId)
    setError(null)
    const { error: fnErr } = await sendInvoiceReminderDirect(supabase, user.id, invoiceId)
    if (fnErr) setError(fnErr.message)
    setBusyId(null)
  }

  function startStripeConnect() {
    setError(null)
    try {
      window.location.href = stripeConnectOAuthUrl()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stripe Connect is not configured.')
    }
  }

  async function disconnectStripe() {
    if (!user) return
    if (!window.confirm('Disconnect your Stripe account from Margen?')) return
    setBusyId('disconnect')
    setError(null)
    try {
      await disconnectStripeConnect()
      setStripeProfile({
        stripe_connect_account_id: null,
        stripe_connect_email: null,
        stripe_charges_enabled: false,
        stripe_details_submitted: false,
      })
      setConnectNotice(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not disconnect Stripe.')
    }
    setBusyId(null)
  }

  async function submitManualInvoice() {
    if (!user) return
    const cents = Math.round(parseFloat(manualAmount) * 100)
    if (!manualEmail.trim() || !Number.isFinite(cents) || cents <= 0) {
      setError('Enter a valid email and amount.')
      return
    }
    setBusyId('manual')
    const { error: invErr } = await createStripeInvoice({
      customer_email: manualEmail.trim(),
      amount_cents: cents,
      description: manualDesc.trim() || 'Manual invoice',
      send_sms: false,
    })
    if (invErr) setError(invErr.message)
    else {
      setManualOpen(false)
      setManualEmail('')
      setManualAmount('')
      setManualDesc('')
      await load(user.id, new AbortController().signal)
    }
    setBusyId(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.29, ease: easePremium }}>
        <h1 className="page-title">Payments</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-margen-text-secondary)]">
          Invoices, Stripe payouts, and collection status.
        </p>
      </motion.div>

      {connectNotice ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{connectNotice}</p>
      ) : null}

      <div className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-6">
        <h2 className="text-lg font-semibold text-[var(--color-margen-text)]">Stripe Connect</h2>
        {!stripeConnected ? (
          <>
            <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
              Connect your Stripe account to send invoices and collect payments from customers.
            </p>
            <ol className="mt-4 space-y-2 text-sm text-[var(--color-margen-text-secondary)]">
              <li>
                <span className="font-semibold text-[var(--color-margen-text)]">1.</span> Create a free Stripe account at{' '}
                <a href="https://stripe.com" target="_blank" rel="noreferrer" className="font-medium text-[var(--margen-accent)] underline">
                  stripe.com
                </a>{' '}
                if you do not have one yet
              </li>
              <li>
                <span className="font-semibold text-[var(--color-margen-text)]">2.</span> Click Connect with Stripe below and authorize Margen
              </li>
            </ol>
            <button
              type="button"
              onClick={startStripeConnect}
              className="mt-5 rounded-lg bg-[#635bff] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5249e6]"
            >
              Connect with Stripe
            </button>
          </>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Status</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-margen-text)]">
                  {stripeAccountStatusLabel(stripeProfile)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Connected email</p>
                <p className="mt-1 text-sm text-[var(--color-margen-text)]">
                  {stripeProfile.stripe_connect_email ?? '—'}
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-margen-muted)]">
              Account ID: {stripeProfile.stripe_connect_account_id}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                disabled={!stripeProfile.stripe_charges_enabled}
                className="rounded-lg bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-50"
              >
                Create invoice
              </button>
              <button
                type="button"
                disabled={busyId === 'disconnect'}
                onClick={() => void disconnectStripe()}
                className="rounded-lg border border-[var(--color-margen-border)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
              >
                {busyId === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Collected this month</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatUsdFromCents(collectedThisMonthCents)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Outstanding</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatUsdFromCents(outstandingCents)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Overdue</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatUsdFromCents(overdueCents)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
        <p className="mb-3 text-sm font-medium text-[var(--color-margen-text)]">Revenue by week (last 8 weeks)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-margen-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${Number(v ?? 0).toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="var(--margen-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <p className="text-sm text-[var(--color-margen-muted)]">Loading invoices…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          No invoices yet. Complete a job and create an invoice, or add one manually.
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
            {rows.map((r) => {
              const label = displayStatus(r.status, r.created_at)
              return (
                <li key={r.id} className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                  <div className="col-span-4 min-w-0">
                    <p className="truncate font-medium">{r.customers?.name ?? '—'}</p>
                    <p className="truncate text-sm text-[var(--color-margen-muted)]">{r.jobs?.title ?? 'Manual'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className={statusPill(label)}>{label}</span>
                  </div>
                  <div className="col-span-2 text-right font-medium tabular-nums">{formatUsdFromCents(r.amount_cents)}</div>
                  <div className="col-span-2 text-sm text-[var(--color-margen-muted)]">{formatWhen(r.created_at)}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    {r.stripe_checkout_url ? (
                      <a href={r.stripe_checkout_url} target="_blank" rel="noreferrer" className="rounded-md border px-2.5 py-1 text-sm">
                        Link
                      </a>
                    ) : null}
                    {label !== 'paid' && label !== 'void' ? (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void sendReminder(r.id)}
                        className="rounded-md bg-[var(--margen-accent)] px-2.5 py-1 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Remind
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {payouts.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
          <h2 className="text-sm font-semibold text-[var(--color-margen-text)]">Payout history</h2>
          <ul className="mt-3 divide-y divide-[var(--color-margen-border)]">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[var(--color-margen-text-secondary)]">{formatWhen(p.stripe_created_at)}</span>
                <span className="font-medium tabular-nums">{formatUsdFromCents(Math.abs(p.amount_cents))}</span>
                <span className="truncate text-xs text-[var(--color-margen-muted)]">{p.description ?? 'Payout'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AnimatePresence>
        {manualOpen ? (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold">Create invoice</h2>
              <label className="mt-4 block text-xs text-[var(--color-margen-muted)]">Customer email</label>
              <input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              <label className="mt-3 block text-xs text-[var(--color-margen-muted)]">Amount (USD)</label>
              <input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" placeholder="150.00" />
              <label className="mt-3 block text-xs text-[var(--color-margen-muted)]">Description</label>
              <input value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setManualOpen(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button type="button" disabled={busyId === 'manual'} onClick={() => void submitManualInvoice()} className="rounded-lg bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  Send invoice
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
