import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { twilioClient, twilioFromNumber } from '../_shared/twilio.ts'

type Body = {
  job_id: string
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
  if (!body.job_id) return json(400, { error: 'Missing job_id' })

  const admin = supabaseAdmin()

  const { data: job, error: jobErr } = await admin
    .from('jobs')
    .select(
      'id, owner_id, customer_id, technician_id, title, job_type, completed_at, revenue_cents, customers(name, phone), technicians(name, user_id)',
    )
    .eq('id', body.job_id)
    .maybeSingle()

  if (jobErr || !job) return json(404, { error: jobErr?.message ?? 'Job not found' })

  // Allow owner or assigned technician user to generate invoice.
  const requesterId = user.id
  const isOwner = requesterId === job.owner_id
  const isAssignedTechUser = Boolean(job.technicians?.user_id && job.technicians.user_id === requesterId)
  if (!isOwner && !isAssignedTechUser) return json(403, { error: 'Forbidden' })

  const amountCents = job.revenue_cents ?? 0
  if (amountCents <= 0) return json(400, { error: 'Job has no amount set (revenue_cents must be > 0)' })

  const { data: ownerProfile, error: profErr } = await admin
    .from('profiles')
    .select('company_name, stripe_account_id, stripe_charges_enabled, stripe_details_submitted')
    .eq('id', job.owner_id)
    .maybeSingle()

  if (profErr || !ownerProfile) return json(400, { error: profErr?.message ?? 'Owner profile not found' })

  if (!ownerProfile.stripe_account_id || !ownerProfile.stripe_charges_enabled) {
    return json(409, {
      error: 'Owner Stripe account not connected (or not enabled for charges). Connect Stripe in Settings.',
    })
  }

  const invoiceInsert = {
    owner_id: job.owner_id,
    job_id: job.id,
    customer_id: job.customer_id,
    technician_id: job.technician_id,
    status: 'draft' as const,
    amount_cents: amountCents,
    currency: 'usd',
    sms_to: job.customers?.phone ?? null,
  }

  const { data: invoice, error: invErr } = await admin.from('invoices').insert(invoiceInsert).select('*').single()
  if (invErr || !invoice) return json(500, { error: invErr?.message ?? 'Failed to create invoice' })

  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173'
  const stripe = stripeClient()

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: job.title,
              description: `Job type: ${job.job_type}${job.technicians?.name ? ` · Technician: ${job.technicians.name}` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        job_id: job.id,
        owner_id: job.owner_id,
      },
      success_url: `${siteUrl.replace(/\/$/, '')}/payments?paid=1&invoice=${invoice.id}`,
      cancel_url: `${siteUrl.replace(/\/$/, '')}/payments?cancelled=1&invoice=${invoice.id}`,
    },
    { stripeAccount: ownerProfile.stripe_account_id },
  )

  const { error: invUpErr } = await admin
    .from('invoices')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url ?? null,
    })
    .eq('id', invoice.id)
  if (invUpErr) return json(500, { error: invUpErr.message })

  if (body.send_sms) {
    const to = job.customers?.phone?.trim()
    if (!to) return json(409, { error: 'Customer has no phone number' })
    if (!session.url) return json(500, { error: 'Stripe did not return a Checkout URL' })

    const company = ownerProfile.company_name?.trim() || 'Margen'
    const customerName = job.customers?.name?.trim() || 'there'
    const tech = job.technicians?.name?.trim()
    const date = job.completed_at ? new Date(job.completed_at).toLocaleDateString() : new Date().toLocaleDateString()
    const amount = (amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

    const msg =
      body.custom_message?.trim() ||
      `Hi ${customerName} — your invoice from ${company} is ready.\n` +
        `Job: ${job.job_type}\n` +
        `${tech ? `Technician: ${tech}\n` : ''}` +
        `Date: ${date}\n` +
        `Amount: ${amount}\n` +
        `Pay securely here: ${session.url}`

    const twilio = twilioClient()
    await twilio.messages.create({
      to,
      from: twilioFromNumber(),
      body: msg,
    })

    const { error: sentErr } = await admin
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sms_to: to })
      .eq('id', invoice.id)
    if (sentErr) return json(500, { error: sentErr.message })
  }

  const { data: out, error: outErr } = await admin.from('invoices').select('*').eq('id', invoice.id).single()
  if (outErr || !out) return json(500, { error: outErr?.message ?? 'Failed to load invoice' })
  return json(200, { invoice: out })
})

