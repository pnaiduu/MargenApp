import { supabase } from './supabase'

function fnMessage(data: unknown, err: { message?: string } | null): string {
  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    return String((data as { error: string }).error)
  }
  return err?.message ?? 'Request failed'
}

/** Saves owner Stripe secret or restricted key (server encrypts; never stored in plaintext on the client). */
export async function saveStripeAnalyticsSecretKey(secretKey: string): Promise<{ hint: string }> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    hint?: string
    error?: string
  }>('stripe-analytics-save-key', { body: { secret_key: secretKey } })
  if (error) throw new Error(fnMessage(data, error))
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  const hint = data?.hint
  if (!hint) throw new Error('Save did not return a key hint')
  return { hint }
}

export async function syncStripeAnalyticsLedger(daysBack?: number): Promise<{ rows_upserted: number }> {
  const body = daysBack != null ? { days_back: daysBack } : {}
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean
    rows_upserted?: number
    error?: string
  }>('stripe-analytics-sync', { body })
  if (error) throw new Error(fnMessage(data, error))
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  const n = data?.rows_upserted
  if (typeof n !== 'number') throw new Error('Sync did not return row count')
  return { rows_upserted: n }
}

export async function disconnectStripeAnalytics(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'stripe-analytics-disconnect',
    { body: {} },
  )
  if (error) throw new Error(fnMessage(data, error))
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}
