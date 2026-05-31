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
    .select('stripe_connect_account_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !profile) return json(400, { error: profErr?.message ?? 'Profile not found' })

  const accountId = profile.stripe_connect_account_id
  if (accountId) {
    const clientId = Deno.env.get('STRIPE_CONNECT_CLIENT_ID')?.trim()
    if (clientId) {
      try {
        const stripe = stripeClient()
        await stripe.oauth.deauthorize({ client_id: clientId, stripe_user_id: accountId })
      } catch {
        // Still clear local connection if Stripe deauthorize fails (already revoked, etc.)
      }
    }
  }

  const { error: upErr } = await admin
    .from('profiles')
    .update({
      stripe_connect_account_id: null,
      stripe_connect_email: null,
      stripe_account_id: null,
      stripe_charges_enabled: false,
      stripe_details_submitted: false,
    })
    .eq('id', user.id)

  if (upErr) return json(500, { error: upErr.message })
  return json(200, { disconnected: true })
})
