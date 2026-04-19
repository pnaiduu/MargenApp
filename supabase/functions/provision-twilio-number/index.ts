import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { twilioClient } from '../_shared/twilio.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Body = { owner_id?: string; area_code?: string | number; replace_existing?: boolean }

function formatNorthAmerican(e164: string) {
  const d = e164.replace(/\D/g, '')
  const tail = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.slice(-10)
  if (tail.length !== 10) return e164.trim()
  return `+1 (${tail.slice(0, 3)}) ${tail.slice(3, 6)}-${tail.slice(6)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  const ownerId = user.id
  const body = (await req.json().catch(() => null)) as Body | null
  if (body?.owner_id && body.owner_id !== ownerId) return json(403, { error: 'Forbidden' })

  const voiceUrl = (
    Deno.env.get('RETELL_TWILIO_INBOUND_WEBHOOK_URL') ??
    Deno.env.get('RETELL_INBOUND_VOICE_URL') ??
    ''
  ).trim()
  if (!voiceUrl) {
    return json(500, {
      error:
        'Voice webhook URL is not configured. Set RETELL_TWILIO_INBOUND_WEBHOOK_URL (Retell Twilio inbound URL) as a function secret.',
    })
  }

  const admin = supabaseAdmin()
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('margen_phone_number, margen_phone_sid, company_name')
    .eq('id', ownerId)
    .maybeSingle()

  if (profErr) return json(500, { error: profErr.message })

  const replace = Boolean(body?.replace_existing)
  const existingSid = (prof as { margen_phone_sid?: string | null } | null)?.margen_phone_sid?.trim() ?? ''
  const existingNum = (prof as { margen_phone_number?: string | null } | null)?.margen_phone_number?.trim() ?? ''

  if (existingNum && existingSid && !replace) {
    return json(200, {
      ok: true,
      phone_number: existingNum,
      formatted: formatNorthAmerican(existingNum),
      already_provisioned: true,
    })
  }

  let ac = parseInt(String(body?.area_code ?? '213').replace(/\D/g, '').slice(0, 3), 10)
  if (!Number.isFinite(ac) || ac < 200 || ac > 999) ac = 213

  const tw = twilioClient()

  if (replace && existingSid) {
    try {
      await tw.incomingPhoneNumbers(existingSid).remove()
    } catch (e) {
      console.warn('[provision-twilio-number] release previous SID failed:', e)
    }
    await admin
      .from('profiles')
      .update({ margen_phone_number: null, margen_phone_sid: null })
      .eq('id', ownerId)
  }

  let candidates = await tw.availablePhoneNumbers('US').local.list({ areaCode: ac, limit: 10 })
  if (!candidates.length) {
    candidates = await tw.availablePhoneNumbers('US').local.list({ limit: 10 })
  }
  if (!candidates.length) {
    return json(404, {
      error:
        'We could not find an available phone line in that area right now. Try again in a few minutes, or use a different area code.',
    })
  }

  const company = ((prof as { company_name?: string | null } | null)?.company_name ?? 'Business').trim() || 'Business'
  const friendly = `Margen ${company.slice(0, 40)}`

  let purchased: { sid: string; phoneNumber: string } | null = null
  for (const cand of candidates) {
    try {
      const row = await tw.incomingPhoneNumbers.create({
        phoneNumber: cand.phoneNumber,
        voiceUrl,
        voiceMethod: 'POST',
        friendlyName: friendly,
      })
      purchased = { sid: row.sid, phoneNumber: row.phoneNumber }
      break
    } catch (e) {
      console.warn('[provision-twilio-number] purchase failed for', cand.phoneNumber, e)
    }
  }

  if (!purchased) {
    return json(502, {
      error:
        'Twilio could not complete the purchase. Check your Twilio account balance and try again, or pick another area code.',
    })
  }

  const { error: upErr } = await admin
    .from('profiles')
    .update({
      margen_phone_number: purchased.phoneNumber,
      margen_phone_sid: purchased.sid,
    })
    .eq('id', ownerId)

  if (upErr) {
    try {
      await tw.incomingPhoneNumbers(purchased.sid).remove()
    } catch {
      // best effort rollback
    }
    return json(500, { error: upErr.message })
  }

  return json(200, {
    ok: true,
    phone_number: purchased.phoneNumber,
    formatted: formatNorthAmerican(purchased.phoneNumber),
  })
})
