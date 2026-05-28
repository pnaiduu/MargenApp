export type PlanId = 'starter' | 'growth' | 'scale'

export type SubscriptionRow = {
  plan: PlanId
  status: string
  current_period_end: string | null
  stripe_customer_id: string
  stripe_subscription_id: string
}

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

/** Founding member pricing (20% off list price, locked for life). */
export const FOUNDING_MEMBER_BANNER =
  'Founding member pricing — lock in 20% off forever. This offer ends soon.'

export const PRICING_PLANS: {
  id: PlanId
  name: string
  priceUsd: number
  foundingPriceUsd: number
  priceAnnualUsd: number
  foundingPriceAnnualUsd: number
  interval: string
  techLimit: number | null
  popular?: boolean
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 500,
    foundingPriceUsd: 400,
    priceAnnualUsd: 5000,
    foundingPriceAnnualUsd: 4000,
    interval: 'month',
    techLimit: 5,
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUsd: 800,
    foundingPriceUsd: 640,
    priceAnnualUsd: 8000,
    foundingPriceAnnualUsd: 6400,
    interval: 'month',
    techLimit: 20,
    popular: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    priceUsd: 2000,
    foundingPriceUsd: 1600,
    priceAnnualUsd: 20000,
    foundingPriceAnnualUsd: 16000,
    interval: 'month',
    techLimit: null,
  },
]

export function planById(id: string | null | undefined) {
  return PRICING_PLANS.find((p) => p.id === id) ?? null
}

const PLAN_RANK: Record<PlanId, number> = { starter: 0, growth: 1, scale: 2 }

/** True if `plan` is the same tier or higher than `minimum`. */
export function planAtLeast(plan: PlanId, minimum: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum]
}

/** Max technicians: `null` = unlimited. `0` = cannot add (inactive, canceled, or no subscription row). */
export function technicianInviteCap(sub: Pick<SubscriptionRow, 'plan' | 'status'> | null): number | null {
  if (!sub) return 0
  if (!ACTIVE.has(sub.status)) return 0
  if (sub.plan === 'scale') return null
  if (sub.plan === 'growth') return 20
  return 5
}
