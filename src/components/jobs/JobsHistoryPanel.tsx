import { useMemo, useState } from 'react'
import { formatUsdFromCents } from '../../lib/formatUsd'

export type HistoryJobRow = {
  id: string
  title: string
  status: 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  started_at: string | null
  revenue_cents: number
  is_paid?: boolean
  cancel_reason: string | null
  cancel_reason_details: string | null
  technician_id: string | null
  customers: { name: string } | null
  technicians: { name: string } | null
}

type Props = {
  jobs: HistoryJobRow[]
  techs: { id: string; name: string }[]
  onCreateInvoice?: (jobId: string) => void
  busyJobId?: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function durationMinutes(started: string | null, completed: string | null) {
  if (!started || !completed) return '—'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function exportCsv(rows: HistoryJobRow[]) {
  const header = ['Date', 'Status', 'Customer', 'Technician', 'Job', 'Duration', 'Amount', 'Cancel reason']
  const lines = rows.map((j) => {
    const date = j.status === 'completed' ? j.completed_at : j.cancelled_at ?? j.scheduled_at
    return [
      date ?? '',
      j.status,
      j.customers?.name ?? '',
      j.technicians?.name ?? '',
      j.title,
      durationMinutes(j.started_at, j.completed_at),
      ((j.revenue_cents ?? 0) / 100).toFixed(2),
      j.cancel_reason_details ?? j.cancel_reason ?? '',
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  })
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `margen-job-history-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function JobsHistoryPanel({ jobs, techs, onCreateInvoice, busyJobId }: Props) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all')
  const [techFilter, setTechFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false
      if (techFilter && j.technician_id !== techFilter) return false
      const ref = j.completed_at ?? j.cancelled_at ?? j.scheduled_at
      if (!ref) return true
      const t = new Date(ref).getTime()
      if (dateFrom && t < new Date(dateFrom).getTime()) return false
      if (dateTo && t > new Date(dateTo + 'T23:59:59').getTime()) return false
      return true
    })
  }, [jobs, statusFilter, techFilter, dateFrom, dateTo])

  const stats = useMemo(() => {
    const now = new Date()
    const thisKey = monthKey(now)
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastKey = monthKey(last)
    let completedThisMonth = 0
    let completedLastMonth = 0
    let revenueThisMonth = 0
    for (const j of jobs) {
      if (j.status !== 'completed' || !j.completed_at) continue
      const k = monthKey(new Date(j.completed_at))
      if (k === thisKey) {
        completedThisMonth += 1
        revenueThisMonth += j.revenue_cents ?? 0
      } else if (k === lastKey) completedLastMonth += 1
    }
    return { completedThisMonth, completedLastMonth, revenueThisMonth }
  }, [jobs])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Revenue this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">
            {formatUsdFromCents(stats.revenueThisMonth)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Completed this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">{stats.completedThisMonth}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Completed last month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-margen-text)]">{stats.completedLastMonth}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-margen-muted)]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-margen-muted)]">Technician</label>
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {techs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-margen-muted)]">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-margen-muted)]">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          className="rounded-lg border border-[var(--color-margen-border)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]">
        <div className="grid grid-cols-12 gap-2 border-b border-[var(--color-margen-border)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
          <div className="col-span-2">Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Customer</div>
          <div className="col-span-2">Technician</div>
          <div className="col-span-1">Duration</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1">Notes</div>
        </div>
        <ul className="divide-y divide-[var(--color-margen-border)]">
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[var(--color-margen-muted)]">No history yet.</li>
          ) : (
            filtered.map((j) => (
              <li key={j.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-2 text-[var(--color-margen-text-secondary)]">
                  {formatDate(j.completed_at ?? j.cancelled_at ?? j.scheduled_at)}
                </div>
                <div className="col-span-2 capitalize text-[var(--color-margen-text)]">{j.status}</div>
                <div className="col-span-2 truncate text-[var(--color-margen-text)]">{j.customers?.name ?? '—'}</div>
                <div className="col-span-2 truncate text-[var(--color-margen-text-secondary)]">{j.technicians?.name ?? '—'}</div>
                <div className="col-span-1 text-[var(--color-margen-muted)]">{durationMinutes(j.started_at, j.completed_at)}</div>
                <div className="col-span-2 text-right font-medium tabular-nums text-[var(--color-margen-text)]">
                  {j.status === 'completed' ? (
                    <div className="flex flex-col items-end gap-1">
                      <span>{formatUsdFromCents(j.revenue_cents ?? 0)}</span>
                      {!j.is_paid && onCreateInvoice ? (
                        <button
                          type="button"
                          disabled={busyJobId === j.id}
                          onClick={() => onCreateInvoice(j.id)}
                          className="text-xs font-semibold text-[var(--margen-accent)] hover:underline disabled:opacity-60"
                        >
                          Invoice
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="col-span-1 truncate text-xs text-[var(--color-margen-muted)]" title={j.cancel_reason_details ?? j.cancel_reason ?? ''}>
                  {j.status === 'cancelled' ? j.cancel_reason ?? '—' : '—'}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
