import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Ensures a `profiles` row exists for the signed-in owner (`id` and `owner_id` = user.id).
 * Safe to call on every session; no-ops when the row already exists.
 */
export async function ensureOwnerProfile(
  client: SupabaseClient<Database>,
  user: User,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: selErr } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle()

  if (selErr) return { ok: false, error: selErr.message }
  if (existing) return { ok: true }

  const meta = user.user_metadata ?? {}
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : ''
  let companyName: string | null = null
  if (typeof meta.company_name === 'string') {
    const t = meta.company_name.trim()
    companyName = t === '' ? null : t
  }

  const { error: insErr } = await client.from('profiles').insert({
    id: user.id,
    owner_id: user.id,
    full_name: fullName,
    company_name: companyName,
  })

  if (insErr) {
    if (insErr.code === '23505') return { ok: true }
    return { ok: false, error: insErr.message }
  }
  return { ok: true }
}
