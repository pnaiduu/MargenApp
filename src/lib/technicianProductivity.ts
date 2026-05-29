import { localWeekRangeIso } from './dates'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PerformanceBadge = 'Excellent' | 'Good' | 'Needs Attention'

export type LeaderboardRow = {
  rank: number
  technicianId: string
  name: string
  jobsCompletedWeek: number
  avgDurationMinutes: number | null
  onTimeRate: number | null
  avgRating: number | null
  hoursWorkedWeek: number
  revenueWeekCents: number
  badge: PerformanceBadge
  clockedInNow: boolean
}

export type TechnicianProfileStats = {
  technician: {
    id: string
    name: string
    phone: string | null
    email: string | null
    role: string | null
    status: string
    user_id: string | null
  }
  totalJobsAllTime: number
  clockedInNow: boolean
  avgDurationMinutes: number | null
  onTimeRate: number | null
  avgRating: number | null
  revenueMonthCents: number
  hoursWeek: number
  jobsMonth: number
  productivityScore: number
  jobsPerDayWeek: { day: string; count: number }[]
  jobsPerWeek8: { week: string; count: number }[]
  recentJobs: {
    id: string
    title: string
    status: string
    customerName: string
    durationMinutes: number | null
    rating: number | null
    completedAt: string | null
  }[]
  locationEventsToday: { lat: number; lng: number; recordedAt: string }[]
}

function performanceBadge(
  jobs: number,
  onTimeRate: number | null,
  avgRating: number | null,
): PerformanceBadge {
  const onTime = onTimeRate ?? 0
  const rating = avgRating ?? 0
  if (jobs >= 8 && onTime >= 0.9 && rating >= 4.5) return 'Excellent'
  if (jobs >= 4 && onTime >= 0.75 && rating >= 4) return 'Good'
  return 'Needs Attention'
}

function productivityScore(jobsNorm: number, onTimeRate: number | null, avgRating: number | null): number {
  const j = Math.min(1, jobsNorm / 10) * 40
  const o = (onTimeRate ?? 0) * 30
  const r = ((avgRating ?? 0) / 5) * 30
  return Math.round(Math.min(100, j + o + r))
}

function minutesBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export { initials }

export async function fetchTeamLeaderboard(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<LeaderboardRow[]> {
  const { startIso, endIso } = localWeekRangeIso()

  const [techRes, jobsRes, sessionsRes, openSessionsRes] = await Promise.all([
    supabase
      .from('technicians')
      .select('id, name, user_id, status')
      .eq('owner_id', ownerId)
      .neq('name', 'Open team invite')
      .order('name'),
    supabase
      .from('jobs')
      .select('id, technician_id, revenue_cents, started_at, completed_at, on_time, technician_rating, status')
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .gte('completed_at', startIso)
      .lte('completed_at', endIso),
    supabase
      .from('technician_clock_sessions')
      .select('technician_id, total_minutes, clock_in_at, clock_out_at')
      .eq('owner_id', ownerId)
      .gte('clock_in_at', startIso)
      .lte('clock_in_at', endIso),
    supabase
      .from('technician_clock_sessions')
      .select('technician_id')
      .eq('owner_id', ownerId)
      .is('clock_out_at', null),
  ])

  const techs = techRes.data ?? []
  const jobs = jobsRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const clockedIn = new Set((openSessionsRes.data ?? []).map((r) => r.technician_id as string))

  const rows: Omit<LeaderboardRow, 'rank'>[] = techs.map((t) => {
    const tid = t.id as string
    const techJobs = jobs.filter((j) => j.technician_id === tid)
    const durations = techJobs
      .map((j) => minutesBetween(j.started_at as string | null, j.completed_at as string | null))
      .filter((m): m is number => m != null)
    const avgDuration =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
    const onTimeJobs = techJobs.filter((j) => j.on_time === true)
    const onTimeRate = techJobs.length > 0 ? onTimeJobs.length / techJobs.length : null
    const ratings = techJobs
      .map((j) => (j.technician_rating != null ? Number(j.technician_rating) : null))
      .filter((r): r is number => r != null && r > 0)
    const avgRating =
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null
    const mins = sessions
      .filter((s) => s.technician_id === tid)
      .reduce((sum, s) => {
        if (s.total_minutes != null) return sum + Number(s.total_minutes)
        return sum + (minutesBetween(s.clock_in_at as string, s.clock_out_at as string) ?? 0)
      }, 0)
    const revenueWeekCents = techJobs.reduce((sum, j) => sum + (j.revenue_cents ?? 0), 0)

    return {
      technicianId: tid,
      name: t.name as string,
      jobsCompletedWeek: techJobs.length,
      avgDurationMinutes: avgDuration,
      onTimeRate,
      avgRating,
      hoursWorkedWeek: Math.round((mins / 60) * 10) / 10,
      revenueWeekCents,
      badge: performanceBadge(techJobs.length, onTimeRate, avgRating),
      clockedInNow: clockedIn.has(tid),
    }
  })

  rows.sort((a, b) => b.jobsCompletedWeek - a.jobsCompletedWeek)

  return rows.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }))
}

export async function fetchTechnicianProfile(
  supabase: SupabaseClient,
  ownerId: string,
  technicianId: string,
): Promise<TechnicianProfileStats | null> {
  const { startIso: weekStart, endIso: weekEnd } = localWeekRangeIso()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartIso = monthStart.toISOString()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { data: tech } = await supabase
    .from('technicians')
    .select('id, name, phone, email, role, status, user_id')
    .eq('id', technicianId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!tech) return null

  const [allJobsRes, weekJobsRes, monthJobsRes, sessionsRes, openSess, recentRes, locRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('status', 'completed'),
    supabase
      .from('jobs')
      .select('id, completed_at, started_at, on_time, technician_rating, revenue_cents')
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEnd),
    supabase
      .from('jobs')
      .select('id, revenue_cents')
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', monthStartIso),
    supabase
      .from('technician_clock_sessions')
      .select('total_minutes, clock_in_at, clock_out_at')
      .eq('technician_id', technicianId)
      .gte('clock_in_at', weekStart)
      .lte('clock_in_at', weekEnd),
    supabase
      .from('technician_clock_sessions')
      .select('id')
      .eq('technician_id', technicianId)
      .is('clock_out_at', null)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id, title, status, completed_at, started_at, technician_rating, customers(name)')
      .eq('technician_id', technicianId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from('technician_location_events')
      .select('lat, lng, recorded_at')
      .eq('technician_id', technicianId)
      .gte('recorded_at', todayStart.toISOString())
      .lte('recorded_at', todayEnd.toISOString())
      .order('recorded_at', { ascending: true }),
  ])

  const weekJobs = weekJobsRes.data ?? []
  const durations = weekJobs
    .map((j) => minutesBetween(j.started_at as string | null, j.completed_at as string | null))
    .filter((m): m is number => m != null)
  const avgDuration =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
  const onTimeRate =
    weekJobs.length > 0 ? weekJobs.filter((j) => j.on_time === true).length / weekJobs.length : null
  const ratings = weekJobs
    .map((j) => (j.technician_rating != null ? Number(j.technician_rating) : null))
    .filter((r): r is number => r != null && r > 0)
  const avgRating =
    ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null

  const hoursWeek =
    (sessionsRes.data ?? []).reduce((sum, s) => {
      if (s.total_minutes != null) return sum + Number(s.total_minutes)
      return sum + (minutesBetween(s.clock_in_at as string, s.clock_out_at as string) ?? 0)
    }, 0) / 60

  const revenueMonthCents = (monthJobsRes.data ?? []).reduce((sum, j) => sum + (j.revenue_cents ?? 0), 0)

  const jobsPerDayWeek: { day: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString(undefined, { weekday: 'short' })
    const count = weekJobs.filter((j) => j.completed_at && (j.completed_at as string).slice(0, 10) === key).length
    jobsPerDayWeek.push({ day: label, count })
  }

  const jobsPerWeek8: { week: string; count: number }[] = []
  for (let w = 7; w >= 0; w--) {
    const end = new Date()
    end.setDate(end.getDate() - w * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString())
    jobsPerWeek8.push({
      week: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: count ?? 0,
    })
  }

  const recentJobs = (recentRes.data ?? []).map((j) => {
    const cust = j.customers as { name?: string } | { name?: string }[] | null
    const name = Array.isArray(cust) ? cust[0]?.name : cust?.name
    return {
      id: j.id as string,
      title: (j.title as string) ?? 'Job',
      status: j.status as string,
      customerName: name ?? 'Customer',
      durationMinutes: minutesBetween(j.started_at as string | null, j.completed_at as string | null),
      rating: j.technician_rating != null ? Number(j.technician_rating) : null,
      completedAt: j.completed_at as string | null,
    }
  })

  return {
    technician: tech as TechnicianProfileStats['technician'],
    totalJobsAllTime: allJobsRes.count ?? 0,
    clockedInNow: Boolean(openSess.data),
    avgDurationMinutes: avgDuration,
    onTimeRate,
    avgRating,
    revenueMonthCents,
    hoursWeek: Math.round(hoursWeek * 10) / 10,
    jobsMonth: monthJobsRes.data?.length ?? 0,
    productivityScore: productivityScore(weekJobs.length, onTimeRate, avgRating),
    jobsPerDayWeek,
    jobsPerWeek8,
    recentJobs,
    locationEventsToday: (locRes.data ?? []).map((e) => ({
      lat: Number(e.lat),
      lng: Number(e.lng),
      recordedAt: e.recorded_at as string,
    })),
  }
}

export type IdleTimeRow = {
  technicianId: string
  name: string
  clockedHours: number
  onJobHours: number
  idleHours: number
}

export async function fetchIdleTimeByTechnician(
  supabase: SupabaseClient,
  ownerId: string,
  startIso: string,
  endIso: string,
): Promise<IdleTimeRow[]> {
  const [techRes, sessRes, jobsRes] = await Promise.all([
    supabase.from('technicians').select('id, name').eq('owner_id', ownerId),
    supabase
      .from('technician_clock_sessions')
      .select('technician_id, total_minutes, clock_in_at, clock_out_at')
      .eq('owner_id', ownerId)
      .gte('clock_in_at', startIso)
      .lte('clock_in_at', endIso),
    supabase
      .from('jobs')
      .select('technician_id, started_at, completed_at')
      .eq('owner_id', ownerId)
      .not('started_at', 'is', null)
      .gte('started_at', startIso)
      .lte('started_at', endIso),
  ])

  const techs = techRes.data ?? []
  const byTech = new Map<string, IdleTimeRow>()
  for (const t of techs) {
    byTech.set(t.id as string, {
      technicianId: t.id as string,
      name: (t.name as string) ?? 'Technician',
      clockedHours: 0,
      onJobHours: 0,
      idleHours: 0,
    })
  }

  for (const s of sessRes.data ?? []) {
    const tid = s.technician_id as string
    const row = byTech.get(tid)
    if (!row) continue
    const mins =
      s.total_minutes != null
        ? Number(s.total_minutes)
        : minutesBetween(s.clock_in_at as string, s.clock_out_at as string) ?? 0
    row.clockedHours += mins / 60
  }

  for (const j of jobsRes.data ?? []) {
    const tid = j.technician_id as string | null
    if (!tid) continue
    const row = byTech.get(tid)
    if (!row) continue
    const mins = minutesBetween(j.started_at as string, j.completed_at as string) ?? 0
    row.onJobHours += mins / 60
  }

  return Array.from(byTech.values())
    .map((r) => ({
      ...r,
      clockedHours: Math.round(r.clockedHours * 10) / 10,
      onJobHours: Math.round(r.onJobHours * 10) / 10,
      idleHours: Math.round(Math.max(0, r.clockedHours - r.onJobHours) * 10) / 10,
    }))
    .filter((r) => r.clockedHours > 0)
    .sort((a, b) => b.idleHours - a.idleHours)
}
