import type { SupabaseClient } from '@supabase/supabase-js'
import { inviteJoinAbsoluteUrl } from './inviteUrl'

/** Marker row for a reusable open team invite (not a named technician). */
export const OPEN_TEAM_INVITE_NAME = 'Open team invite'

function randomInviteToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
}

/** Returns trymargen.com/join/[token] (or local /join/[token] in dev). Creates invite if needed. */
export async function getOrCreateOwnerTeamInviteUrl(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ url: string } | { error: string }> {
  const now = new Date().toISOString()
  const { data: existing, error: lookupErr } = await supabase
    .from('technician_invites')
    .select('token')
    .eq('owner_id', ownerId)
    .eq('invited_name', OPEN_TEAM_INVITE_NAME)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupErr) return { error: lookupErr.message }
  if (existing?.token) {
    return { url: inviteJoinAbsoluteUrl(existing.token) }
  }

  const newToken = randomInviteToken()
  const { data: tech, error: tErr } = await supabase
    .from('technicians')
    .insert({
      owner_id: ownerId,
      name: OPEN_TEAM_INVITE_NAME,
      role: 'Technician',
      status: 'off_duty',
    })
    .select('id')
    .single()

  if (tErr || !tech) {
    return { error: tErr?.message ?? 'Could not create team invite.' }
  }

  const { error: iErr } = await supabase.from('technician_invites').insert({
    owner_id: ownerId,
    technician_id: tech.id,
    token: newToken,
    invited_name: OPEN_TEAM_INVITE_NAME,
    role: 'Technician',
  })

  if (iErr) {
    await supabase.from('technicians').delete().eq('id', tech.id)
    return { error: iErr.message }
  }

  return { url: inviteJoinAbsoluteUrl(newToken) }
}
