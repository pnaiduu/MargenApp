import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Body = {
  customer_id: string
  title: string
  description?: string
  job_type?: string
  scheduled_at?: string | null
  urgency?: 'routine' | 'urgent' | 'emergency'
  revenue_cents?: number
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mapUrgency(u?: Body['urgency']) {
  if (u === 'urgent') return 'urgent'
  if (u === 'emergency') return 'emergency'
  return 'normal' // routine
}

async function invokeAutoAssign(accessToken: string, jobId: string) {
  const url = Deno.env.get('SUPABASE_URL')
  if (!url) throw new Error('Missing SUPABASE_URL')
  const res = await fetch(`${url}/functions/v1/auto-assign-job`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId }),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, data }
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
  if (!body.customer_id) return json(400, { error: 'Missing customer_id' })
  if (!body.title?.trim()) return json(400, { error: 'Missing title' })

  const admin = supabaseAdmin()

  // Ensure customer belongs to owner (auth user is owner in this app)
  const { data: cust, error: custErr } = await admin
    .from('customers')
    .select('id, owner_id, address, lat, lng')
    .eq('id', body.customer_id)
    .maybeSingle()
  if (custErr || !cust) return json(404, { error: custErr?.message ?? 'Customer not found' })
  if (cust.owner_id !== user.id) return json(403, { error: 'Forbidden' })

  const urgency = mapUrgency(body.urgency)
  const nowIso = new Date().toISOString()

  const insert = {
    owner_id: user.id,
    customer_id: cust.id,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    job_type: body.job_type?.trim() || 'general',
    scheduled_at: body.scheduled_at ?? null,
    urgency,
    revenue_cents: body.revenue_cents ?? 0,
    status: urgency === 'emergency' ? 'pending' : 'pending',
    emergency_created_at: urgency === 'emergency' ? nowIso : null,
  }

  const { data: job, error: jobErr } = await admin.from('jobs').insert(insert).select('*').single()
  if (jobErr || !job) return json(500, { error: jobErr?.message ?? 'Failed to create job' })

  // Auto-assign after creation (emergency skips skill filter inside auto-assign-job).
  const token = userRes.session?.access_token
  let assignment_note: string | null = null
  if (token) {
    const res = await invokeAutoAssign(token, job.id)
    assignment_note = (res.data as { note?: string } | null)?.note ?? null
  }

  return json(200, { job, assignment_note })
})

