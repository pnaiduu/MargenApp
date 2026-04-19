import twilio from 'npm:twilio@5.3.5'

export function twilioClient() {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!sid || !token) throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN')
  return twilio(sid, token)
}

export function twilioFromNumber() {
  const from = Deno.env.get('TWILIO_FROM_NUMBER')
  if (!from) throw new Error('Missing TWILIO_FROM_NUMBER')
  return from
}

