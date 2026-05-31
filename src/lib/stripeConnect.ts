import { supabase } from './supabase'

const STRIPE_CONNECT_REDIRECT_URI = 'https://trymargen.com/settings/stripe-callback'

export function stripeConnectRedirectUri(): string {
  const site = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (site) return `${site}/settings/stripe-callback`
  return STRIPE_CONNECT_REDIRECT_URI
}

export function stripeConnectOAuthUrl(): string {
  const clientId = import.meta.env.VITE_STRIPE_CONNECT_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error('Missing VITE_STRIPE_CONNECT_CLIENT_ID')
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: stripeConnectRedirectUri(),
  })
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

export async function exchangeStripeConnectCode(code: string): Promise<{
  stripe_connect_account_id: string
  stripe_connect_email: string | null
  stripe_charges_enabled: boolean
  stripe_details_submitted: boolean
}> {
  const { data, error } = await supabase.functions.invoke<{
    stripe_connect_account_id?: string
    stripe_connect_email?: string | null
    stripe_charges_enabled?: boolean
    stripe_details_submitted?: boolean
    error?: string
  }>('stripe-connect-oauth', { body: { code } })

  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  if (!data?.stripe_connect_account_id) {
    throw new Error('Stripe connection failed')
  }
  return {
    stripe_connect_account_id: data.stripe_connect_account_id,
    stripe_connect_email: data.stripe_connect_email ?? null,
    stripe_charges_enabled: Boolean(data.stripe_charges_enabled),
    stripe_details_submitted: Boolean(data.stripe_details_submitted),
  }
}

export async function disconnectStripeConnect(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('stripe-connect-disconnect', {
    body: {},
  })
  if (error) throw new Error(error.message)
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
}
