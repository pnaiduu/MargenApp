import { supabase } from './supabase'

function fnMessage(data: unknown, err: { message?: string } | null): string {
  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    return String((data as { error: string }).error)
  }
  return err?.message ?? 'Request failed'
}

export async function createStripeInvoice(body: {
  job_id?: string
  customer_email?: string
  amount_cents?: number
  description?: string
  send_sms?: boolean
}): Promise<{ invoice?: unknown; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<{ invoice?: unknown; error?: string }>(
    'create-stripe-invoice',
    { body },
  )
  if (error) return { error: new Error(fnMessage(data, error)) }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { error: new Error(String(data.error)) }
  }
  return { invoice: data?.invoice, error: null }
}
