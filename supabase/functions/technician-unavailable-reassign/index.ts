import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Body = { technician_id: string }

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

async function sendExpoPush(tokens: string[], payload: { title: string; body: string; data?: Record<string, unknown> }) {
  if (!tokens.length) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
      })),
    ),
  })
}

type Tech = {
  id: string
  user_id: string | null
  name: string
  status: string
  skills: string[] | null
  last_lat: number | null
  last_lng: number | null
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
  if (!body.technician_id) return json(400, { error: 'Missing technician_id' })

  const admin = supabaseAdmin()

  const { data: tech, error: techErr } = await admin
    .from('technicians')
    .select('id, owner_id, name')
    .eq('id', body.technician_id)
    .maybeSingle()
  if (techErr || !tech) return json(404, { error: techErr?.message ?? 'Technician not found' })
  if (tech.owner_id !== user.id) return json(403, { error: 'Only the owner can do this' })

  // Mark technician unavailable (off_duty)
  await admin.from('technicians').update({ status: 'off_duty' }).eq('id', tech.id).eq('owner_id', tech.owner_id)

  // Load jobs that need reassignment
  const { data: jobs, error: jobsErr } = await admin
    .from('jobs')
    .select('id, title, job_type, status, technician_id, customer_id, customers(address, lat, lng)')
    .eq('owner_id', tech.owner_id)
    .eq('technician_id', tech.id)
    .in('status', ['pending', 'in_progress'])
    .order('scheduled_at', { ascending: true })
  if (jobsErr) return json(500, { error: jobsErr.message })

  // Load available technicians for owner
  const { data: techs, error: techsErr } = await admin
    .from('technicians')
    .select('id, user_id, name, status, skills, last_lat, last_lng')
    .eq('owner_id', tech.owner_id)
    .eq('status', 'available')
  if (techsErr) return json(500, { error: techsErr.message })

  const candidates = (techs ?? []) as Tech[]

  const reassigned: { job_id: string; job_title: string; from: string; to: string | null }[] = []

  for (const j of jobs ?? []) {
    const jobType = (j.job_type ?? 'general').toString().trim().toLowerCase()
    const cust = j.customers as unknown as { address: string | null; lat: number | null; lng: number | null } | null
    const cLat = cust?.lat ?? null
    const cLng = cust?.lng ?? null

    let best: { tech: Tech; score: number } | null = null
    for (const t of candidates) {
      // skill match: if skills empty -> allow; else must include jobType
      const skills = (t.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
      const skillOk = skills.length === 0 || skills.includes(jobType)
      if (!skillOk) continue

      let score = 0
      // Prefer closer tech if we have coordinates for both
      if (cLat != null && cLng != null && t.last_lat != null && t.last_lng != null) {
        const dist = haversineMeters(cLat, cLng, t.last_lat, t.last_lng)
        score -= dist // smaller dist => higher score
      }
      // Prefer explicit skill match when list is present
      if (skills.includes(jobType)) score += 250

      if (!best || score > best.score) best = { tech: t, score }
    }

    const toTech = best?.tech ?? null
    if (!toTech) {
      reassigned.push({ job_id: j.id, job_title: j.title ?? 'Job', from: tech.name, to: null })
      continue
    }

    const { error: upErr } = await admin
      .from('jobs')
      .update({ technician_id: toTech.id })
      .eq('id', j.id)
      .eq('owner_id', tech.owner_id)
    if (upErr) return json(500, { error: upErr.message })

    reassigned.push({ job_id: j.id, job_title: j.title ?? 'Job', from: tech.name, to: toTech.name })

    // Push notify the newly assigned technician (best effort)
    if (toTech.user_id) {
      const { data: toks } = await admin
        .from('expo_push_tokens')
        .select('token')
        .eq('user_id', toTech.user_id)
        .order('updated_at', { ascending: false })
        .limit(2)
      const tokens = (toks ?? []).map((r) => (r as { token: string }).token).filter(Boolean)
      const addr = cust?.address?.trim() || 'customer location'
      await sendExpoPush(tokens, { title: 'New job assigned', body: `${j.title ?? 'Job'} at ${addr}`, data: { job_id: j.id } })
    }
  }

  // Owner summary notification
  const lines = reassigned
    .slice(0, 8)
    .map((r) => `${r.job_title} → ${r.to ?? 'Unassigned'}`)
    .join(' · ')
  await admin.from('notifications').insert({
    owner_id: tech.owner_id,
    type: 'jobs_reassigned',
    title: 'Jobs reassigned',
    message: reassigned.length ? lines : 'No active jobs needed reassignment.',
    link: '/jobs',
    read: false,
  })

  return json(200, { ok: true, reassigned })
})

