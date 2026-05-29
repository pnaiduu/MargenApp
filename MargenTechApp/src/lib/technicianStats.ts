import { supabase } from './supabase'

function localDayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function localWeekRange() {
  const d = new Date()
  const day = d.getDay()
  const diffToMon = (day + 6) % 7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diffToMon, 0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

export type TechHomeStats = {
  greeting: string
  jobsToday: number
  hoursToday: number
  jobsWeek: number
  onTimeRateWeek: number | null
  avgRatingWeek: number | null
  jobsPerDay: { label: string; count: number }[]
  teamRank: number | null
  teamSize: number
  streakDays: number
  nextJob: {
    id: string
    title: string
    customer: string
    scheduledAt: string | null
  } | null
}

export type TechProfileStats = {
  totalJobs: number
  totalHours: number
  avgRating: number | null
  totalDistanceKm: number
  jobsPerMonth: { label: string; count: number }[]
  recentJobs: {
    id: string
    title: string
    status: string
    completedAt: string | null
    rating: number | null
  }[]
  badges: string[]
}

function greetingForHour(h: number) {
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export async function fetchTechnicianHomeStats(
  technicianId: string,
  ownerId: string,
  techName: string,
): Promise<TechHomeStats> {
  const { startIso: dayStart, endIso: dayEnd } = localDayRange()
  const { startIso: weekStart, endIso: weekEnd } = localWeekRange()

  const [todayJobs, weekJobs, sessionsToday, sessionsWeek, allTechJobsWeek, upcoming] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd),
    supabase
      .from('jobs')
      .select('id, completed_at, on_time, technician_rating, started_at')
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEnd),
    supabase
      .from('technician_clock_sessions')
      .select('total_minutes, clock_in_at, clock_out_at')
      .eq('technician_id', technicianId)
      .gte('clock_in_at', dayStart)
      .lte('clock_in_at', dayEnd),
    supabase
      .from('technician_clock_sessions')
      .select('total_minutes, clock_in_at, clock_out_at')
      .eq('technician_id', technicianId)
      .gte('clock_in_at', weekStart)
      .lte('clock_in_at', weekEnd),
    supabase
      .from('jobs')
      .select('technician_id')
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEnd),
    supabase
      .from('jobs')
      .select('id, title, scheduled_at, customers(name)')
      .eq('technician_id', technicianId)
      .in('status', ['pending', 'in_progress'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1),
  ])

  const week = weekJobs.data ?? []
  const onTime = week.filter((j) => j.on_time === true)
  const ratings = week
    .map((j) => (j.technician_rating != null ? Number(j.technician_rating) : null))
    .filter((r): r is number => r != null && r > 0)

  const jobsPerDay: { label: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    jobsPerDay.push({
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: week.filter((j) => j.completed_at && String(j.completed_at).slice(0, 10) === key).length,
    })
  }

  const hoursToday =
    (sessionsToday.data ?? []).reduce(
      (s, r) => s + (Number(r.total_minutes) || minutesBetween(r.clock_in_at as string, r.clock_out_at as string) || 0),
      0,
    ) / 60

  const counts = new Map<string, number>()
  for (const j of allTechJobsWeek.data ?? []) {
    const tid = j.technician_id as string
    if (!tid) continue
    counts.set(tid, (counts.get(tid) ?? 0) + 1)
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const rankIdx = sorted.findIndex(([id]) => id === technicianId)
  const teamRank = rankIdx >= 0 ? rankIdx + 1 : null

  let streak = 0
  for (let d = 0; d < 14; d++) {
    const day = new Date()
    day.setDate(day.getDate() - d)
    const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0).toISOString()
    const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).toISOString()
    const { count } = await supabase
      .from('job_ratings')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('rating', 5)
      .gte('submitted_at', ds)
      .lte('submitted_at', de)
    if ((count ?? 0) > 0) streak++
    else if (d > 0) break
  }

  const up = upcoming.data?.[0] as
    | { id: string; title: string; scheduled_at: string | null; customers: { name?: string } | { name?: string }[] | null }
    | undefined

  let nextJob: TechHomeStats['nextJob'] = null
  if (up) {
    const c = up.customers
    const name = Array.isArray(c) ? c[0]?.name : c?.name
    nextJob = {
      id: up.id,
      title: up.title,
      customer: name ?? 'Customer',
      scheduledAt: up.scheduled_at,
    }
  }

  return {
    greeting: `${greetingForHour(new Date().getHours())}, ${techName.split(' ')[0] ?? techName}`,
    jobsToday: todayJobs.count ?? 0,
    hoursToday: Math.round(hoursToday * 10) / 10,
    jobsWeek: week.length,
    onTimeRateWeek: week.length > 0 ? onTime.length / week.length : null,
    avgRatingWeek:
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    jobsPerDay,
    teamRank,
    teamSize: sorted.length,
    streakDays: streak,
    nextJob,
  }
}

export async function fetchTechnicianProfileStats(technicianId: string): Promise<TechProfileStats> {
  const [{ count: totalJobs }, sessions, ratingsRes, recentRes] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('status', 'completed'),
    supabase.from('technician_clock_sessions').select('total_minutes, clock_in_at, clock_out_at').eq('technician_id', technicianId),
    supabase.from('job_ratings').select('rating').eq('technician_id', technicianId),
    supabase
      .from('jobs')
      .select('id, title, status, completed_at, technician_rating')
      .eq('technician_id', technicianId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(15),
  ])

  const totalHours =
    (sessions.data ?? []).reduce(
      (s, r) => s + (Number(r.total_minutes) || minutesBetween(r.clock_in_at as string, r.clock_out_at as string) || 0),
      0,
    ) / 60

  const stars = (ratingsRes.data ?? []).map((r) => Number((r as { rating: number }).rating)).filter((n) => n > 0)
  const avgRating =
    stars.length > 0 ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : null

  const jobsPerMonth: { label: string; count: number }[] = []
  for (let m = 5; m >= 0; m--) {
    const d = new Date()
    d.setMonth(d.getMonth() - m, 1)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', technicianId)
      .eq('status', 'completed')
      .gte('completed_at', d.toISOString())
      .lte('completed_at', end.toISOString())
    jobsPerMonth.push({
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      count: count ?? 0,
    })
  }

  const total = totalJobs ?? 0
  const badges: string[] = []
  if (total >= 1) badges.push('First Job')
  if (total >= 10) badges.push('10 Jobs')
  if (total >= 50) badges.push('50 Jobs')
  if (total >= 100) badges.push('100 Jobs')
  if (stars.filter((s) => s === 5).length >= 5) badges.push('5-Star Streak')
  const weekJobs = await supabase
    .from('jobs')
    .select('on_time')
    .eq('technician_id', technicianId)
    .eq('status', 'completed')
    .gte('completed_at', localWeekRange().startIso)
  const wj = weekJobs.data ?? []
  if (wj.length >= 5 && wj.every((j) => j.on_time === true)) badges.push('On-Time Champion')

  return {
    totalJobs: total,
    totalHours: Math.round(totalHours * 10) / 10,
    avgRating,
    totalDistanceKm: 0,
    jobsPerMonth,
    recentJobs: (recentRes.data ?? []).map((j) => ({
      id: j.id as string,
      title: (j.title as string) ?? 'Job',
      status: j.status as string,
      completedAt: j.completed_at as string | null,
      rating: j.technician_rating != null ? Number(j.technician_rating) : null,
    })),
    badges,
  }
}
