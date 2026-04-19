import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type BlandPayload = {
  call_id?: string
  phone_number?: string
  from?: string
  transcript?: string
  recording_url?: string
  data?: Record<string, unknown>
}

function mapUrgency(u: unknown): 'normal' | 'urgent' | 'emergency' {
  const s = String(u ?? '').toLowerCase()
  if (s.includes('emerg')) return 'emergency'
  if (s.includes('urgent')) return 'urgent'
  return 'normal'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const secret = Deno.env.get('BLAND_WEBHOOK_SECRET')
  if (secret) {
    const got = req.headers.get('x-bland-secret')
    if (got !== secret) return json(401, { error: 'Unauthorized' })
  }

  const payload = (await req.json().catch(() => ({}))) as BlandPayload
  const admin = supabaseAdmin()

  const ownerId = Deno.env.get('OWNER_ID') ?? Deno.env.get('DEFAULT_OWNER_ID')
  if (!ownerId) return json(500, { error: 'Missing OWNER_ID/DEFAULT_OWNER_ID for webhook routing' })

  const callId = payload.call_id ?? null
  const caller = payload.from ?? payload.phone_number ?? null
  const transcript = payload.transcript ?? null
  const recordingUrl = payload.recording_url ?? null
  const collected = (payload.data ?? {}) as Record<string, unknown>

  // Find the most recent in-progress call from this caller, else create a new record.
  const { data: existing } = await admin
    .from('phone_calls')
    .select('id, status')
    .eq('owner_id', ownerId)
    .eq('caller_phone', caller)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const upsertBase = {
    owner_id: ownerId,
    caller_phone: caller,
    status: 'missed',
    ai_handled: true,
    bland_call_id: callId,
    transcript,
    recording_url: recordingUrl,
    collected,
  } as const

  const phoneCallId = existing?.id ?? null
  if (phoneCallId) {
    await admin.from('phone_calls').update(upsertBase).eq('id', phoneCallId).eq('owner_id', ownerId)
  } else {
    const { data: inserted } = await admin.from('phone_calls').insert(upsertBase).select('id').single()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = inserted
  }

  const urgency = mapUrgency(collected.urgency)
  const service = typeof collected.service === 'string' ? collected.service.trim() : ''
  const address = typeof collected.address === 'string' ? collected.address.trim() : ''

  if (urgency !== 'normal') {
    await admin.from('notifications').insert({
      owner_id: ownerId,
      type: 'urgent_lead',
      title: urgency === 'emergency' ? 'Emergency lead' : 'Urgent lead',
      message: address ? `${service || 'New request'} · ${address}` : service || 'New urgent request',
      link: '/calls',
      read: false,
    })
  }

  // If we have enough to create a draft job, do it.
  if (service || address) {
    const jobTitle = service || 'AI reception lead'
    const jobDesc = [
      address ? `Address: ${address}` : null,
      urgency ? `Urgency: ${urgency}` : null,
      transcript ? `Transcript:\n${transcript}` : null,
    ]
      .filter(Boolean)
      .join('\n\n')

    const { data: job } = await admin
      .from('jobs')
      .insert({
        owner_id: ownerId,
        customer_id: null,
        title: jobTitle,
        description: jobDesc || null,
        job_type: typeof collected.job_type === 'string' ? collected.job_type : 'general',
        urgency,
        status: 'pending',
        needs_approval: true,
        source: 'ai_receptionist',
        source_phone_call_id: phoneCallId,
      })
      .select('id')
      .single()

    if (job?.id) {
      await admin.from('notifications').insert({
        owner_id: ownerId,
        type: 'draft_job_created',
        title: 'Draft job created',
        message: `${jobTitle} — waiting for approval`,
        link: '/jobs',
        read: false,
      })
    }
  }

  return json(200, { ok: true })
})

