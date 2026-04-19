import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Body = { job_id: string }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function milesToMeters(mi: number) {
  return mi * 1609.344
}

function todayLocalRangeIso() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

async function distanceMatrixMiles(
  key: string,
  origins: { lat: number; lng: number; technician_id: string }[],
  destination: { lat: number; lng: number },
) {
  // Google Distance Matrix: max 25 origins per request (standard).
  const originStr = origins.map((o) => `${o.lat},${o.lng}`).join('|')
  const destStr = `${destination.lat},${destination.lng}`
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(originStr)}` +
    `&destinations=${encodeURIComponent(destStr)}&key=${encodeURIComponent(key)}`
  const res = await fetch(url)
  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw) throw new Error('Distance Matrix request failed')
  const rows = raw.rows as { elements: { status: string; distance?: { value: number; text: string }; duration?: { value: number } }[] }[]
  const out: Record<string, { distance_meters: number; distance_text: string; duration_seconds: number }> = {}
  for (let i = 0; i < origins.length; i++) {
    const el = rows?.[i]?.elements?.[0]
    if (!el || el.status !== 'OK' || !el.distance?.value || !el.duration?.value) continue
    out[origins[i]!.technician_id] = {
      distance_meters: el.distance.value,
      distance_text: el.distance.text,
      duration_seconds: el.duration.value,
    }
  }
  return { raw, out }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (!body.job_id) return json(400, { error: 'Missing job_id' })

  const admin = supabaseAdmin()

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, owner_id, job_type, urgency, technician_id, customers(lat, lng, address)')
    .eq('id', body.job_id)
    .maybeSingle()
  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })
  if (job.owner_id !== user.id) return json(403, { error: 'Forbidden' })

  const dest = job.customers as unknown as { lat: number | null; lng: number | null; address: string | null } | null
  const dLat = dest?.lat ?? null
  const dLng = dest?.lng ?? null
  if (dLat == null || dLng == null) {
    await admin.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title: 'Auto-assignment failed',
      message: 'Job has no customer coordinates. Add lat/lng to dispatch automatically.',
      link: '/jobs',
      read: false,
    })
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: job.urgency === 'emergency',
      job_type: job.job_type,
      reason: 'Missing customer coordinates',
      candidate_count: 0,
      candidates: [],
    })
    return json(409, { error: 'Job has no customer coordinates' })
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('service_area_center_lat, service_area_center_lng, service_area_radius')
    .eq('id', job.owner_id)
    .maybeSingle()
  const centerLat = (prof as { service_area_center_lat: number | null } | null)?.service_area_center_lat ?? null
  const centerLng = (prof as { service_area_center_lng: number | null } | null)?.service_area_center_lng ?? null
  const radiusMi = (prof as { service_area_radius: number | null } | null)?.service_area_radius ?? null
  if (centerLat == null || centerLng == null || radiusMi == null || radiusMi <= 0) {
    await admin.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title: 'No available technicians for this job',
      message: 'Service area is not set, so auto-assignment is disabled.',
      link: '/settings',
      read: false,
    })
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: job.urgency === 'emergency',
      job_type: job.job_type,
      reason: 'Service area not set',
      candidate_count: 0,
      candidates: [],
    })
    return json(409, { error: 'Service area not set' })
  }

  // Must be within service area
  const distFromCenter = haversineMeters(centerLat, centerLng, dLat, dLng)
  if (distFromCenter > milesToMeters(radiusMi)) {
    await admin.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title: 'Job outside service area',
      message: 'No auto-assignment performed because the job location is outside your service area.',
      link: '/settings',
      read: false,
    })
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: job.urgency === 'emergency',
      job_type: job.job_type,
      reason: 'Job outside service area',
      candidate_count: 0,
      candidates: [],
    })
    return json(409, { error: 'Job outside service area' })
  }

  // Candidate pool: clocked in + available
  // “Clocked in” = open technician_clock_session exists.
  const { data: availableTechs, error: techErr } = await admin
    .from('technicians')
    .select('id, name, status, skills, last_lat, last_lng')
    .eq('owner_id', job.owner_id)
    .eq('status', 'available')
  if (techErr) return json(500, { error: techErr.message })

  const techIds = (availableTechs ?? []).map((t) => (t as { id: string }).id)
  let clockedInSet = new Set<string>()
  if (techIds.length) {
    const { data: openSessions } = await admin
      .from('technician_clock_sessions')
      .select('technician_id')
      .eq('owner_id', job.owner_id)
      .in('technician_id', techIds)
      .is('clock_out_at', null)
    clockedInSet = new Set((openSessions ?? []).map((s) => (s as { technician_id: string }).technician_id))
  }

  const isEmergency = job.urgency === 'emergency'
  const jt = (job.job_type ?? 'general').toString().trim().toLowerCase()

  const clockedInAvailable = (availableTechs ?? [])
    .map((t) => t as { id: string; name: string; skills: string[] | null; last_lat: number | null; last_lng: number | null })
    .filter((t) => clockedInSet.has(t.id))

  const afterSkill = isEmergency
    ? clockedInAvailable
    : clockedInAvailable.filter((t) => {
        const skills = (t.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
        return skills.length === 0 || skills.includes(jt)
      })

  if (afterSkill.length === 0) {
    const msg = isEmergency
      ? 'No clocked-in technicians are available.'
      : 'No clocked-in technicians with the right skill are available.'
    await admin.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title: 'No available technicians for this job',
      message: 'No available technicians for this job — all techs are busy or off duty.',
      link: '/technicians',
      read: false,
    })
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: isEmergency,
      job_type: job.job_type,
      reason: msg,
      candidate_count: clockedInAvailable.length,
      candidates: clockedInAvailable.map((t) => ({ technician_id: t.id, name: t.name })),
    })
    return json(409, { error: msg })
  }

  // Distance Matrix (driving distance) primary ranking
  const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (!googleKey) return json(500, { error: 'Missing GOOGLE_MAPS_API_KEY secret' })

  const origins = afterSkill
    .filter((t) => t.last_lat != null && t.last_lng != null)
    .map((t) => ({ lat: t.last_lat as number, lng: t.last_lng as number, technician_id: t.id }))

  if (origins.length === 0) {
    const msg = 'No available technicians have GPS coordinates yet.'
    await admin.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title: 'Auto-assignment failed',
      message: msg,
      link: '/technicians',
      read: false,
    })
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: isEmergency,
      job_type: job.job_type,
      reason: msg,
      candidate_count: afterSkill.length,
      candidates: afterSkill.map((t) => ({ technician_id: t.id, name: t.name })),
    })
    return json(409, { error: msg })
  }

  const { raw, out } = await distanceMatrixMiles(googleKey, origins.slice(0, 25), { lat: dLat, lng: dLng })

  // Add jobs-today tie breaker
  const { startIso, endIso } = todayLocalRangeIso()
  const { data: jobCounts } = await admin
    .from('jobs')
    .select('technician_id')
    .eq('owner_id', job.owner_id)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)

  const countMap = new Map<string, number>()
  for (const r of (jobCounts ?? []) as { technician_id: string | null }[]) {
    if (!r.technician_id) continue
    countMap.set(r.technician_id, (countMap.get(r.technician_id) ?? 0) + 1)
  }

  const scored = afterSkill
    .map((t) => {
      const dm = out[t.id]
      const jobsToday = countMap.get(t.id) ?? 0
      return {
        technician_id: t.id,
        name: t.name,
        jobs_today: jobsToday,
        distance_meters: dm?.distance_meters ?? null,
        distance_text: dm?.distance_text ?? null,
        duration_seconds: dm?.duration_seconds ?? null,
      }
    })
    .filter((s) => s.distance_meters != null)
    .sort((a, b) => {
      if ((a.distance_meters as number) !== (b.distance_meters as number)) return (a.distance_meters as number) - (b.distance_meters as number)
      return a.jobs_today - b.jobs_today
    })

  const chosen = scored[0] ?? null
  if (!chosen) {
    const msg = 'Could not compute driving distance for any technician.'
    await admin.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: isEmergency,
      job_type: job.job_type,
      reason: msg,
      candidate_count: afterSkill.length,
      candidates: afterSkill.map((t) => ({ technician_id: t.id, name: t.name })),
      raw_distance_matrix: raw,
    })
    return json(409, { error: msg })
  }

  const note = `Assigned to ${chosen.name} — closest available, ${chosen.distance_text ?? ''} away`
  await admin.from('jobs').update({ technician_id: chosen.technician_id, assignment_note: note }).eq('id', job.id)

  await admin.from('job_assignment_decisions').insert({
    owner_id: job.owner_id,
    job_id: job.id,
    kind: 'auto',
    chosen_technician_id: chosen.technician_id,
    emergency: isEmergency,
    job_type: job.job_type,
    reason: note,
    distance_meters: Math.round(chosen.distance_meters as number),
    distance_text: chosen.distance_text,
    duration_seconds: chosen.duration_seconds ?? null,
    candidate_count: afterSkill.length,
    candidates: scored,
    raw_distance_matrix: raw,
  })

  await admin.from('notifications').insert({
    owner_id: job.owner_id,
    type: 'job_auto_assigned',
    title: 'Job auto-assigned',
    message: note,
    link: '/jobs',
    read: false,
  })

  return json(200, { ok: true, chosen, note })
})

