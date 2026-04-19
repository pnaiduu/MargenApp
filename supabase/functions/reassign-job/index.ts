import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Body = { job_id: string; technician_id: string | null; note?: string }

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

  const { data: job, error: jobErr } = await admin.from('jobs').select('id, owner_id').eq('id', body.job_id).maybeSingle()
  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })
  if (job.owner_id !== user.id) return json(403, { error: 'Forbidden' })

  if (body.technician_id) {
    const { data: tech, error: techErr } = await admin
      .from('technicians')
      .select('id, owner_id, name')
      .eq('id', body.technician_id)
      .maybeSingle()
    if (techErr || !tech) return json(404, { error: techErr?.message ?? 'Technician not found' })
    if (tech.owner_id !== user.id) return json(403, { error: 'Forbidden' })
  }

  const note = body.note?.trim() || 'Manual reassignment'
  await admin.from('jobs').update({ technician_id: body.technician_id, assignment_note: note }).eq('id', body.job_id)

  await admin.from('job_assignment_decisions').insert({
    owner_id: user.id,
    job_id: body.job_id,
    kind: 'manual',
    chosen_technician_id: body.technician_id,
    emergency: false,
    job_type: null,
    reason: note,
    candidate_count: 0,
    candidates: [],
  })

  await admin.from('notifications').insert({
    owner_id: user.id,
    type: 'job_reassigned',
    title: 'Job reassigned',
    message: note,
    link: '/jobs',
    read: false,
  })

  return json(200, { ok: true })
})

