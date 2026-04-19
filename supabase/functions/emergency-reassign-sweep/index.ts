import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

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

async function sendExpoPush(tokens: string[], payload: { title: string; body: string; data?: Record<string, unknown>; channelId?: string }) {
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
        sound: 'default',
        channelId: payload.channelId,
        priority: 'high',
      })),
    ),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // Protect via a shared secret (set as function secret).
  const secret = Deno.env.get('EMERGENCY_SWEEP_SECRET') ?? ''
  const provided = req.headers.get('x-sweep-secret') ?? ''
  if (!secret || provided !== secret) return json(401, { error: 'Unauthorized' })

  const admin = supabaseAdmin()
  const nowIso = new Date().toISOString()

  const { data: overdue, error } = await admin
    .from('jobs')
    .select('id, owner_id, technician_id, emergency_ack_deadline_at, emergency_tried_technician_ids, customers(address, lat, lng)')
    .eq('urgency', 'emergency')
    .is('emergency_ack_at', null)
    .not('emergency_ack_deadline_at', 'is', null)
    .lte('emergency_ack_deadline_at', nowIso)
    .neq('status', 'cancelled')
    .limit(25)

  if (error) return json(500, { error: error.message })

  const reassigned: { job_id: string; from_technician_id: string | null; to_technician_id: string | null }[] = []

  for (const j of overdue ?? []) {
    const tried = (j.emergency_tried_technician_ids ?? []) as unknown as string[]

    const { data: candidates } = await admin
      .from('technicians')
      .select('id, user_id, name, last_lat, last_lng')
      .eq('owner_id', j.owner_id)
      .eq('status', 'available')

    const cust = j.customers as unknown as { address: string | null; lat: number | null; lng: number | null } | null
    const cLat = cust?.lat ?? null
    const cLng = cust?.lng ?? null

    let best: { id: string; user_id: string | null; score: number } | null = null
    for (const t of (candidates ?? []) as { id: string; user_id: string | null; last_lat: number | null; last_lng: number | null }[]) {
      if (tried.includes(t.id)) continue
      let score = 0
      if (cLat != null && cLng != null && t.last_lat != null && t.last_lng != null) {
        score -= haversineMeters(cLat, cLng, t.last_lat, t.last_lng)
      }
      if (!best || score > best.score) best = { id: t.id, user_id: t.user_id, score }
    }

    const fromTech = (j.technician_id as string | null) ?? null
    const toTech = best?.id ?? null

    if (!toTech) {
      reassigned.push({ job_id: j.id, from_technician_id: fromTech, to_technician_id: null })
      continue
    }

    const newDeadline = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await admin
      .from('jobs')
      .update({
        technician_id: toTech,
        emergency_assigned_at: nowIso,
        emergency_ack_deadline_at: newDeadline,
        emergency_assignment_attempt: (tried.length ?? 0) + 1,
        emergency_tried_technician_ids: [...tried, toTech],
      })
      .eq('id', j.id)

    await admin.from('technicians').update({ status: 'busy' }).eq('id', toTech).eq('owner_id', j.owner_id)

    if (best?.user_id) {
      const { data: toks } = await admin
        .from('expo_push_tokens')
        .select('token')
        .eq('user_id', best.user_id)
        .order('updated_at', { ascending: false })
        .limit(3)
      const tokens = (toks ?? []).map((r) => (r as { token: string }).token).filter(Boolean)
      const addr = cust?.address?.trim() || 'customer location'
      await sendExpoPush(tokens, {
        title: 'EMERGENCY JOB',
        body: `EMERGENCY JOB: ${addr} — respond immediately`,
        data: { job_id: j.id, kind: 'emergency' },
        channelId: 'emergency',
      })
    }

    await admin.from('notifications').insert({
      owner_id: j.owner_id,
      type: 'emergency_reassigned',
      title: 'Emergency auto-reassigned',
      message: 'No acknowledgment in 5 minutes. Reassigned to the next closest technician.',
      link: '/jobs',
      read: false,
    })

    reassigned.push({ job_id: j.id, from_technician_id: fromTech, to_technician_id: toTech })
  }

  return json(200, { ok: true, reassigned_count: reassigned.length, reassigned })
})

