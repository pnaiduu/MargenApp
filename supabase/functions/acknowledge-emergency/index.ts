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

  // Verify caller is assigned technician user
  const { data: tech, error: techErr } = await admin.from('technicians').select('id, owner_id').eq('user_id', user.id).maybeSingle()
  if (techErr || !tech) return json(403, { error: 'Not a technician user' })

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, owner_id, technician_id, urgency, emergency_ack_at, emergency_ack_deadline_at')
    .eq('id', body.job_id)
    .maybeSingle()
  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })

  if (job.owner_id !== tech.owner_id) return json(403, { error: 'Forbidden' })
  if (job.urgency !== 'emergency') return json(409, { error: 'Not an emergency job' })
  if (job.technician_id !== tech.id) return json(409, { error: 'Job is not assigned to you' })
  if (job.emergency_ack_at) return json(200, { ok: true })

  const nowIso = new Date().toISOString()
  const { error: upErr } = await admin
    .from('jobs')
    .update({ emergency_ack_at: nowIso, emergency_ack_by: user.id })
    .eq('id', job.id)
    .is('emergency_ack_at', null)
  if (upErr) return json(500, { error: upErr.message })

  await admin.from('notifications').insert({
    owner_id: tech.owner_id,
    type: 'emergency_acknowledged',
    title: 'Emergency acknowledged',
    message: 'A technician acknowledged the emergency job.',
    link: '/jobs',
    read: false,
  })

  return json(200, { ok: true })
})

