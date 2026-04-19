import type { SupabaseClient } from '@supabase/supabase-js'

/** One-time owner reminder per invoice when the customer has not confirmed payment after the deadline. */
export async function sweepOverduePaymentConfirmations(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { data: rows, error } = await supabase
    .from('invoices')
    .select('id')
    .eq('owner_id', ownerId)
    .in('status', ['draft', 'sent'])
    .not('payment_confirmation_token', 'is', null)
    .is('payment_confirmed_at', null)
    .is('owner_payment_reminder_sent_at', null)
    .lt('payment_confirmation_deadline_at', now)

  if (error || !rows?.length) return

  for (const row of rows) {
    const { data: claimed, error: claimErr } = await supabase
      .from('invoices')
      .update({ owner_payment_reminder_sent_at: now })
      .eq('id', row.id)
      .is('owner_payment_reminder_sent_at', null)
      .select('id')
      .maybeSingle()

    if (claimErr || !claimed) continue

    await supabase.from('notifications').insert({
      owner_id: ownerId,
      type: 'payment_unconfirmed',
      title: 'Payment not confirmed',
      message:
        'A customer has not confirmed how they paid within 24 hours. Please confirm payment manually on the Payments page.',
      link: '/payments',
      read: false,
    })
  }
}
