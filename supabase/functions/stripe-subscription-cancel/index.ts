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
    .select('stripe_subscription_id, status')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) return json(500, { error: error.message })
  const subId = (row as { stripe_subscription_id?: string } | null)?.stripe_subscription_id
  if (!subId) return json(404, { error: 'No active subscription' })

  try {
    const stripe = stripeClient()
    await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
    const sub = await stripe.subscriptions.retrieve(subId)
    await admin
      .from('subscriptions')
      .update({
        status: sub.status,
        current_period_end: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null,
      })
      .eq('owner_id', user.id)

    return json(200, { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})
