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
    .select('id, full_name, company_name, stripe_account_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profErr || !profile) return json(400, { error: profErr?.message ?? 'Profile not found' })

  const stripe = stripeClient()
  let accountId = profile.stripe_account_id ?? null

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: 'express',
      metadata: { owner_id: user.id },
      business_profile: {
        name: profile.company_name ?? undefined,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })
    accountId = acct.id
    const { error: upErr } = await admin
      .from('profiles')
      .update({ stripe_account_id: accountId })
      .eq('id', user.id)
    if (upErr) return json(500, { error: upErr.message })
  }

  const siteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'http://localhost:5173'
  const refreshUrl = `${siteUrl.replace(/\/$/, '')}/settings?stripe=refresh`
  const returnUrl = `${siteUrl.replace(/\/$/, '')}/settings?stripe=return`

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: refreshUrl,
    return_url: returnUrl,
  })

  return json(200, { url: link.url, stripe_account_id: accountId })
})

