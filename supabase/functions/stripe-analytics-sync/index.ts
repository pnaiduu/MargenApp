import Stripe from 'npm:stripe@16.12.0'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { supabaseAuthed } from '../_shared/supabaseAuthed.ts'
import { decryptStripeUserSecret } from '../_shared/stripeUserKeyCrypto.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const DEFAULT_DAYS = 120

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const master = Deno.env.get('STRIPE_USER_KEY_ENCRYPTION_SECRET')
  if (!master || master.length < 16) {
    return json(500, { error: 'Server missing STRIPE_USER_KEY_ENCRYPTION_SECRET' })
  }

  const sb = supabaseAuthed(req)
  const { data: userRes, error: userErr } = await sb.auth.getUser()
  const user = userRes?.user
  if (userErr || !user) return json(401, { error: 'Unauthorized' })

  let daysBack = DEFAULT_DAYS
  const raw = await req.text()
  if (raw.trim()) {
    try {
      const b = JSON.parse(raw) as { days_back?: unknown }
      if (typeof b.days_back === 'number') {
        const n = Math.floor(b.days_back)
        if (n >= 7 && n <= 365) daysBack = n
      }
    } catch {
      /* ignore invalid body */
    }
  }

  const admin = supabaseAdmin()
  const { data: row, error: credErr } = await admin
    .from('stripe_analytics_credentials')
    .select('secret_encrypted')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (credErr) return json(500, { error: credErr.message })
  const enc = (row as { secret_encrypted?: string } | null)?.secret_encrypted
  if (!enc) return json(400, { error: 'No Stripe API key saved. Add one in Settings first.' })

  let secretKey: string
  try {
    secretKey = await decryptStripeUserSecret(master, enc)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Decrypt failed'
    return json(500, { error: msg })
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
  const since = Math.floor(Date.now() / 1000) - daysBack * 24 * 60 * 60

  const batch: Record<string, unknown>[] = []
  let startingAfter: string | undefined
  let pages = 0
  const maxPages = 50

  try {
    while (pages < maxPages) {
      pages += 1
      const list = await stripe.balanceTransactions.list({
        limit: 100,
        created: { gte: since },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      for (const bt of list.data) {
        batch.push({
          owner_id: user.id,
          stripe_balance_txn_id: bt.id,
          amount_cents: bt.amount,
          fee_cents: bt.fee ?? 0,
          currency: bt.currency ?? 'usd',
          reporting_category: bt.reporting_category ?? null,
          txn_type: bt.type ?? null,
          description: bt.description ?? null,
          available_on: bt.available_on ? new Date(bt.available_on * 1000).toISOString() : null,
          stripe_created_at: new Date(bt.created * 1000).toISOString(),
        })
      }
      if (!list.has_more || list.data.length === 0) break
      startingAfter = list.data[list.data.length - 1]?.id
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe list failed'
    return json(400, { error: msg })
  }

  const chunk = 80
  for (let i = 0; i < batch.length; i += chunk) {
    const slice = batch.slice(i, i + chunk)
    const { error: upErr } = await admin.from('stripe_ledger_lines').upsert(slice, {
      onConflict: 'owner_id,stripe_balance_txn_id',
    })
    if (upErr) return json(500, { error: upErr.message })
  }

  const syncedAt = new Date().toISOString()
  const { error: pErr } = await admin
    .from('profiles')
    .update({ stripe_analytics_last_sync_at: syncedAt })
    .eq('id', user.id)
  if (pErr) return json(500, { error: pErr.message })

  return json(200, { ok: true, rows_upserted: batch.length, synced_at: syncedAt })
})
