import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

function xml(body: string) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function esc(s: string) {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}

function getDowKey(d: Date) {
  // JS: 0=Sun..6=Sat
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  return map[d.getDay()] ?? 'mon'
}

function parseTimeToMinutes(t: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function isWithinBusinessHours(businessHours: unknown, nowLocal: Date) {
  const cfg = (businessHours ?? {}) as {
    enabled?: boolean
    days?: Record<string, { open?: string; close?: string }>
  }
  if (!cfg.enabled) return true
  const key = getDowKey(nowLocal)
  const day = cfg.days?.[key]
  const openMin = day?.open ? parseTimeToMinutes(day.open) : null
  const closeMin = day?.close ? parseTimeToMinutes(day.close) : null
  if (openMin == null || closeMin == null) return true
  const curMin = nowLocal.getHours() * 60 + nowLocal.getMinutes()
  return curMin >= openMin && curMin <= closeMin
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const form = await req.formData()
  const callSid = String(form.get('CallSid') ?? '')
  const from = String(form.get('From') ?? '')
  const to = String(form.get('To') ?? '')

  const admin = supabaseAdmin()
  const toDigits = digitsOnly(to)

  let resolvedOwnerId: string | null = null
  if (toDigits.length >= 10) {
    const { data: byMargen } = await admin.from('profiles').select('id').eq('margen_phone_digits', toDigits).maybeSingle()
    resolvedOwnerId = (byMargen as { id?: string } | null)?.id ?? null
  }

  const defaultOwnerId = Deno.env.get('DEFAULT_OWNER_ID')
  if (!resolvedOwnerId) {
    resolvedOwnerId = Deno.env.get('OWNER_ID') ?? defaultOwnerId ?? null
  }

  if (!resolvedOwnerId) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to accept calls right now.</Say><Hangup/></Response>`)
  }

  const { data: prof } = await admin
    .from('profiles')
    .select('company_name, business_phone, rings_before_ai, business_hours, after_hours_message')
    .eq('id', resolvedOwnerId)
    .maybeSingle()

  const companyName = (prof as { company_name: string | null } | null)?.company_name?.trim() || 'our company'
  const businessPhone = (prof as { business_phone: string | null } | null)?.business_phone?.trim() || null
  const rawRings = (prof as { rings_before_ai: number } | null)?.rings_before_ai ?? 3
  const ringsBeforeAi = Math.min(5, Math.max(1, Math.round(Number.isFinite(rawRings) ? rawRings : 3)))
  const afterHoursMessage = (prof as { after_hours_message: string | null } | null)?.after_hours_message?.trim() || null
  const businessHours = (prof as { business_hours: unknown } | null)?.business_hours ?? {}

  // Log the incoming call right away (status in_progress)
  await admin.from('phone_calls').upsert(
    {
      owner_id: resolvedOwnerId,
      caller_phone: from || null,
      status: 'in_progress',
      twilio_call_sid: callSid || null,
      twilio_from: from || null,
      twilio_to: to || null,
      occurred_at: new Date().toISOString(),
    },
    { onConflict: 'owner_id,twilio_call_sid' },
  )

  const blandNumber = Deno.env.get('BLAND_RECEPTIONIST_NUMBER')
  if (!blandNumber) {
    return xml(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thanks for calling ${esc(companyName)}. Please call back later.</Say><Hangup/></Response>`)
  }

  const openNow = isWithinBusinessHours(businessHours, new Date())
  if (!openNow) {
    const msg = afterHoursMessage || `Thanks for calling ${companyName}. We're currently closed.`
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Response>` +
        `<Say>${esc(msg)}</Say>` +
        `<Say>I'll connect you to our assistant.</Say>` +
        `<Dial>${esc(blandNumber)}</Dial>` +
        `</Response>`,
    )
  }

  // Dial owner business phone first (N rings), then redirect to Bland if unanswered.
  if (!businessPhone) {
    return xml(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Response>` +
        `<Say>Thanks for calling ${esc(companyName)}. I'll connect you to our assistant.</Say>` +
        `<Dial>${esc(blandNumber)}</Dial>` +
        `</Response>`,
    )
  }

  const timeoutSeconds = Math.max(6, Math.min(60, Math.round(ringsBeforeAi * 6)))
  const baseUrl = Deno.env.get('PUBLIC_FUNCTIONS_BASE_URL') // e.g. https://xxxx.supabase.co/functions/v1
  const actionUrl = baseUrl ? `${baseUrl}/twilio-inbound-dial-result` : null
  const statusCb = baseUrl ? `${baseUrl}/twilio-call-status` : null

  const dialAttrs = [
    `timeout="${timeoutSeconds}"`,
    actionUrl ? `action="${esc(actionUrl)}"` : '',
    statusCb ? `statusCallback="${esc(statusCb)}"` : '',
    statusCb ? `statusCallbackEvent="answered completed"` : '',
    `method="POST"`,
  ]
    .filter(Boolean)
    .join(' ')

  return xml(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response>` +
      `<Dial ${dialAttrs}>${esc(businessPhone)}</Dial>` +
      // If actionUrl isn't set, we fallback to assistant after the dial completes.
      (actionUrl
        ? ``
        : `<Say>I'll connect you to our assistant.</Say><Dial>${esc(blandNumber)}</Dial>`) +
      `</Response>`,
  )
})

