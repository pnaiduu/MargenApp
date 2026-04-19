import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const form = await req.formData()
  const callSid = String(form.get('CallSid') ?? '')
  const callStatus = String(form.get('CallStatus') ?? '') // completed, in-progress, etc
  const from = String(form.get('From') ?? '')
  const duration = form.get('CallDuration')
  const durationSeconds = duration == null ? null : Number(duration)

  const resolvedOwnerId = Deno.env.get('OWNER_ID') ?? Deno.env.get('DEFAULT_OWNER_ID')
  if (!resolvedOwnerId || !callSid) return new Response('ok')

  const admin = supabaseAdmin()

  const patch: Record<string, unknown> = {
    twilio_call_sid: callSid,
    twilio_from: from || null,
  }

  if (callStatus === 'completed') {
    patch.ended_at = new Date().toISOString()
    if (Number.isFinite(durationSeconds)) patch.duration_seconds = Math.max(0, Math.round(durationSeconds as number))
  }

  await admin.from('phone_calls').update(patch).eq('owner_id', resolvedOwnerId).eq('twilio_call_sid', callSid)

  return new Response('ok')
})

