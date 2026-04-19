import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Body = { token: string; platform?: string }

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

  const token = body.token?.trim()
  if (!token) return json(400, { error: 'Missing token' })

  const admin = supabaseAdmin()
  // Resolve owner_id via technician mapping
  const { data: tech, error: techErr } = await admin
    .from('technicians')
    .select('owner_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (techErr || !tech?.owner_id) return json(409, { error: 'Not linked to a technician account' })

  const upsert = {
    owner_id: tech.owner_id,
    user_id: user.id,
    token,
    platform: body.platform ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = await admin.from('expo_push_tokens').upsert(upsert, { onConflict: 'user_id,token' })
  if (upErr) return json(500, { error: upErr.message })

  return json(200, { ok: true })
})

