import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type Supabase = SupabaseClient<Database>

/** Stored on `profiles.margen_phone_sid` until real Twilio provisioning is deployed. */
export const PLACEHOLDER_MARGEN_PHONE_SID = 'placeholder'

/**
 * Deterministic fake U.S. number for onboarding before Edge Twilio provisioning exists.
 * Stays unique enough for `profiles_margen_phone_digits_uidx` in normal use.
 */
export function placeholderMargenE164ForOwner(ownerId: string): string {
  let h = 0
  for (let i = 0; i < ownerId.length; i++) {
    h = (Math.imul(31, h) + ownerId.charCodeAt(i)) | 0
  }
  const v = Math.abs(h) % 7_000_000
  const last7 = String(2_000_000 + v).padStart(7, '0').slice(0, 7)
  return `+1202${last7}`
}

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

