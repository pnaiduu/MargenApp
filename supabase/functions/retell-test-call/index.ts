import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

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

  const admin = supabaseAdmin()
  const { data: prof } = await admin
    .from('profiles')
    .select('business_phone, margen_phone_number, retell_agent_id')
    .eq('id', user.id)
    .maybeSingle()

  const toNumber = (prof as { business_phone: string | null } | null)?.business_phone?.trim() || null
  if (!toNumber) return json(409, { error: 'Set your Business phone number in Settings first.' })

  const { data: s } = await admin
    .from('ai_receptionist_settings')
    .select('retell_phone_number, retell_agent_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const margenFrom = (prof as { margen_phone_number: string | null } | null)?.margen_phone_number?.trim() || null
  const settingsFrom = (s as { retell_phone_number: string | null } | null)?.retell_phone_number?.trim() || null
  const fromNumber = margenFrom || settingsFrom
  const agentId =
    (prof as { retell_agent_id: string | null } | null)?.retell_agent_id ??
    (s as { retell_agent_id: string | null } | null)?.retell_agent_id ??
    null

  if (!fromNumber) {
    return json(409, {
      error:
        'Provision your Margen AI line (Settings → AI call setup) or set your Retell agent phone in AI Receptionist settings before testing.',
    })
  }
  if (!agentId) return json(409, { error: 'Deploy your AI Receptionist first.' })

  const key = Deno.env.get('RETELL_API_KEY')
  if (!key) return json(500, { error: 'Missing RETELL_API_KEY' })

  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from_number: fromNumber,
      to_number: toNumber,
      override_agent_id: agentId,
      metadata: { owner_id: user.id },
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return json(res.status, { error: 'Retell create-phone-call failed', details: data })

  return json(201, { ok: true, call: data })
})

