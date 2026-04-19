import { corsHeaders } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

type Plan = 'starter' | 'growth' | 'scale'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function siteUrl(): string {
  const u = (Deno.env.get('PUBLIC_SITE_URL') ?? Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '')
  if (!u) throw new Error('Missing PUBLIC_SITE_URL or SITE_URL for checkout redirects')
  return u
}

function priceIdForPlan(plan: Plan): string {
  const key =
    plan === 'starter'
      ? 'STRIPE_PRICE_STARTER'
      : plan === 'growth'
        ? 'STRIPE_PRICE_GROWTH'
        : 'STRIPE_PRICE_SCALE'
  const id = (Deno.env.get(key) ?? '').trim()
  if (!id) throw new Error(`Missing ${key} in function secrets`)
  return id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user?.email) return json(401, { error: 'Unauthorized' })

  let body: { plan?: string }
  try {
    body = (await req.json()) as { plan?: string }
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const plan = (body.plan ?? '').trim().toLowerCase() as Plan
  if (plan !== 'starter' && plan !== 'growth' && plan !== 'scale') {
    return json(400, { error: 'Invalid plan' })
  }

  try {
    const stripe = stripeClient()
    const base = siteUrl()
    const price = priceIdForPlan(plan)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}/?subscription=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      metadata: {
        owner_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          owner_id: user.id,
          plan,
        },
      },
      client_reference_id: user.id,
    })

    if (!session.url) return json(500, { error: 'Stripe did not return a checkout URL' })
    return json(200, { url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})
