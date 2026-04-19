import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { localMonthRangeIso } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatUsdNumber(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type JobRevRow = {
  amount_cents: number
  jobs: {
    job_type: string
    technician_id: string | null
    technicians: { name: string } | null
  } | null
}

type CancelledJobRow = {
  id: string
  title: string
  scheduled_at: string | null
  cancelled_at: string | null
  cancel_reason: 'customer_cancelled' | 'technician_unavailable' | 'rescheduled' | null
  customers: { name: string } | null
  technicians: { name: string } | null
}

type StripeLedgerRow = {
  amount_cents: number
  fee_cents: number
  reporting_category: string | null
  txn_type: string | null
  stripe_created_at: string
}

export function RevenuePage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRevRow[]>([])
  const [missedSumCents, setMissedSumCents] = useState(0)
  const [cancelledJobs, setCancelledJobs] = useState<CancelledJobRow[]>([])
  const [stripeLedger, setStripeLedger] = useState<StripeLedgerRow[]>([])
  const [stripeAnalyticsHint, setStripeAnalyticsHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { startIso, endIso } = useMemo(() => localMonthRangeIso(), [])

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const s = ac.signal

        const jobsQ = supabase
        .from('invoices')
        .select('amount_cents, jobs(job_type, technician_id, technicians(name))')
        .eq('owner_id', ownerId)
        .eq('status', 'paid')
        .gte('paid_at', startIso)
        .lte('paid_at', endIso)
          .abortSignal(s)

        const cancelledQ = supabase
        .from('jobs')
        .select('id, title, scheduled_at, cancelled_at, cancel_reason, customers(name), technicians(name)')
        .eq('owner_id', ownerId)
        .eq('status', 'cancelled')
        .gte('cancelled_at', startIso)
        .lte('cancelled_at', endIso)
        .order('cancelled_at', { ascending: false })
          .abortSignal(s)

        const missedQ = supabase
        .from('phone_calls')
        .select('estimated_value_cents')
        .eq('owner_id', ownerId)
        .eq('status', 'missed')
          .abortSignal(s)

        const stripeLedgerQ = supabase
          .from('stripe_ledger_lines')
          .select('amount_cents, fee_cents, reporting_category, txn_type, stripe_created_at')
          .eq('owner_id', ownerId)
          .gte('stripe_created_at', startIso)
          .lte('stripe_created_at', endIso)
          .abortSignal(s)

        const stripeHintQ = supabase
          .from('profiles')
          .select('stripe_analytics_key_hint')
          .eq('id', ownerId)
          .abortSignal(s)
          .maybeSingle()

        const [jobsRes, missedRes, cancelledRes, ledgerRes, hintRes] = await Promise.all([
          jobsQ,
          missedQ,
          cancelledQ,
          stripeLedgerQ,
          stripeHintQ,
        ])

        if (ac.signal.aborted) return

        if (jobsRes.error) {
          setError(jobsRes.error.message)
          setJobs([])
        } else {
          setJobs((jobsRes.data ?? []) as JobRevRow[])
        }

        if (!missedRes.error && missedRes.data) {
          const sum = (missedRes.data as { estimated_value_cents: number }[]).reduce(
            (a, r) => a + (r.estimated_value_cents ?? 0),
            0,
          )
          setMissedSumCents(sum)
        } else {
          setMissedSumCents(0)
        }

        if (cancelledRes.error) {
          setCancelledJobs([])
        } else {
          setCancelledJobs((cancelledRes.data ?? []) as CancelledJobRow[])
        }

        if (!ledgerRes.error && ledgerRes.data) {
          setStripeLedger(ledgerRes.data as StripeLedgerRow[])
        } else {
          setStripeLedger([])
        }
        if (!hintRes.error && hintRes.data) {
          setStripeAnalyticsHint(
            (hintRes.data as { stripe_analytics_key_hint?: string | null }).stripe_analytics_key_hint ?? null,
          )
        } else {
          setStripeAnalyticsHint(null)
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user, startIso, endIso])

  const monthTotalCents = useMemo(
    () => jobs.reduce((a, j) => a + (j.amount_cents ?? 0), 0),
    [jobs],
  )

  const byTech = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of jobs) {
      const name = j.jobs?.technicians?.name ?? 'Unassigned'
      map.set(name, (map.get(name) ?? 0) + (j.amount_cents ?? 0) / 100)
    }
    return Array.from(map.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [jobs])

  const byType = useMemo(() => {
    const map = new Map<string, number>()
    for (const j of jobs) {
      const t = j.jobs?.job_type?.trim() || 'general'
      map.set(t, (map.get(t) ?? 0) + (j.amount_cents ?? 0) / 100)
    }
    return Array.from(map.entries()).map(([type, revenue]) => ({ type, revenue }))
  }, [jobs])

  const monthLabel = useMemo(
    () =>
      new Date(startIso).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    [startIso],
  )

  const stripeMonthNetCents = useMemo(
    () => stripeLedger.reduce((a, r) => a + (r.amount_cents ?? 0), 0),
    [stripeLedger],
  )

  const stripeMonthFeesCents = useMemo(
    () => stripeLedger.reduce((a, r) => a + (r.fee_cents ?? 0), 0),
    [stripeLedger],
  )

  const stripeByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of stripeLedger) {
      const label = (r.reporting_category ?? r.txn_type ?? 'other').replace(/_/g, ' ')
      map.set(label, (map.get(label) ?? 0) + (r.amount_cents ?? 0))
    }
    return Array.from(map.entries())
      .map(([category, cents]) => ({ category, net: cents / 100 }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [stripeLedger])

  const stripePieRows = useMemo(
    () => stripeByCategory.filter((x) => Math.abs(x.net) > 0.000001),
    [stripeByCategory],
  )

  function reasonLabel(r: CancelledJobRow['cancel_reason']) {
    if (r === 'customer_cancelled') return 'Customer cancelled'
    if (r === 'technician_unavailable') return 'Technician unavailable'
    if (r === 'rescheduled') return 'Rescheduled'
    return '—'
  }

  function formatWhenShort(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Revenue</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">
          Month-to-date performance, mix, and opportunity left on the table.
        </p>
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
          <p className="text-sm text-[var(--color-margen-muted)]">Loading revenue…</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Total revenue · {monthLabel}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-margen-text)]">
                {formatUsd(monthTotalCents)}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Missed revenue estimate
              </p>
              <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
                Sum of estimated job value on unanswered calls still marked missed.
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">
                {formatUsd(missedSumCents)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-2 py-4 md:px-4">
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Revenue by technician
              </p>
              <div className="h-[300px] w-full min-h-[300px] min-w-0">
                {byTech.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-margen-muted)]">
                    No completed revenue this month.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                    <BarChart data={byTech} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke="var(--color-margen-border)" horizontal={false} strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatUsdNumber(v)}
                        tick={{ fill: 'var(--color-margen-muted)', fontSize: 11 }}
                        axisLine={{ stroke: 'var(--color-margen-border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: 'var(--color-margen-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-margen-surface-elevated)',
                          border: '1px solid var(--color-margen-border)',
                          borderRadius: 8,
                          fontSize: 13,
                          color: 'var(--color-margen-text)',
                        }}
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value)
                          return Number.isFinite(n) ? formatUsdNumber(n) : ''
                        }}
                      />
                      <Bar dataKey="revenue" fill="var(--margen-accent)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-2 py-4 md:px-4">
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Revenue by job type
              </p>
              <div className="h-[300px] w-full min-h-[300px] min-w-0">
                {byType.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-margen-muted)]">
                    No completed revenue this month.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                    <PieChart>
                      <Pie
                        data={byType}
                        dataKey="revenue"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {byType.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-margen-surface-elevated)',
                          border: '1px solid var(--color-margen-border)',
                          borderRadius: 8,
                          fontSize: 13,
                          color: 'var(--color-margen-text)',
                        }}
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value)
                          return Number.isFinite(n) ? formatUsdNumber(n) : ''
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
            <div className="border-b border-[var(--color-margen-border)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Stripe ledger · {monthLabel}
              </p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                Synced from your Stripe account (Balance Transactions). Uses the API key saved under Settings → Payments.
              </p>
            </div>
            <div className="px-5 py-5">
              {!stripeAnalyticsHint && stripeLedger.length === 0 ? (
                <p className="text-sm text-[var(--color-margen-muted)]">
                  Add or change your Stripe API key in{' '}
                  <Link to="/settings" className="font-semibold text-[var(--margen-accent)] underline underline-offset-2">
                    Settings → Payments → Stripe account analytics
                  </Link>{' '}
                  and run <strong className="text-[var(--color-margen-text)]">Sync from Stripe</strong> to populate this
                  section.
                </p>
              ) : stripeLedger.length === 0 ? (
                <p className="text-sm text-[var(--color-margen-muted)]">
                  No Stripe rows for this month yet. Open{' '}
                  <Link to="/settings" className="font-semibold text-[var(--margen-accent)] underline underline-offset-2">
                    Settings
                  </Link>{' '}
                  and choose <strong className="text-[var(--color-margen-text)]">Sync from Stripe</strong> (pulls roughly
                  the last 120 days; MTD is filtered here).
                </p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                        Net on Stripe (MTD)
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">
                        {formatUsd(stripeMonthNetCents)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                        Sum of net amounts on balance transactions (charges, refunds, payouts, etc.).
                      </p>
                    </div>
                    <div className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                        Stripe fees (MTD)
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">
                        {formatUsd(stripeMonthFeesCents)}
                      </p>
                      <p className="mt-2 text-xs text-[var(--color-margen-muted)]">Processing fees Stripe reported on those lines.</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="min-w-0 px-1">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                        Net by reporting category
                      </p>
                      <div className="h-[300px] w-full min-h-[300px] min-w-0">
                        {stripeByCategory.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-sm text-[var(--color-margen-muted)]">
                            No categories.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                            <BarChart data={stripeByCategory} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                              <CartesianGrid stroke="var(--color-margen-border)" horizontal={false} strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                tickFormatter={(v) => formatUsdNumber(v)}
                                tick={{ fill: 'var(--color-margen-muted)', fontSize: 11 }}
                                axisLine={{ stroke: 'var(--color-margen-border)' }}
                                tickLine={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="category"
                                width={132}
                                tick={{ fill: 'var(--color-margen-muted)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--color-margen-surface-elevated)',
                                  border: '1px solid var(--color-margen-border)',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  color: 'var(--color-margen-text)',
                                }}
                                formatter={(value) => {
                                  const n = typeof value === 'number' ? value : Number(value)
                                  return Number.isFinite(n) ? formatUsdNumber(n) : ''
                                }}
                              />
                              <Bar dataKey="net" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 px-1">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                        Mix by magnitude (abs net)
                      </p>
                      <div className="h-[300px] w-full min-h-[300px] min-w-0">
                        {stripePieRows.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-sm text-[var(--color-margen-muted)]">
                            No distribution data.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                            <PieChart>
                              <Pie
                                data={stripePieRows.map((d) => ({
                                  name: d.category,
                                  value: Math.abs(d.net),
                                }))}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={52}
                                outerRadius={88}
                                paddingAngle={2}
                              >
                                {stripePieRows.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: 'var(--color-margen-surface-elevated)',
                                  border: '1px solid var(--color-margen-border)',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  color: 'var(--color-margen-text)',
                                }}
                                formatter={(value, name) => {
                                  const v = typeof value === 'number' ? value : Number(value)
                                  const row = stripeByCategory.find((x) => x.category === name)
                                  const absPart = Number.isFinite(v) ? formatUsdNumber(v) : ''
                                  const netPart = row ? ` · signed net ${formatUsdNumber(row.net)}` : ''
                                  return [`${absPart}${netPart}`, 'Category']
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
            <div className="border-b border-[var(--color-margen-border)] px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Cancelled jobs report · {monthLabel}
              </p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                All jobs cancelled this month, with reason and assignment.
              </p>
            </div>
            {cancelledJobs.length === 0 ? (
              <p className="px-5 py-8 text-sm text-[var(--color-margen-muted)]">No cancelled jobs this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                      <th className="px-5 py-3">Job</th>
                      <th className="px-5 py-3">Customer</th>
                      <th className="px-5 py-3">Technician</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3">Cancelled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-margen-border)]">
                    {cancelledJobs.map((j) => (
                      <tr key={j.id} className="text-sm text-[var(--color-margen-text)]">
                        <td className="px-5 py-3 font-medium">{j.title}</td>
                        <td className="px-5 py-3 text-[var(--color-margen-muted)]">{j.customers?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-[var(--color-margen-muted)]">{j.technicians?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-[var(--color-margen-muted)]">{reasonLabel(j.cancel_reason)}</td>
                        <td className="px-5 py-3 text-[var(--color-margen-muted)]">{formatWhenShort(j.cancelled_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
