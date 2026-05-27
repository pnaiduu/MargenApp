import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const OPEN_TEAM_INVITE_NAME = 'Open team invite'

export function technicianLimitForPlan(plan: string): number {
  const id = plan.toLowerCase()
  if (id === 'scale') return Number.POSITIVE_INFINITY
  if (id === 'growth') return 20
  return 5
}

export async function countOwnerTechnicians(
  admin: SupabaseClient,
  ownerId: string,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await admin
    .from('technicians')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .neq('name', OPEN_TEAM_INVITE_NAME)

  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

export async function effectiveOwnerPlan(
  admin: SupabaseClient,
  ownerId: string,
): Promise<{ plan: string; error: string | null }> {
  const { data: userRow, error: userErr } = await admin.auth.admin.getUserById(ownerId)
  if (userErr) return { plan: 'starter', error: userErr.message }

  const email = userRow.user?.email?.trim().toLowerCase() ?? ''
  if (email) {
    const { data: devRow } = await admin
      .from('dev_bypass_subscription_emails')
      .select('email')
      .eq('email', email)
      .maybeSingle()
    if (devRow) return { plan: 'scale', error: null }
  }

  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('owner_id', ownerId)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subErr) return { plan: '', error: subErr.message }
  return { plan: sub?.plan ?? '', error: null }
}

export async function assertOwnerCanAddTechnician(
  admin: SupabaseClient,
  ownerId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [{ count, error: countErr }, { plan, error: planErr }] = await Promise.all([
    countOwnerTechnicians(admin, ownerId),
    effectiveOwnerPlan(admin, ownerId),
  ])

  if (countErr) return { ok: false, message: countErr }
  if (planErr) return { ok: false, message: planErr }

  if (!plan) {
    return { ok: false, message: 'Plan limit reached' }
  }
  const limit = technicianLimitForPlan(plan)
  if (count >= limit) {
    return { ok: false, message: 'Plan limit reached' }
  }
  return { ok: true }
}
