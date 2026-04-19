import { corsHeaders } from '../_shared/cors.ts'
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

  const { error: delCred } = await admin.from('stripe_analytics_credentials').delete().eq('owner_id', user.id)
  if (delCred) return json(500, { error: delCred.message })

  const { error: delLedger } = await admin.from('stripe_ledger_lines').delete().eq('owner_id', user.id)
  if (delLedger) return json(500, { error: delLedger.message })

  const { error: profErr } = await admin
    .from('profiles')
    .update({
      stripe_analytics_key_hint: null,
      stripe_analytics_last_sync_at: null,
    })
    .eq('id', user.id)
  if (profErr) return json(500, { error: profErr.message })

  return json(200, { ok: true })
})
