import { supabase } from './supabase'

export type OwnerTechMapPoint = {
  id: string
  name: string
  last_lat: number
  last_lng: number
  map_color: string | null
  status?: string
}

export type OwnerRecentJob = {
  id: string
  title: string
  status: string
  urgency: string
  scheduled_at: string | null
  technicians: { name: string } | null
}

export type OwnerDashboardSnapshot = {
  companyName: string | null
  jobsToday: number
  techActive: number
  revenueTodayCents: number
  technicians: OwnerTechMapPoint[]
  recentJobs: OwnerRecentJob[]
}

function localDayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export async function fetchOwnerDashboard(ownerId: string): Promise<OwnerDashboardSnapshot> {
  const { startIso, endIso } = localDayIsoRange()

  const [
    profileRes,
    jobsTodayRes,
    techActiveRes,
    revenueRes,
    techsLiveRes,
    techsFallbackRes,
    recentJobsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('company_name').eq('id', ownerId).maybeSingle(),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso),
    supabase
      .from('technicians')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .in('status', ['available', 'busy']),
    supabase
      .from('jobs')
      .select('revenue_cents')
      .eq('owner_id', ownerId)
      .eq('status', 'completed')
      .gte('completed_at', startIso)
      .lte('completed_at', endIso),
    supabase
      .from('technicians_live')
      .select('id, name, last_lat, last_lng, map_color')
      .eq('owner_id', ownerId),
    supabase
      .from('technicians')
      .select('id, name, status, last_lat, last_lng, map_color')
      .eq('owner_id', ownerId),
    supabase
      .from('jobs')
      .select('id, title, status, urgency, scheduled_at, technicians ( name )')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  let technicians: OwnerTechMapPoint[] = []
  const liveRows = techsLiveRes.data ?? []
  for (const row of liveRows) {
    const lat = row.last_lat as number | null
    const lng = row.last_lng as number | null
    if (lat == null || lng == null) continue
    technicians.push({
      id: String(row.id),
      name: String(row.name ?? 'Technician'),
      last_lat: lat,
      last_lng: lng,
      map_color: (row.map_color as string | null) ?? null,
    })
  }

  if (technicians.length === 0) {
    for (const row of techsFallbackRes.data ?? []) {
      const lat = row.last_lat as number | null
      const lng = row.last_lng as number | null
      if (lat == null || lng == null) continue
      technicians.push({
        id: String(row.id),
        name: String(row.name ?? 'Technician'),
        last_lat: lat,
        last_lng: lng,
        map_color: (row.map_color as string | null) ?? null,
        status: String(row.status ?? ''),
      })
    }
  }

  const revenueTodayCents = (revenueRes.data ?? []).reduce(
    (sum, row) => sum + (Number(row.revenue_cents) || 0),
    0,
  )

  return {
    companyName: (profileRes.data as { company_name?: string | null } | null)?.company_name ?? null,
    jobsToday: jobsTodayRes.count ?? 0,
    techActive: techActiveRes.count ?? 0,
    revenueTodayCents,
    technicians,
    recentJobs: (recentJobsRes.data ?? []).map((row) => {
      const raw = row as {
        id: string
        title: string
        status: string
        urgency: string
        scheduled_at: string | null
        technicians: { name: string } | { name: string }[] | null
      }
      const tech = raw.technicians
      const name = Array.isArray(tech) ? tech[0]?.name : tech?.name
      return {
        id: raw.id,
        title: raw.title,
        status: raw.status,
        urgency: raw.urgency,
        scheduled_at: raw.scheduled_at,
        technicians: name ? { name } : null,
      }
    }),
  }
}
