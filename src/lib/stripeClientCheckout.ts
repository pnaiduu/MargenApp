import type { PlanId } from './plans'
import { supabase } from './supabase'

function fnMessage(data: unknown, err: { message?: string } | null): string {
  if (data && typeof data === 'object' && 'error' in data && (data as { error: string }).error) {
    return String((data as { error: string }).error)
  }
  return err?.message ?? 'Request failed'
}

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

  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'stripe-create-checkout-session',
    { body: { priceId, plan, billing } },
  )

  if (signal?.aborted) return
  if (error) throw new Error(fnMessage(data, error))

  const url = data?.url
  if (!url) throw new Error(fnMessage(data, null))

  window.location.href = url
}
