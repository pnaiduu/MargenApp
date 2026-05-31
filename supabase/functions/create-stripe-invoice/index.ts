import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

type Body = {
  job_id?: string
  customer_email?: string
  amount_cents?: number
  description?: string
  send_sms?: boolean
  custom_message?: string
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

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const admin = supabaseAdmin()
  let ownerId = user.id
  let jobId: string | null = body.job_id ?? null
  let customerId: string | null = null
  let technicianId: string | null = null
  let title = body.description?.trim() || 'Service invoice'
  let jobType = 'general'
  let amountCents = body.amount_cents ?? 0
  let customerPhone: string | null = null
  let customerName = 'Customer'
  let techName: string | null = null
  let completedAt: string | null = new Date().toISOString()

  if (jobId) {
    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select(
        'id, owner_id, customer_id, technician_id, title, job_type, completed_at, revenue_cents, customers(name, phone, email), technicians(name, user_id)',
      )
      .eq('id', jobId)
      .maybeSingle()

    if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })

    const isOwner = user.id === job.owner_id
    const isAssignedTechUser = Boolean(job.technicians?.user_id && job.technicians.user_id === user.id)
    if (!isOwner && !isAssignedTechUser) return json(403, { error: 'Forbidden' })

    ownerId = job.owner_id
    customerId = job.customer_id
    technicianId = job.technician_id
    title = job.title
    jobType = job.job_type
    amountCents = job.revenue_cents ?? 0
    customerPhone = job.customers?.phone ?? null
    customerName = job.customers?.name?.trim() || customerName
    techName = job.technicians?.name ?? null
    completedAt = job.completed_at
  } else {
    if (!body.customer_email?.trim() || !amountCents || amountCents <= 0) {
      return json(400, { error: 'Manual invoices require customer_email and amount_cents' })
    }
    title = body.description?.trim() || title
  }

  if (amountCents <= 0) return json(400, { error: 'Amount must be greater than zero' })

  const { data: ownerProfile, error: profErr } = await admin
    .from('profiles')
    .select('company_name, stripe_account_id, stripe_connect_account_id, stripe_charges_enabled')
    .eq('id', ownerId)
    .maybeSingle()

  if (profErr || !ownerProfile) return json(400, { error: profErr?.message ?? 'Owner profile not found' })

  const stripeAccountId = ownerProfile.stripe_connect_account_id ?? ownerProfile.stripe_account_id
  if (!stripeAccountId || !ownerProfile.stripe_charges_enabled) {
    return json(409, {
      error: 'Stripe Connect is not ready. Complete Stripe setup under Payments.',
    })
  }

  const invoiceInsert = {
    owner_id: ownerId,
    job_id: jobId,
    customer_id: customerId,
    technician_id: technicianId,
    status: 'draft' as const,
    amount_cents: amountCents,
    currency: 'usd',
    sms_to: customerPhone,
  }

  const { data: invoice, error: invErr } = await admin.from('invoices').insert(invoiceInsert).select('*').single()
  if (invErr || !invoice) return json(500, { error: invErr?.message ?? 'Failed to create invoice' })

  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173'
  const stripe = stripeClient()

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer_email: body.customer_email?.trim() || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: title,
              description: `Job type: ${jobType}${techName ? ` · Technician: ${techName}` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        job_id: jobId ?? '',
        owner_id: ownerId,
      },
      success_url: `${siteUrl.replace(/\/$/, '')}/payments?paid=1&invoice=${invoice.id}`,
      cancel_url: `${siteUrl.replace(/\/$/, '')}/payments?cancelled=1&invoice=${invoice.id}`,
    },
    { stripeAccount: stripeAccountId },
  )

  const { error: invUpErr } = await admin
    .from('invoices')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url ?? null,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', invoice.id)
  if (invUpErr) return json(500, { error: invUpErr.message })

  if (body.send_sms && customerPhone && session.url) {
    const company = ownerProfile.company_name?.trim() || 'Margen'
    const date = completedAt ? new Date(completedAt).toLocaleDateString() : new Date().toLocaleDateString()
    const amount = (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    const msg =
      body.custom_message?.trim() ||
      `Hi ${customerName} — your invoice from ${company} is ready.\n` +
        `Job: ${jobType}\n` +
        `${techName ? `Technician: ${techName}\n` : ''}` +
        `Date: ${date}\n` +
        `Amount: ${amount}\n` +
        `Pay securely here: ${session.url}`

    const twilio = twilioClient()
    await twilio.messages.create({ to: customerPhone, from: twilioFromNumber(), body: msg })
  }

  const { data: out, error: outErr } = await admin.from('invoices').select('*').eq('id', invoice.id).single()
  if (outErr || !out) return json(500, { error: outErr?.message ?? 'Failed to load invoice' })
  return json(200, { invoice: out })
})
