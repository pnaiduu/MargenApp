import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

type Body = { phone_call_id: string }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function escXml(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.phone_call_id) return json(400, { error: 'Missing phone_call_id' })

  const admin = supabaseAdmin()
  const { data: call } = await admin
    .from('phone_calls')
    .select('id, owner_id, caller_phone')
    .eq('id', body.phone_call_id)
    .maybeSingle()

  if (!call) return json(404, { error: 'Call not found' })
  if ((call as { owner_id: string }).owner_id !== user.id) return json(403, { error: 'Forbidden' })

  const { data: prof } = await admin.from('profiles').select('business_phone').eq('id', user.id).maybeSingle()
  const ownerPhone = (prof as { business_phone: string | null } | null)?.business_phone?.trim() || null
  const callerPhone = (call as { caller_phone: string | null }).caller_phone?.trim() || null

  if (!ownerPhone || !callerPhone) return json(409, { error: 'Missing owner business phone or caller phone' })

  const tw = twilioClient()
  const from = twilioFromNumber()

  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
    `<Dial callerId="${escXml(from)}">${escXml(callerPhone)}</Dial>` +
    `</Response>`

  await tw.calls.create({
    to: ownerPhone,
    from,
    twiml,
  })

  await admin.from('phone_calls').update({ status: 'called_back' }).eq('id', call.id).eq('owner_id', user.id)

  return json(200, { ok: true })
})

