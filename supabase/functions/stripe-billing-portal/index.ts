import { corsHeaders } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function siteUrl(): string {
  const u = (Deno.env.get('PUBLIC_SITE_URL') ?? Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '')
  if (!u) throw new Error('Missing PUBLIC_SITE_URL or SITE_URL')
  return u
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  const admin = supabaseAdmin()
  const { data: row, error } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) return json(500, { error: error.message })
  const customerId = (row as { stripe_customer_id?: string } | null)?.stripe_customer_id
  if (!customerId) return json(404, { error: 'No subscription billing profile found' })

  try {
    const stripe = stripeClient()
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl()}/settings`,
    })
    if (!portal.url) return json(500, { error: 'Stripe did not return a portal URL' })
    return json(200, { url: portal.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})
