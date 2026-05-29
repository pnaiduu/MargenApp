import { supabase } from './supabase'
import { parseInviteToken } from './inviteToken'

export async function claimTechnicianInvite(rawCode: string): Promise<{ error: string | null }> {
  const token = parseInviteToken(rawCode)
  if (!token) {
    return { error: 'Enter a valid invite code.' }
  }

  const { data, error } = await supabase.rpc('claim_technician_invite', { p_token: token })
  if (error) {
    return { error: error.message }
  }

  const row = data as { ok?: boolean; error?: string } | null
  if (!row?.ok) {
    return { error: row?.error ?? 'Invalid or expired invite code' }
  }

  return { error: null }
}
