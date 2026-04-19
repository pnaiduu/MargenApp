export const CARRIER_OPTIONS = [
  { id: 'att' as const, label: 'AT&T' },
  { id: 'verizon' as const, label: 'Verizon' },
  { id: 'tmobile' as const, label: 'T-Mobile' },
  { id: 'google_voice' as const, label: 'Google Voice' },
  { id: 'ringcentral' as const, label: 'RingCentral' },
  { id: 'other' as const, label: 'Other' },
]

export type CarrierId = (typeof CARRIER_OPTIONS)[number]['id']

export function nationalTenDigits(e164: string): string | null {
  const d = e164.replace(/\D/g, '')
  if (d.length >= 10) {
    const tail = d.slice(-10)
    if (/^[2-9]\d{9}$/.test(tail)) return tail
  }
  return null
}

export function formatUsDisplay(e164: string): string {
  const n = nationalTenDigits(e164)
  if (!n) return e164.trim()
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
}

export function forwardingActivationSnippet(carrier: CarrierId | string, margenE164: string): string {
  const c = String(carrier).toLowerCase().trim() as CarrierId
  const n = nationalTenDigits(margenE164)
  const display = formatUsDisplay(margenE164)
  if (!n) return `Forward unanswered calls to ${display}.`

  switch (c) {
    case 'att':
      return `**72${n}`
    case 'verizon':
      return `*71${n}`
    case 'tmobile':
      return `*004${n}#`
    case 'google_voice':
      return `Google Voice → Settings → Calls → Forward calls to ${display}`
    case 'ringcentral':
      return `RingCentral → Settings → Phone → Call forwarding → ${display}`
    default:
      return `Phone settings → Call forwarding → When unanswered → ${display}`
  }
}

/** Step-by-step plain English for the instruction card. */
export function forwardingStepsHtml(carrier: CarrierId | string, margenE164: string): string[] {
  const display = formatUsDisplay(margenE164)
  const c = String(carrier).toLowerCase().trim() as CarrierId
  const code = forwardingActivationSnippet(c, margenE164)

  switch (c) {
    case 'att':
      return [
        `Open your phone’s dialer (the app you use to make calls).`,
        `Dial ${code} using the keypad — that turns on forwarding for missed calls to ${display}.`,
        `Wait until you hear a tone or confirmation, then hang up.`,
      ]
    case 'verizon':
      return [
        `Open the Phone app on the device you use for your business line.`,
        `Dial ${code} and press call.`,
        `Listen for a short confirmation, then end the call.`,
      ]
    case 'tmobile':
      return [
        `Open the dialer on your business phone.`,
        `Dial ${code} exactly (include the # at the end) and press call.`,
        `When you hear confirmation, hang up.`,
      ]
    case 'google_voice':
      return [
        `Open Google Voice in a web browser or the Google Voice app.`,
        `Go to Settings, then Calls.`,
        `Turn on “Forward calls to” and add ${display} as the number to ring.`,
      ]
    case 'ringcentral':
      return [
        `Sign in to RingCentral (web or desktop app).`,
        `Open Settings → Phone → Call forwarding or handling rules.`,
        `Add ${display} so unanswered calls forward to your Margen AI line.`,
      ]
    default:
      return [
        `Open your phone’s Settings app.`,
        `Find Phone → Call forwarding (wording varies by phone).`,
        `Choose “Forward when unanswered” or “Busy / no answer” and enter ${display}.`,
      ]
  }
}

/** Guess NPA for Twilio local number search: business line first, then address, then default. */
export function guessAreaCodeForProvisioning(address: string | null, businessPhone: string | null): string {
  const p = (businessPhone ?? '').replace(/\D/g, '')
  if (p.length >= 10) {
    const d = p.length === 11 && p.startsWith('1') ? p.slice(1) : p.slice(-10)
    if (/^[2-9]\d{2}/.test(d)) return d.slice(0, 3)
  }
  const m = /\(([2-9]\d{2})\)/.exec(address ?? '')
  if (m) return m[1]
  const m2 = /\b([2-9]\d{2})\s*\d{3}[-\s]?\d{4}\b/.exec(address ?? '')
  if (m2) return m2[1]
  return '213'
}
