import Stripe from 'npm:stripe@16.12.0'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { stripeClient } from '../_shared/stripe.ts'

function text(status: number, body: string) {
  return new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } })
}

type CheckoutSession = {
  mode?: string
  metadata?: Record<string, string>
  subscription?: string | { id?: string } | null
  customer?: string | { id?: string } | null
  payment_intent?: string | { id?: string } | null
  client_reference_id?: string | null
}

type StripeSubLike = {
  id: string
  status: string
  metadata?: Record<string, string>
  customer?: string | { id?: string } | null
  current_period_end?: number | null
}

function customerIdFromSession(c: CheckoutSession['customer']): string {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && 'id' in c) return (c as { id: string }).id
  return ''
}

function customerIdFromSub(c: StripeSubLike['customer']): string {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && 'id' in c) return (c as { id: string }).id
  return ''
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0]
  const p = item?.price
  if (!p) return null
  return typeof p === 'string' ? p : p.id
}

function planFromEnvPriceId(priceId: string | null): 'starter' | 'growth' | 'scale' {
  if (!priceId) return 'starter'
  const pairs: ['starter' | 'growth' | 'scale', (string | undefined)[]][] = [
    ['growth', [Deno.env.get('STRIPE_PRICE_GROWTH'), Deno.env.get('STRIPE_PRICE_GROWTH_ANNUAL')]],
    ['scale', [Deno.env.get('STRIPE_PRICE_SCALE'), Deno.env.get('STRIPE_PRICE_SCALE_ANNUAL')]],
    ['starter', [Deno.env.get('STRIPE_PRICE_STARTER'), Deno.env.get('STRIPE_PRICE_STARTER_ANNUAL')]],
  ]
  for (const [plan, ids] of pairs) {
    if (ids.some((x) => x && x === priceId)) return plan
  }
  return 'starter'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return text(405, 'Method not allowed')

  const stripe = stripeClient()
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!secret) return text(500, 'Missing STRIPE_WEBHOOK_SECRET')

  const sig = req.headers.get('stripe-signature')
  if (!sig) return text(400, 'Missing stripe-signature header')

  const raw = await req.text()

  let event: ReturnType<typeof stripe.webhooks.constructEvent>
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (e) {
    return text(400, `Webhook signature verification failed: ${e instanceof Error ? e.message : 'unknown error'}`)
  }

  const admin = supabaseAdmin()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as CheckoutSession

    if (session.mode === 'subscription' && session.subscription) {
      const subId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? ''
      if (!subId) return text(200, 'subscription checkout missing id')

      const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
      const ownerId =
        (session.metadata?.owner_id ?? '').trim() ||
        (sub.metadata?.owner_id ?? '').trim() ||
        (session.client_reference_id ?? '').trim()
      if (!ownerId) return text(200, 'subscription checkout missing owner_id')

      const metaRaw = (sub.metadata?.plan ?? session.metadata?.plan ?? '').toLowerCase().trim()
      const plan: 'starter' | 'growth' | 'scale' =
        metaRaw === 'starter' || metaRaw === 'growth' || metaRaw === 'scale'
          ? (metaRaw as 'starter' | 'growth' | 'scale')
          : planFromEnvPriceId(priceIdFromSubscription(sub))

      const customerId = customerIdFromSession(session.customer)
      if (!customerId) return text(200, 'subscription checkout missing customer')

      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null

      const { error: upErr } = await admin.from('subscriptions').upsert(
        {
          owner_id: ownerId,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan,
          status: sub.status,
          current_period_end: periodEnd,
        },
        { onConflict: 'owner_id' },
      )
      if (upErr) return text(500, upErr.message)
      return text(200, 'ok subscription')
    }

    const invoiceId = (session.metadata?.invoice_id ?? '').trim()
    const jobId = (session.metadata?.job_id ?? '').trim()

    if (invoiceId) {
      const paidAt = new Date().toISOString()
      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

      await admin
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: paidAt,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq('id', invoiceId)

      if (jobId) {
        await admin.from('jobs').update({ is_paid: true, paid_at: paidAt }).eq('id', jobId)
      }

      try {
        const { data: inv } = await admin
          .from('invoices')
          .select('owner_id, technician_id, amount_cents')
          .eq('id', invoiceId)
          .maybeSingle()
        if (inv?.technician_id) {
          const { data: tech } = await admin.from('technicians').select('user_id').eq('id', inv.technician_id).maybeSingle()
          const techUser = tech?.user_id ?? null
          if (techUser) {
            const { data: toks } = await admin
              .from('expo_push_tokens')
              .select('token')
              .eq('user_id', techUser)
              .order('updated_at', { ascending: false })
              .limit(3)
            const tokens = (toks ?? []).map((t) => (t as { token: string }).token).filter(Boolean)
            if (tokens.length) {
              const amount = ((inv.amount_cents ?? 0) / 100).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
              })
              await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                  tokens.map((to) => ({
                    to,
                    title: 'Payment processed',
                    body: `A payment (${amount}) was processed for your job.`,
                    data: { invoice_id: invoiceId, job_id: jobId },
                  })),
                ),
              })
            }
          }
        }
      } catch {
        // ignore
      }
      return text(200, 'ok invoice')
    }

    return text(200, 'checkout ignored')
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as StripeSubLike
    const { data: row } = await admin.from('subscriptions').select('owner_id').eq('stripe_subscription_id', sub.id).maybeSingle()
    const ownerFromRow = (row as { owner_id?: string } | null)?.owner_id
    const ownerId = (sub.metadata?.owner_id ?? '').trim() || ownerFromRow
    if (!ownerId) return text(200, 'subscription webhook no owner')

    const full = await stripe.subscriptions.retrieve(sub.id, { expand: ['items.data.price'] })
    const metaRaw = (full.metadata?.plan ?? '').toLowerCase().trim()
    const plan: 'starter' | 'growth' | 'scale' =
      metaRaw === 'starter' || metaRaw === 'growth' || metaRaw === 'scale'
        ? (metaRaw as 'starter' | 'growth' | 'scale')
        : planFromEnvPriceId(priceIdFromSubscription(full))
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null
    const cust = customerIdFromSub(sub.customer)

    const patch: Record<string, unknown> = {
      status: sub.status,
      current_period_end: periodEnd,
      plan,
    }
    if (cust) patch.stripe_customer_id = cust

    const { error: uErr } = await admin.from('subscriptions').update(patch).eq('stripe_subscription_id', sub.id)
    if (uErr) return text(500, uErr.message)
    return text(200, 'ok subscription sync')
  }

  return text(200, 'ok')
})
