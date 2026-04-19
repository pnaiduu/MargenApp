import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { stripeClient } from '../_shared/stripe.ts'

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
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .maybeSingle()
  if (profErr || !profile) return json(400, { error: profErr?.message ?? 'Profile not found' })
  if (!profile.stripe_account_id) return json(409, { error: 'Stripe account not connected yet' })

  const stripe = stripeClient()
  const acct = await stripe.accounts.retrieve(profile.stripe_account_id)

  const chargesEnabled = Boolean((acct as unknown as { charges_enabled?: boolean }).charges_enabled)
  const detailsSubmitted = Boolean((acct as unknown as { details_submitted?: boolean }).details_submitted)

  const { error: upErr } = await admin
    .from('profiles')
    .update({ stripe_charges_enabled: chargesEnabled, stripe_details_submitted: detailsSubmitted })
    .eq('id', user.id)
  if (upErr) return json(500, { error: upErr.message })

  return json(200, { stripe_charges_enabled: chargesEnabled, stripe_details_submitted: detailsSubmitted })
})

