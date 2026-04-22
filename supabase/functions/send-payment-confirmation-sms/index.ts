import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { getUserFromAuthHeader, unauthorizedResponse } from '../_shared/supabaseAuthed.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

type Body = { job_id: string }

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function randomToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const { user, error } = await getUserFromAuthHeader(req)
  if (error || !user) return unauthorizedResponse()

  const body = (await req.json().catch(() => null)) as Body | null
  if (!body?.job_id) return json(400, { error: 'Missing job_id' })

  const admin = supabaseAdmin()

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select('id, owner_id, technician_id, title, revenue_cents, customers(name, phone)')
    .eq('id', body.job_id)
    .maybeSingle()

  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })

  let isTech = false
  if (job.technician_id) {
    const techOk = await admin
      .from('technicians')
      .select('id')
      .eq('id', job.technician_id)
      .eq('user_id', user.id)
      .maybeSingle()
    isTech = Boolean(techOk.data)
  }
  const isOwner = job.owner_id === user.id
  if (!isTech && !isOwner) return json(403, { error: 'Forbidden' })

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .select(
      'id, owner_id, job_id, sms_to, payment_confirmation_token, payment_confirmation_sent_at, status, amount_cents, sent_at',
    )
    .eq('job_id', job.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (invErr || !inv) return json(404, { error: 'No invoice for this job yet' })

  const cust = job.customers as { name: string | null; phone: string | null } | null
  const phone = (cust?.phone ?? inv.sms_to ?? '').trim()
  if (!phone) return json(409, { error: 'Customer has no phone on file' })

  const site = (Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
  let token = inv.payment_confirmation_token as string | null
  if (!token) {
    token = randomToken()
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: upTok } = await admin
      .from('invoices')
      .update({
        payment_confirmation_token: token,
        payment_confirmation_deadline_at: deadline,
      })
      .eq('id', inv.id)
    if (upTok) return json(500, { error: upTok.message })
  }

  if (inv.payment_confirmation_sent_at) {
    return json(200, { ok: true, skipped: true, message: 'SMS already sent for this invoice' })
  }

  const { data: prof } = await admin.from('profiles').select('company_name').eq('id', job.owner_id).maybeSingle()
  const company = (prof as { company_name: string | null } | null)?.company_name?.trim() || 'Margen'
  const amountUsd = ((inv.amount_cents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const payUrl = `${site}/confirm-payment?token=${encodeURIComponent(token)}`
  const msg =
    `${company}: Thanks! Job "${(job.title ?? 'Service').slice(0, 80)}" — ${amountUsd}. ` +
    `Please confirm how you paid: ${payUrl}\n` +
    `Reply STOP to opt out.`

  try {
    const twilio = twilioClient()
    await twilio.messages.create({
      to: phone,
      from: twilioFromNumber(),
      body: msg,
    })
  } catch (e) {
    const msgErr = e instanceof Error ? e.message : String(e)
    return json(502, { error: `Twilio SMS failed: ${msgErr}` })
  }

  const nowIso = new Date().toISOString()
  const prevSentAt = inv.sent_at as string | null | undefined
  const { error: finErr } = await admin
    .from('invoices')
    .update({
      payment_confirmation_sent_at: nowIso,
      status: 'sent',
      sent_at: inv.status === 'draft' ? nowIso : prevSentAt ?? nowIso,
      sms_to: phone,
    })
    .eq('id', inv.id)

  if (finErr) return json(500, { error: finErr.message })

  return json(200, { ok: true })
})
