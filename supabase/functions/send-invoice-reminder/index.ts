import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

type Body = { invoice_id: string }

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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  if (!body.invoice_id) return json(400, { error: 'Missing invoice_id' })

  const admin = supabaseAdmin()
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select('id, owner_id, status, amount_cents, stripe_checkout_url, sms_to, customers(name), jobs(job_type, title), profiles(company_name)')
    .eq('id', body.invoice_id)
    .maybeSingle()

  if (invErr || !invoice) return json(404, { error: invErr?.message ?? 'Invoice not found' })
  if (invoice.owner_id !== user.id) return json(403, { error: 'Forbidden' })
  if (invoice.status === 'paid') return json(409, { error: 'Invoice already paid' })
  if (!invoice.stripe_checkout_url) return json(409, { error: 'Invoice has no payment link' })

  const to = invoice.sms_to?.trim()
  if (!to) return json(409, { error: 'Invoice has no SMS recipient' })

  const company = (invoice.profiles as unknown as { company_name: string | null } | null)?.company_name?.trim() || 'Margen'
  const customerName = (invoice.customers as unknown as { name: string } | null)?.name?.trim() || 'there'
  const job = invoice.jobs as unknown as { job_type: string | null; title: string | null } | null
  const amount = (invoice.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  const msg =
    `Hi ${customerName} — just a quick reminder from ${company}.\n` +
    `Invoice${job?.job_type ? ` for ${job.job_type}` : ''}: ${amount}\n` +
    `Pay securely here: ${invoice.stripe_checkout_url}\n` +
    `Reply STOP to opt out.`

  const twilio = twilioClient()
  await twilio.messages.create({ to, from: twilioFromNumber(), body: msg })

  const { error: upErr } = await admin
    .from('invoices')
    .update({ last_reminder_at: new Date().toISOString() })
    .eq('id', invoice.id)
  if (upErr) return json(500, { error: upErr.message })

  return json(200, { ok: true })
})

