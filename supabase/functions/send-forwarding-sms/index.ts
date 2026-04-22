import { corsHeaders } from '../_shared/cors.ts'
import { forwardingActivationSnippet, formatUsDisplay } from '../_shared/forwardingDialCode.ts'
import { getUserFromAuthHeader } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Body = { owner_id?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const { user, error: userErr } = await getUserFromAuthHeader(req)
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  const body = (await req.json().catch(() => ({}))) as Body | null
  if (body?.owner_id && body.owner_id !== user.id) return json(403, { error: 'Forbidden' })

  const admin = supabaseAdmin()
  const { data: prof, error: profErr } = await admin
    .from('profiles')
    .select('full_name, business_phone, margen_phone_number, carrier, twilio_forwarding_code')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !prof) return json(500, { error: profErr?.message ?? 'Profile not found' })

  const p = prof as {
    full_name: string | null
    business_phone: string | null
    margen_phone_number: string | null
    carrier: string | null
    twilio_forwarding_code: string | null
  }

  const to = (p.business_phone ?? '').trim()
  if (!to) {
    return json(409, {
      error: 'Add your business cell or main line in Settings first — we text that phone with your forwarding steps.',
    })
  }

  const margen = (p.margen_phone_number ?? '').trim()
  if (!margen) {
    return json(409, { error: 'Your Margen AI number is not ready yet. Finish AI phone setup first.' })
  }

  const carrier = (p.carrier ?? 'att').trim()
  const code = (p.twilio_forwarding_code ?? '').trim() || forwardingActivationSnippet(carrier, margen)
  const firstName = (p.full_name ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? 'there'
  const displayMargen = formatUsDisplay(margen)

  const msg =
    `Hi ${firstName}! Your Margen AI number is ${displayMargen}. ` +
    `To activate missed call forwarding dial ${code} from your business phone right now. Takes 10 seconds!`

  try {
    await twilioClient().messages.create({
      from: twilioFromNumber(),
      to,
      body: msg,
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return json(502, { error: `We could not send the text message. ${m}` })
  }

  return json(200, { ok: true })
})
