import { loadStripe } from '@stripe/stripe-js'
import type { PlanId } from './plans'

let stripePromise: ReturnType<typeof loadStripe> | null = null

function getPublishableKey(): string {
  const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!k || typeof k !== 'string') {
    throw new Error('Missing VITE_STRIPE_PUBLISHABLE_KEY in environment.')
  }
  return k.trim()
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

/**
 * Client-only Stripe Checkout (legacy Stripe.js flow).
 * Pass `ownerId` + `plan` via client_reference_id; webhook maps Price ID → plan when metadata is absent.
 */
export async function redirectToSubscriptionCheckout(params: {
  plan: PlanId
  billing: 'monthly' | 'annual'
  ownerId: string
  customerEmail: string
  signal?: AbortSignal
}): Promise<void> {
  const { plan, billing, ownerId, customerEmail, signal } = params
  if (signal?.aborted) return
  const origin = checkoutSiteOrigin()
  const successUrl = `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${origin}/pricing`

  if (!stripePromise) {
    stripePromise = loadStripe(getPublishableKey())
  }
  const stripe = await stripePromise
  if (signal?.aborted) return
  if (!stripe) {
    throw new Error('Could not initialize Stripe.js')
  }

  const price = priceIdForPlan(plan, billing)

  const opts = {
    mode: 'subscription' as const,
    lineItems: [{ price, quantity: 1 }],
    successUrl,
    cancelUrl,
    clientReferenceId: ownerId,
    customerEmail: customerEmail.trim(),
    // Stripe-hosted Checkout: attach metadata to the Subscription for webhooks
    subscriptionData: {
      metadata: {
        owner_id: ownerId,
        plan,
        billing_period: billing,
      },
    },
  }

  // subscriptionData is supported by Stripe client Checkout but omitted from strict TS types
  const { error } = await stripe.redirectToCheckout(opts as never)
  if (signal?.aborted) return
  if (error) {
    throw new Error(error.message)
  }
}
