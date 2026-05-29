import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/useAuth'
import { supabase } from '../../lib/supabase'
import { formatUsdFromCents } from '../../lib/formatUsd'
import { fetchTeamLeaderboard, initials, type LeaderboardRow } from '../../lib/technicianProductivity'
import { easePremium } from '../../lib/motion'

function badgeClass(badge: LeaderboardRow['badge']) {
  if (badge === 'Excellent') return 'bg-[#DCFCE7] text-[#166534]'
  if (badge === 'Good') return 'bg-[#E0E7FF] text-[#3730A3]'
  return 'bg-[#FEF3C7] text-[#92400E]'
}

function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--color-margen-muted)]">—</span>
  const full = Math.round(value)
  return (
    <span className="text-[#111111]" title={`${value} / 5`}>
      {'★'.repeat(full)}
      <span className="text-[var(--color-margen-muted)]">{'★'.repeat(Math.max(0, 5 - full))}</span>
      <span className="ml-1 text-xs text-[var(--color-margen-muted)] tabular-nums">{value.toFixed(1)}</span>
    </span>
  )
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-md" />
      ))}
    </div>
  )
}

export function TeamPerformanceLeaderboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchTeamLeaderboard(supabase, user.id)
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load team performance')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <section className="rounded-xl border border-[#ebebeb] bg-white">
      <div className="border-b border-[#ebebeb] px-5 py-4">
        <h2 className="section-title">Team Performance</h2>
        <p className="mt-1 text-sm text-[#888888]">Leaderboard for this week · sorted by jobs completed</p>
      </div>

      {error ? (
        <p className="px-5 py-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="p-5">
          <SkeletonRows />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[#888888]">
          No jobs completed yet this week. Performance metrics will appear once your team completes work.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#ebebeb] text-xs font-semibold uppercase tracking-wide text-[#888888]">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Jobs</th>
                <th className="px-4 py-3">Avg duration</th>
                <th className="px-4 py-3">On-time</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Revenue</th>
                <th className="px-4 py-3">Badge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <motion.tr
                  key={r.technicianId}
                  className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, ease: easePremium }}
                >
                  <td className="px-4 py-3 font-semibold tabular-nums text-[#111111]">#{r.rank}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/technicians/${r.technicianId}`}
                      className="flex items-center gap-3 font-medium text-[#111111] hover:text-[var(--margen-accent)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] text-xs font-bold text-white">
                        {initials(r.name)}
                      </span>
                      <span>
                        {r.name}
                        {r.clockedInNow ? (
                          <span className="ml-2 inline-flex rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-semibold text-[#166534]">
                            Clocked in
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.jobsCompletedWeek}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.avgDurationMinutes != null ? `${r.avgDurationMinutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.onTimeRate != null ? `${Math.round(r.onTimeRate * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Stars value={r.avgRating} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.hoursWorkedWeek}h</td>
                  <td className="px-4 py-3 tabular-nums">{formatUsdFromCents(r.revenueWeekCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(r.badge)}`}>
                      {r.badge}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
