import Stripe from 'npm:stripe@16.12.0'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { encryptStripeUserSecret } from '../_shared/stripeUserKeyCrypto.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function looksLikeStripeSecret(k: string): boolean {
  const t = k.trim()
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(t)
}

function keyHint(k: string): string {
  const t = k.trim()
  if (t.length <= 10) return '***'
  return `…${t.slice(-6)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const master = Deno.env.get('STRIPE_USER_KEY_ENCRYPTION_SECRET')
  if (!master || master.length < 16) {
    return json(500, { error: 'Server missing STRIPE_USER_KEY_ENCRYPTION_SECRET (min 16 chars)' })
  }

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  let body: { secret_key?: string }
  try {
    body = (await req.json()) as { secret_key?: string }
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const secretKey = typeof body.secret_key === 'string' ? body.secret_key.trim() : ''
  if (!secretKey || !looksLikeStripeSecret(secretKey)) {
    return json(400, {
      error:
        'Paste a valid Stripe secret key (sk_…) or restricted key (rk_…) that can list Balance Transactions.',
    })
  }

  try {
    const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
    await stripe.balanceTransactions.list({ limit: 1 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe rejected this key'
    return json(400, { error: `Could not verify key with Stripe: ${msg}` })
  }

  let ciphertext: string
  try {
    ciphertext = await encryptStripeUserSecret(master, secretKey)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Encrypt failed'
    return json(500, { error: msg })
  }

  const admin = supabaseAdmin()
  const now = new Date().toISOString()

  const { error: credErr } = await admin.from('stripe_analytics_credentials').upsert(
    {
      owner_id: user.id,
      secret_encrypted: ciphertext,
      updated_at: now,
    },
    { onConflict: 'owner_id' },
  )
  if (credErr) return json(500, { error: credErr.message })

  const { error: profErr } = await admin
    .from('profiles')
    .update({
      stripe_analytics_key_hint: keyHint(secretKey),
      stripe_analytics_last_sync_at: null,
    })
    .eq('id', user.id)
  if (profErr) return json(500, { error: profErr.message })

  return json(200, { ok: true, hint: keyHint(secretKey) })
})
