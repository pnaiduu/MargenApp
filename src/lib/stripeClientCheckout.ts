import type { PlanId } from './plans'
import { supabase } from './supabase'

function priceIdForPlan(plan: PlanId, billing: 'monthly' | 'annual'): string {
  const monthly: Record<PlanId, string | undefined> = {
    starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID,
    growth: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID,
    scale: import.meta.env.VITE_STRIPE_SCALE_PRICE_ID,
  }
  const annual: Record<PlanId, string | undefined> = {
    starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID_ANNUAL,
    growth: import.meta.env.VITE_STRIPE_GROWTH_PRICE_ID_ANNUAL,
    scale: import.meta.env.VITE_STRIPE_SCALE_PRICE_ID_ANNUAL,
  }
  const id = billing === 'annual' ? annual[plan] ?? monthly[plan] : monthly[plan]
  if (!id || typeof id !== 'string') {
    throw new Error(
      billing === 'annual'
        ? `Missing Stripe annual Price ID for ${plan}. Set VITE_STRIPE_${plan.toUpperCase()}_PRICE_ID_ANNUAL (or monthly ID as fallback).`
        : `Missing Stripe Price ID for ${plan}. Set VITE_STRIPE_${plan.toUpperCase()}_PRICE_ID in .env`,
    )
  }
  return id.trim()
}

export function checkoutSiteOrigin(): string {
  const u = import.meta.env.VITE_PUBLIC_SITE_URL
  if (typeof u === 'string' && u.trim()) return u.replace(/\/$/, '')
  return window.location.origin
}

/** Create a Stripe Checkout Session via Edge Function, then redirect to hosted checkout. */
export async function redirectToSubscriptionCheckout(params: {
  plan: PlanId
  billing: 'monthly' | 'annual'
  ownerId: string
  customerEmail: string
  signal?: AbortSignal
}): Promise<void> {
  const { plan, billing, signal } = params
  if (signal?.aborted) return

  const priceId = priceIdForPlan(plan, billing)

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (signal?.aborted) return
  if (sessionError) throw new Error(sessionError.message)

  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('You must be signed in to start checkout.')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-checkout-session`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ priceId, plan, billing }),
      signal,
    },
  )

  if (signal?.aborted) return

  const data = (await response.json()) as { url?: string; error?: string }
  if (!response.ok) throw new Error(data.error ?? 'Checkout failed')
  if (!data.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}
