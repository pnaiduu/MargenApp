export type PlanId = 'starter' | 'growth' | 'scale'

export type SubscriptionRow = {
  plan: PlanId
  status: string
  current_period_end: string | null
  stripe_customer_id: string
  stripe_subscription_id: string
}

const ACTIVE = new Set(['active', 'trialing', 'past_due'])

/** Summary rows for Settings / Subscribe copy (detailed marketing lives on Pricing page). */
export const PRICING_PLANS: {
  id: PlanId
  name: string
  priceUsd: number
  priceAnnualUsd: number
  interval: string
  techLimit: number | null
  popular?: boolean
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceUsd: 299,
    priceAnnualUsd: 2990,
    interval: 'month',
    techLimit: 5,
  },
  {
    id: 'growth',
    name: 'Growth',
    priceUsd: 599,
    priceAnnualUsd: 5990,
    interval: 'month',
    techLimit: 20,
    popular: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    priceUsd: 1499,
    priceAnnualUsd: 14990,
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
