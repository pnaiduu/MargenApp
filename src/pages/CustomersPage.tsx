import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { formatUsdFromCents } from '../lib/formatUsd'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'

type CustomerSummaryRow = {
  customer_id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  lifetime_value_cents: number
  last_service_at: string | null
  is_vip: boolean
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CustomersPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CustomerSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [lastServiceFrom, setLastServiceFrom] = useState('')

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('customer_summary')
          .select('customer_id, name, phone, address, email, lifetime_value_cents, last_service_at, is_vip')
          .eq('owner_id', ownerId)
          .order('lifetime_value_cents', { ascending: false })
          .limit(500)
          .abortSignal(ac.signal)
        if (ac.signal.aborted) return
        if (qErr) {
          setError(qErr.message)
          setRows([])
        } else {
          setRows((data ?? []) as CustomerSummaryRow[])
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTs = lastServiceFrom ? new Date(lastServiceFrom).getTime() : null
    return rows.filter((r) => {
      if (q) {
        const hay = [r.name, r.phone ?? '', r.address ?? '', r.email ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fromTs != null) {
        if (!r.last_service_at) return false
        if (new Date(r.last_service_at).getTime() < fromTs) return false
      }
      return true
    })
  }, [rows, query, lastServiceFrom])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Customers</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">Profiles, history, and value.</p>
      </motion.div>

      <div className="grid gap-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            Search
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone, address…"
            className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
          />
        </div>
        <div className="hidden md:block" />
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            Last service after
          </label>
          <input
            type="date"
            value={lastServiceFrom}
            onChange={(e) => setLastServiceFrom(e.target.value)}
            className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
          />
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
          <p className="text-sm text-[var(--color-margen-muted)]">Loading customers…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          No customers found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
          <div className="grid grid-cols-12 gap-3 border-b border-[var(--color-margen-border)] px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            <div className="col-span-4">Customer</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-2">Last service</div>
            <div className="col-span-3 text-right">Lifetime value</div>
          </div>
          <ul className="divide-y divide-[var(--color-margen-border)]">
            {filtered.map((c) => (
              <li key={c.customer_id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-[var(--color-margen-hover)]">
                <div className="col-span-4 min-w-0">
                  <Link to={`/customers/${c.customer_id}`} className="block">
                    <p className="truncate font-medium text-[var(--color-margen-text)]">
                      {c.name}
                      {c.is_vip ? (
                        <span className="badge-pending ml-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold">
                          VIP
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-[var(--color-margen-muted)]">{c.address ?? '—'}</p>
                  </Link>
                </div>
                <div className="col-span-3 text-sm text-[var(--color-margen-muted)]">
                  <p className="font-mono">{c.phone ?? '—'}</p>
                  <p className="truncate">{c.email ?? ''}</p>
                </div>
                <div className="col-span-2 text-sm text-[var(--color-margen-muted)]">{formatWhen(c.last_service_at)}</div>
                <div className="col-span-3 text-right font-semibold tabular-nums text-[var(--color-margen-text)]">
                  {formatUsdFromCents(c.lifetime_value_cents)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

