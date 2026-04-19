/** Carrier slug stored on profiles.carrier — keep in sync with src/lib/forwardingDialCode.ts */
export type CarrierSlug = 'att' | 'verizon' | 'tmobile' | 'google_voice' | 'ringcentral' | 'other'

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

/** Snippet for SMS / “copy this” — may be dial string or plain-English steps. */
export function forwardingActivationSnippet(carrier: string, margenE164: string): string {
  const c = (carrier ?? '').toLowerCase().trim() as CarrierSlug
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
