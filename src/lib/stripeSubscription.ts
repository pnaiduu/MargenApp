import { supabase } from './supabase'

function fnMessage(data: unknown, err: { message?: string } | null): string {
  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    return String((data as { error: string }).error)
  }
  return err?.message ?? 'Request failed'
}

export async function openStripeBillingPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'stripe-billing-portal',
    { body: {} },
  )
  if (error) throw new Error(fnMessage(data, error))
  const url = data?.url
  if (!url) throw new Error(fnMessage(data, null))
  window.location.href = url
}

export async function cancelSubscriptionAtPeriodEnd(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('stripe-subscription-cancel', {
    body: {},
  })
  if (error) throw new Error(fnMessage(data, error))
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}
