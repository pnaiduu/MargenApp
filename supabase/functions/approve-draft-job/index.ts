import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

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

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.job_id) return json(400, { error: 'Missing job_id' })

  const admin = supabaseAdmin()

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, owner_id, needs_approval')
    .eq('id', body.job_id)
    .maybeSingle()
  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })
  if (job.owner_id !== user.id) return json(403, { error: 'Forbidden' })

  await admin.from('jobs').update({ needs_approval: false }).eq('id', job.id).eq('owner_id', user.id)

  const token = userRes.session?.access_token
  if (token) {
    const url = Deno.env.get('SUPABASE_URL')
    if (url) {
      await fetch(`${url}/functions/v1/auto-assign-job`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id }),
      }).catch(() => null)
    }
  }

  return json(200, { ok: true })
})

