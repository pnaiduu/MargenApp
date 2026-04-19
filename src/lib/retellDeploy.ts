import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { buildMargenReceptionistPrompt, type RetellFlowStep } from './retellPrompt'

type Supabase = SupabaseClient<Database>

function retellKey(): string | null {
  const k = import.meta.env.VITE_RETELL_API_KEY
  return typeof k === 'string' && k.trim() ? k.trim() : null
}

async function retellFetch<T>(path: string, init: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; data: unknown }> {
  const key = retellKey()
  if (!key) return { ok: false, status: 500, data: { error: 'Missing VITE_RETELL_API_KEY' } }

  const res = await fetch(`https://api.retellai.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  let data: unknown = null
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) return { ok: false, status: res.status, data }
  return { ok: true, data: data as T }
}

export async function retellListVoices(): Promise<{ voices: RetellVoiceRow[]; error: Error | null }> {
  const key = retellKey()
  if (!key) return { voices: [], error: new Error('Missing VITE_RETELL_API_KEY') }

  const res = await fetch('https://api.retellai.com/list-voices', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return { voices: [], error: new Error(typeof data === 'object' && data && 'message' in data ? String((data as { message?: string }).message) : 'list-voices failed') }
  }

  const raw = data as { voices?: unknown[] } | unknown[]
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { voices?: unknown[] }).voices) ? (raw as { voices: unknown[] }).voices : []

  const voices: RetellVoiceRow[] = list
    .map((v) => {
      const o = v as Record<string, unknown>
      const voiceId = (o.voice_id ?? o.voiceId) as string | undefined
      if (!voiceId) return null
      const voice_name = String(o.voice_name ?? o.voiceName ?? voiceId)
      const provider = String(o.provider ?? '—')
      const gender = String(o.gender ?? '—')
      const accentRaw =
        typeof o.accent === 'string'
          ? o.accent
          : typeof o.accent_language === 'string'
            ? o.accent_language
            : typeof o.language === 'string'
              ? o.language
              : ''
      const accent = normalizeVoiceAccent(accentRaw, voiceId, voice_name, provider)
      return {
        voice_id: voiceId,
        voice_name,
        provider,
        gender,
        accent,
        age: o.age != null ? String(o.age) : undefined,
        preview_audio_url:
          typeof o.preview_audio_url === 'string'
            ? o.preview_audio_url
            : typeof o.preview_audio === 'string'
              ? o.preview_audio
              : undefined,
      } satisfies RetellVoiceRow
    })
    .filter(Boolean) as RetellVoiceRow[]

  return { voices, error: null }
}

function normalizeVoiceAccent(raw: string, voiceId: string, voiceName: string, provider: string): string {
  const t = raw.trim()
  if (t) return t
  const blob = `${voiceId} ${voiceName} ${provider}`.toLowerCase()
  if (/\b(uk|british|england|gb)\b/.test(blob) || blob.includes('en-gb')) return 'British'
  if (/\b(aus|australian|sydney)\b/.test(blob) || blob.includes('en-au')) return 'Australian'
  if (/\b(us|american|rachel|josh)\b/.test(blob) || blob.includes('en-us')) return 'American'
  return 'General'
}

export type RetellVoiceRow = {
  voice_id: string
  voice_name: string
  provider: string
  gender: string
  accent: string
  age?: string
  preview_audio_url?: string
}

let retellVoicesListCache: RetellVoiceRow[] | null = null

/** In-memory list for the session; cleared on full page reload. */
export function getRetellVoicesCache(): RetellVoiceRow[] | null {
  return retellVoicesListCache
}

export function clearRetellVoicesCache() {
  retellVoicesListCache = null
}

/** Fetches from Retell once per session, then returns cached list. */
export async function retellListVoicesCached(): Promise<{ voices: RetellVoiceRow[]; error: Error | null }> {
  if (retellVoicesListCache) return { voices: retellVoicesListCache, error: null }
  const r = await retellListVoices()
  if (!r.error) retellVoicesListCache = r.voices
  return r
}

export type AiReceptionistDeployPayload = {
  company_name: string | null
  greeting_message: string | null
  sign_off_message: string | null
  flow_steps: RetellFlowStep[]
  voice_id: string | null
  business_hours: unknown
  after_hours_message: string | null
  escalation_rules: unknown
}

/**
 * Saves settings, creates/updates Retell LLM + agent (shared Margen API key), stores agent id on profile + settings.
 * Inbound routing to companies uses per-owner agents; n8n should use `call.agent_id` → Supabase or `call.metadata.owner_id` when present.
 */
export async function deployAiReceptionistRetell(
  supabase: Supabase,
  ownerId: string,
  payload: AiReceptionistDeployPayload,
): Promise<{ error: Error | null; warnings: string[] }> {
  const warnings: string[] = []
  if (!retellKey()) {
    return { error: new Error('Missing VITE_RETELL_API_KEY. Add it to your .env and restart the dev server.'), warnings }
  }

  const { data: existing, error: exErr } = await supabase
    .from('ai_receptionist_settings')
    .select('retell_llm_id, retell_agent_id')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (exErr) return { error: new Error(exErr.message), warnings }

  const { error: upErr } = await supabase.from('ai_receptionist_settings').upsert(
    {
      owner_id: ownerId,
      company_name: payload.company_name,
      greeting_message: payload.greeting_message,
      sign_off_message: payload.sign_off_message,
      flow_steps: payload.flow_steps ?? [],
      voice_id: payload.voice_id,
      business_hours: payload.business_hours ?? {},
      after_hours_message: payload.after_hours_message,
      escalation_rules: payload.escalation_rules ?? {},
      retell_llm_id: existing?.retell_llm_id ?? null,
      retell_agent_id: existing?.retell_agent_id ?? null,
    },
    { onConflict: 'owner_id' },
  )
  if (upErr) return { error: new Error(upErr.message), warnings }

  const companyName = (payload.company_name ?? '').trim() || 'Your company'
  const greeting = (payload.greeting_message ?? '').trim()
  const afterHours = (payload.after_hours_message ?? '').trim()

  const signOff = (payload.sign_off_message ?? '').trim()
  let prompt = buildMargenReceptionistPrompt({
    companyName: companyName,
    greetingMessage: greeting,
    flowSteps: payload.flow_steps ?? [],
    escalationRules: payload.escalation_rules,
    businessHours: payload.business_hours,
    afterHoursMessage: afterHours,
  })
  if (signOff) {
    prompt += ` Always end the call with this farewell: ${signOff}`
  }

  const voiceId = payload.voice_id?.trim()
  if (!voiceId) return { error: new Error('Select a voice before deploying.'), warnings }

  let llmId = existing?.retell_llm_id ?? null
  if (!llmId) {
    const created = await retellFetch<{ llm_id?: string }>('/create-retell-llm', {
      method: 'POST',
      body: JSON.stringify({ general_prompt: prompt }),
    })
    if (!created.ok) {
      return { error: new Error(`Retell create LLM failed (${created.status}): ${JSON.stringify(created.data)}`), warnings }
    }
    llmId = created.data.llm_id ?? null
    if (!llmId) return { error: new Error('Retell did not return llm_id'), warnings }
  } else {
    const updated = await retellFetch(`/update-retell-llm/${encodeURIComponent(llmId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ general_prompt: prompt }),
    })
    if (!updated.ok) {
      return { error: new Error(`Retell update LLM failed (${updated.status}): ${JSON.stringify(updated.data)}`), warnings }
    }
  }

  let agentId = existing?.retell_agent_id ?? null
  if (!agentId) {
    const created = await retellFetch<{ agent_id?: string }>('/create-agent', {
      method: 'POST',
      body: JSON.stringify({
        agent_name: `${companyName} — Margen`,
        voice_id: voiceId,
        response_engine: { type: 'retell-llm', llm_id: llmId },
      }),
    })
    if (!created.ok) {
      return { error: new Error(`Retell create agent failed (${created.status}): ${JSON.stringify(created.data)}`), warnings }
    }
    agentId = created.data.agent_id ?? null
    if (!agentId) return { error: new Error('Retell did not return agent_id'), warnings }
  } else {
    const updated = await retellFetch(`/update-agent/${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        agent_name: `${companyName} — Margen`,
        voice_id: voiceId,
        response_engine: { type: 'retell-llm', llm_id: llmId },
      }),
    })
    if (!updated.ok) {
      return { error: new Error(`Retell update agent failed (${updated.status}): ${JSON.stringify(updated.data)}`), warnings }
    }
  }

  const { error: setErr } = await supabase
    .from('ai_receptionist_settings')
    .update({ retell_llm_id: llmId, retell_agent_id: agentId })
    .eq('owner_id', ownerId)
  if (setErr) return { error: new Error(setErr.message), warnings }

  const { error: profErr } = await supabase.from('profiles').update({ retell_agent_id: agentId }).eq('id', ownerId)
  if (profErr) return { error: new Error(profErr.message), warnings }

  const { data: prof } = await supabase.from('profiles').select('business_phone').eq('id', ownerId).maybeSingle()
  const esc = (payload.escalation_rules ?? {}) as { human_transfer?: boolean }
  if (esc.human_transfer !== false && !(prof?.business_phone ?? '').trim()) {
    warnings.push('Business phone is not set in Settings; human transfer may not work until you add it.')
  }

  return { error: null, warnings }
}
