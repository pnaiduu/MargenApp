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

function connectRedirectUri(): string {
  return (
    Deno.env.get('STRIPE_CONNECT_REDIRECT_URI')?.trim() ||
    `${(Deno.env.get('PUBLIC_SITE_URL') ?? 'https://trymargen.com').replace(/\/$/, '')}/settings/stripe-callback`
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  let body: { code?: string }
  try {
    body = (await req.json()) as { code?: string }
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }

  const code = body.code?.trim()
  if (!code) return json(400, { error: 'Missing OAuth code' })

  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) return json(500, { error: 'Missing STRIPE_SECRET_KEY' })

  const redirectUri = connectRedirectUri()
  const tokenRes = await fetch('https://connect.stripe.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_secret: secretKey,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  })

  const tokenJson = (await tokenRes.json()) as {
    error?: string
    error_description?: string
    stripe_user_id?: string
    access_token?: string
  }

  if (!tokenRes.ok || tokenJson.error) {
    return json(400, {
      error: tokenJson.error_description ?? tokenJson.error ?? 'Stripe OAuth token exchange failed',
    })
  }

  const accountId = tokenJson.stripe_user_id
  if (!accountId) return json(400, { error: 'Stripe did not return a connected account ID' })

  const stripe = stripeClient()
  const acct = await stripe.accounts.retrieve(accountId)
  const email =
    (acct as { email?: string | null }).email ??
    (acct as { business_profile?: { support_email?: string | null } }).business_profile?.support_email ??
    null
  const chargesEnabled = Boolean((acct as { charges_enabled?: boolean }).charges_enabled)
  const detailsSubmitted = Boolean((acct as { details_submitted?: boolean }).details_submitted)

  const admin = supabaseAdmin()
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_email: email,
      stripe_account_id: accountId,
      stripe_charges_enabled: chargesEnabled,
      stripe_details_submitted: detailsSubmitted,
    })
    .eq('id', user.id)

  if (upErr) return json(500, { error: upErr.message })

  return json(200, {
    stripe_connect_account_id: accountId,
    stripe_connect_email: email,
    stripe_charges_enabled: chargesEnabled,
    stripe_details_submitted: detailsSubmitted,
  })
})
