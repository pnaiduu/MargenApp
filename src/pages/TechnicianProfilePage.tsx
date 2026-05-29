import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabase'
import { fetchTechnicianProfile, initials, type TechnicianProfileStats } from '../lib/technicianProductivity'
import { formatUsdFromCents } from '../lib/formatUsd'

const mapContainerStyle = { width: '100%', height: '280px', borderRadius: '12px' }

function statusBadgeClass(status: string) {
  if (status === 'available') return 'badge-available'
  if (status === 'busy') return 'badge-busy'
  if (status === 'pending') return 'badge-pending'
  return 'badge-neutral'
}

export function TechnicianProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [stats, setStats] = useState<TechnicianProfileStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  })

  useEffect(() => {
    if (!user || !id) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchTechnicianProfile(supabase, user.id, id)
        if (!cancelled) setStats(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, id])

  const mapCenter = useMemo(() => {
    const pts = stats?.locationEventsToday ?? []
    if (pts.length === 0) return { lat: 39.8283, lng: -98.5795 }
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
    return { lat, lng }
  }, [stats?.locationEventsToday])

  const routePath = useMemo(
    () => (stats?.locationEventsToday ?? []).map((p) => ({ lat: p.lat, lng: p.lng })),
    [stats?.locationEventsToday],
  )

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-6xl">
        <p className="text-sm text-danger">{error ?? 'Technician not found.'}</p>
        <Link to="/technicians" className="mt-4 inline-block text-sm font-semibold text-[var(--margen-accent)]">
          Back to technicians
        </Link>
      </div>
    )
  }

  const t = stats.technician

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/technicians" className="text-sm font-semibold text-[var(--margen-accent)] hover:underline">
        ← Technicians
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#ebebeb] bg-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#111111] text-lg font-bold text-white">
            {initials(t.name)}
          </span>
          <div>
            <h1 className="page-title">{t.name}</h1>
            <p className="mt-1 text-sm text-[#888888]">
              {[t.phone, t.email].filter(Boolean).join(' · ') || 'No contact on file'}
              {t.role ? ` · ${t.role}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={statusBadgeClass(t.status)}>{t.status.replace('_', ' ')}</span>
              {stats.clockedInNow ? (
                <span className="inline-flex rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
                  Clocked in now
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#f4f4f4] px-2.5 py-1 text-xs font-semibold text-[#555555]">
                  Off the clock
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-[#888888]">Productivity score</p>
          <p className="text-4xl font-bold tabular-nums text-[#111111]">{stats.productivityScore}</p>
          <p className="mt-1 text-xs text-[#888888]">0–100 · jobs, on-time, ratings</p>
        </div>
      </header>

      <p className="text-sm text-[#888888]">
        <span className="font-semibold text-[#111111]">{stats.totalJobsAllTime}</span> jobs completed all time
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Avg job duration', value: stats.avgDurationMinutes != null ? `${stats.avgDurationMinutes} min` : '—' },
          {
            label: 'On-time rate',
            value: stats.onTimeRate != null ? `${Math.round(stats.onTimeRate * 100)}%` : '—',
          },
          { label: 'Customer rating', value: stats.avgRating != null ? `${stats.avgRating} / 5` : '—' },
          { label: 'Revenue (month)', value: formatUsdFromCents(stats.revenueMonthCents) },
          { label: 'Hours this week', value: `${stats.hoursWeek}h` },
          { label: 'Jobs this month', value: String(stats.jobsMonth) },
        ].map((s) => (
          <div key={s.label} className="margen-card">
            <p className="label-caps">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-[#111111]">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#ebebeb] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111111]">Jobs this week (by day)</h2>
          {stats.jobsPerDayWeek.every((d) => d.count === 0) ? (
            <p className="mt-8 text-center text-sm text-[#888888]">No jobs completed yet this week.</p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.jobsPerDayWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#111111" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#ebebeb] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#111111]">Monthly trend (8 weeks)</h2>
          {stats.jobsPerWeek8.every((w) => w.count === 0) ? (
            <p className="mt-8 text-center text-sm text-[#888888]">No completed jobs in the last 8 weeks.</p>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.jobsPerWeek8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--margen-accent, #2563eb)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#ebebeb] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#111111]">Location history (today)</h2>
        {stats.locationEventsToday.length === 0 ? (
          <p className="mt-4 text-sm text-[#888888]">No GPS points recorded today.</p>
        ) : isLoaded ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#ebebeb]">
            <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={12}>
              {routePath.length > 1 ? (
                <Polyline path={routePath} options={{ strokeColor: '#111111', strokeWeight: 4 }} />
              ) : null}
              {stats.locationEventsToday.map((p, i) => (
                <Marker key={i} position={{ lat: p.lat, lng: p.lng }} />
              ))}
            </GoogleMap>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#888888]">Map loading…</p>
        )}
      </div>

      <div className="rounded-xl border border-[#ebebeb] bg-white">
        <h2 className="border-b border-[#ebebeb] px-5 py-4 text-sm font-semibold text-[#111111]">Recent jobs</h2>
        {stats.recentJobs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#888888]">No jobs yet.</p>
        ) : (
          <ul className="divide-y divide-[#f0f0f0]">
            {stats.recentJobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-[#111111]">{j.title}</p>
                  <p className="text-[#888888]">{j.customerName}</p>
                </div>
                <div className="text-right text-[#888888]">
                  <p className="capitalize">{j.status.replace('_', ' ')}</p>
                  {j.durationMinutes != null ? <p>{j.durationMinutes} min</p> : null}
                  {j.rating != null ? <p>{j.rating} ★</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
