import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { buildMargenReceptionistPrompt, type RetellFlowStep } from '../_shared/retellPromptTemplate.ts'

type StepType = 'open_text' | 'yes_no' | 'address' | 'phone' | 'urgency'
type FlowStep = { id: string; question: string; response_type: StepType }

type Body = {
  company_name: string | null
  greeting_message: string | null
  sign_off_message: string | null
  flow_steps: FlowStep[]
  voice_id: string | null
  business_hours: unknown
  after_hours_message: string | null
  escalation_rules: unknown
}

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
  if (!body) return json(400, { error: 'Invalid JSON' })

  const admin = supabaseAdmin()

  const { data: prior } = await admin
    .from('ai_receptionist_settings')
    .select('retell_llm_id, retell_agent_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const { data: saved, error: saveErr } = await admin
    .from('ai_receptionist_settings')
    .upsert(
      {
        owner_id: user.id,
        company_name: body.company_name,
        greeting_message: body.greeting_message,
        sign_off_message: body.sign_off_message,
        flow_steps: body.flow_steps ?? [],
        voice_id: body.voice_id,
        business_hours: body.business_hours ?? {},
        after_hours_message: body.after_hours_message,
        escalation_rules: body.escalation_rules ?? {},
        retell_llm_id: prior?.retell_llm_id ?? null,
        retell_agent_id: prior?.retell_agent_id ?? null,
      },
      { onConflict: 'owner_id' },
    )
    .select('*')
    .single()

  if (saveErr || !saved) return json(500, { error: saveErr?.message ?? 'Failed to save settings' })

  const key = Deno.env.get('RETELL_API_KEY')
  if (!key) return json(500, { error: 'Missing RETELL_API_KEY' })

  const { data: prof } = await admin.from('profiles').select('business_phone').eq('id', user.id).maybeSingle()
  const ownerPhone = (prof as { business_phone: string | null } | null)?.business_phone?.trim() || null

  const companyName = (saved as { company_name: string | null }).company_name?.trim() || 'your company'
  const greeting = (saved as { greeting_message: string | null }).greeting_message?.trim() || ''
  const afterHours = (saved as { after_hours_message: string | null }).after_hours_message?.trim() || ''
  const signOff = (saved as { sign_off_message: string | null }).sign_off_message?.trim() || ''

  let prompt = buildMargenReceptionistPrompt({
    companyName: companyName,
    greetingMessage: greeting,
    flowSteps: ((saved as { flow_steps: unknown }).flow_steps ?? []) as RetellFlowStep[],
    escalationRules: (saved as { escalation_rules: unknown }).escalation_rules,
    businessHours: (saved as { business_hours: unknown }).business_hours,
    afterHoursMessage: afterHours,
  })

  if (signOff) {
    prompt += ` Always end the call with this farewell: ${signOff}`
  }

  let llmId = (saved as { retell_llm_id: string | null }).retell_llm_id ?? null
  if (!llmId) {
    const llmRes = await fetch('https://api.retellai.com/create-retell-llm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        general_prompt: prompt,
      }),
    })
    const llmData = await llmRes.json().catch(() => null)
    if (!llmRes.ok) return json(llmRes.status, { error: 'Retell create-retell-llm failed', details: llmData })
    llmId = (llmData as { llm_id?: string } | null)?.llm_id ?? null
    if (!llmId) return json(500, { error: 'Retell did not return llm_id' })
  } else {
    const llmRes = await fetch(`https://api.retellai.com/update-retell-llm/${encodeURIComponent(llmId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        general_prompt: prompt,
      }),
    })
    const llmData = await llmRes.json().catch(() => null)
    if (!llmRes.ok) return json(llmRes.status, { error: 'Retell update-retell-llm failed', details: llmData })
  }

  const voiceId = (saved as { voice_id: string | null }).voice_id ?? null
  if (!voiceId) return json(409, { error: 'Select a voice before deploying.' })

  let agentId = (saved as { retell_agent_id: string | null }).retell_agent_id ?? null
  if (!agentId) {
    const aRes = await fetch('https://api.retellai.com/create-agent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: `${companyName} — Margen`,
        voice_id: voiceId,
        response_engine: { type: 'retell-llm', llm_id: llmId },
      }),
    })
    const aData = await aRes.json().catch(() => null)
    if (!aRes.ok) return json(aRes.status, { error: 'Retell create-agent failed', details: aData })
    agentId = (aData as { agent_id?: string } | null)?.agent_id ?? null
    if (!agentId) return json(500, { error: 'Retell did not return agent_id' })
  } else {
    const aRes = await fetch(`https://api.retellai.com/update-agent/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_name: `${companyName} — Margen`,
        voice_id: voiceId,
        response_engine: { type: 'retell-llm', llm_id: llmId },
      }),
    })
    const aData = await aRes.json().catch(() => null)
    if (!aRes.ok) return json(aRes.status, { error: 'Retell update-agent failed', details: aData })
  }

  await admin
    .from('ai_receptionist_settings')
    .update({
      retell_llm_id: llmId,
      retell_agent_id: agentId,
    })
    .eq('owner_id', user.id)

  await admin.from('profiles').update({ retell_agent_id: agentId }).eq('id', user.id)

  const esc = ((saved as { escalation_rules: unknown }).escalation_rules ?? {}) as Record<string, unknown>
  const transferEnabled = Boolean(esc.human_transfer ?? true)

  return json(200, {
    ok: true,
    retell_agent_id: agentId,
    retell_llm_id: llmId,
    warnings: transferEnabled && !ownerPhone ? ['Owner business_phone is not set; transfer-to-human may not work.'] : [],
  })
})
