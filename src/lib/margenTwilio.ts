import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type Supabase = SupabaseClient<Database>

export type ProvisionTwilioResponse = {
  ok?: boolean
  phone_number?: string
  formatted?: string
  already_provisioned?: boolean
  error?: string
}

export async function provisionMargenTwilioNumber(
  supabase: Supabase,
  params: { area_code: string; replace_existing?: boolean },
): Promise<{ data: ProvisionTwilioResponse | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<ProvisionTwilioResponse>('provision-twilio-number', {
    body: {
      area_code: params.area_code.replace(/\D/g, '').slice(0, 3),
      replace_existing: Boolean(params.replace_existing),
    },
  })
  if (error) return { data: null, error: new Error(error.message) }
  if (data && typeof data.error === 'string' && data.error && data.ok !== true) {
    return { data: null, error: new Error(data.error) }
  }
  if (data && (data.phone_number || data.formatted)) return { data, error: null }
  return { data: data ?? null, error: new Error('Unexpected response from phone setup.') }
}

export async function sendMargenForwardingSms(supabase: Supabase): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>('send-forwarding-sms', {
    body: {},
  })
  if (error) return { error: new Error(error.message) }
  if (data && typeof (data as { error?: string }).error === 'string' && (data as { error: string }).error) {
    return { error: new Error((data as { error: string }).error) }
  }
  return { error: null }
}
