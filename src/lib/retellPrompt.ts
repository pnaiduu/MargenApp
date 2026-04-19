export type RetellFlowStep = {
  id: string
  question: string
  response_type: string
}

export type RetellBusinessHours = {
  enabled?: boolean
  days?: Record<string, { open?: string; close?: string; enabled?: boolean }>
}

export type RetellEscalation = {
  emergency_sms?: boolean
  human_transfer?: boolean
  unsure_callback?: boolean
}

const DAY_LABEL: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

function formatBusinessHours(businessHours: RetellBusinessHours | unknown): string {
  const bh = (businessHours ?? {}) as RetellBusinessHours
  if (!bh.enabled) {
    return 'Hours not enforced in this profile; treat availability as flexible unless the caller states otherwise.'
  }
  const days = bh.days ?? {}
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const lines: string[] = []
  for (const key of order) {
    const d = days[key]
    if (!d) continue
    const label = DAY_LABEL[key] ?? key
    if (d.enabled === false) {
      lines.push(`${label}: closed`)
    } else {
      lines.push(`${label}: ${d.open ?? '?'}–${d.close ?? '?'}`)
    }
  }
  return lines.length ? lines.join('; ') : 'Not specified'
}

function formatEscalation(escalation: RetellEscalation | unknown): string {
  const e = (escalation ?? {}) as RetellEscalation
  const parts: string[] = []
  if (e.emergency_sms !== false) {
    parts.push(
      'If the caller indicates an emergency (burst pipe, gas smell, flooding, or similar), treat it as urgent and ensure the owner is notified immediately after the call.',
    )
  } else {
    parts.push('Emergency immediate-notification behavior is disabled.')
  }
  if (e.human_transfer !== false) {
    parts.push('If the caller asks for a human or is clearly frustrated, offer to transfer to a live person when available.')
  } else {
    parts.push('Human transfer is disabled; stay on the line and de-escalate politely.')
  }
  if (e.unsure_callback !== false) {
    parts.push('If you cannot understand after two attempts, offer a callback and collect the best callback number.')
  } else {
    parts.push('If unsure, politely ask the caller to repeat; avoid promising a callback unless necessary.')
  }
  return parts.join(' ')
}

function numberedFlowSteps(steps: RetellFlowStep[]): string {
  const filtered = (steps ?? []).filter((s) => (s.question ?? '').trim())
  if (!filtered.length) {
    return '1. Ask what service they need. 2. Ask urgency. 3. Ask address. 4. Ask for the best callback number.'
  }
  return filtered
    .map((s, idx) => {
      const q = (s.question ?? '').trim()
      const t = s.response_type
      const hint =
        t === 'yes_no'
          ? ' (yes/no)'
          : t === 'address'
            ? ' (full address)'
            : t === 'phone'
              ? ' (phone number, E.164 if possible)'
              : t === 'urgency'
                ? ' (routine vs urgent vs emergency)'
                : ' (open text)'
      return `${idx + 1}. ${q}${hint}`
    })
    .join(' ')
}

/**
 * Margen shared Retell account — single prompt shape for all companies.
 * n8n / webhooks: prefer `call.metadata.owner_id` when set; otherwise resolve `call.agent_id`
 * via `profiles.retell_agent_id` or `ai_receptionist_settings.retell_agent_id`.
 */
export function buildMargenReceptionistPrompt(input: {
  companyName: string
  greetingMessage: string
  flowSteps: RetellFlowStep[]
  escalationRules: RetellEscalation | unknown
  businessHours: RetellBusinessHours | unknown
  afterHoursMessage: string
}): string {
  const company = input.companyName.trim() || 'the business'
  const greeting =
    input.greetingMessage.trim() ||
    `Thank you for calling ${company}. This is the receptionist assistant. How may I help you today?`
  const flow = numberedFlowSteps(input.flowSteps)
  const escalation = formatEscalation(input.escalationRules)
  const bh = formatBusinessHours(input.businessHours)
  const after =
    input.afterHoursMessage.trim() ||
    'Thank you for calling. We are currently closed. Please leave a message or try again during business hours.'

  return (
    `You are a professional receptionist for ${company}. ${greeting} ` +
    `Follow this call flow: ${flow}. ${escalation} ` +
    `Business hours: ${bh}. After hours say: ${after}`
  )
}
