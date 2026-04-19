import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

function xml(body: string) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function esc(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const form = await req.formData()
  const callSid = String(form.get('CallSid') ?? '')
  const dialStatus = String(form.get('DialCallStatus') ?? '') // completed | no-answer | busy | failed | canceled
  const from = String(form.get('From') ?? '')

  const resolvedOwnerId = Deno.env.get('OWNER_ID') ?? Deno.env.get('DEFAULT_OWNER_ID')
  const admin = supabaseAdmin()

  if (resolvedOwnerId && callSid) {
    if (dialStatus === 'completed') {
      await admin
        .from('phone_calls')
        .update({ status: 'answered' })
        .eq('owner_id', resolvedOwnerId)
        .eq('twilio_call_sid', callSid)
    } else if (dialStatus === 'no-answer' || dialStatus === 'busy' || dialStatus === 'failed' || dialStatus === 'canceled') {
      await admin
        .from('phone_calls')
        .update({ status: 'missed', caller_phone: from || null })
        .eq('owner_id', resolvedOwnerId)
        .eq('twilio_call_sid', callSid)
    }
  }

  const blandNumber = Deno.env.get('BLAND_RECEPTIONIST_NUMBER')
  if (!blandNumber) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`)
  }

  if (dialStatus === 'completed') {
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`)
  }

  const companyName = Deno.env.get('COMPANY_NAME_FALLBACK') ?? 'our company'
  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>` +
      `<Say>Thanks for calling ${esc(companyName)}, this is the Margen assistant — how can I help you today?</Say>` +
      `<Dial>${esc(blandNumber)}</Dial>` +
      `</Response>`,
  )
})

