import type { PlanId, SubscriptionRow } from './plans'
import { planAtLeast } from './plans'

/** Also add the same address to `dev_bypass_subscription_emails` (migration 030) so the row exists in `subscriptions`. */
const DEFAULT_DEV_EMAILS = ['davynaidu@gmail.com']

function devBypassEmailSet(): Set<string> {
  const env = import.meta.env.VITE_DEV_BYPASS_EMAILS
  const extra =
    typeof env === 'string'
      ? env
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : []
  return new Set([...DEFAULT_DEV_EMAILS.map((e) => e.toLowerCase()), ...extra])
}

export function isDevBypassEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return devBypassEmailSet().has(email.trim().toLowerCase())
}

const ACTIVE_SAAS = new Set(['active', 'trialing', 'past_due'])

export function hasActiveSaasSubscription(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false
  return ACTIVE_SAAS.has(sub.status)
}

/** Synthetic subscription for caps & route checks — full Scale access, no Stripe charges. */
export function effectiveSubscriptionRow(
  sub: SubscriptionRow | null,
  email: string | null | undefined,
): SubscriptionRow | null {
  if (isDevBypassEmail(email)) {
    return {
      plan: 'scale',
      status: 'active',
      current_period_end: null,
      stripe_customer_id: 'dev_bypass',
      stripe_subscription_id: 'dev_bypass',
    }
  }
  return sub
}

export function hasPaidDashboardAccess(sub: SubscriptionRow | null, email: string | null | undefined): boolean {
  if (isDevBypassEmail(email)) return true
  return hasActiveSaasSubscription(sub)
}

/** Routes that require Growth or Scale (see PRICING_PLANS feature matrix). */
export function minimumPlanForPath(pathname: string): PlanId | null {
  if (pathname === '/calls' || pathname.startsWith('/calls/')) return 'growth'
  if (pathname === '/hours' || pathname.startsWith('/hours/')) return 'growth'
  return null
}

export function isPathBlockedForPlan(pathname: string, plan: PlanId | null | undefined, isDev: boolean): boolean {
  if (isDev) return false
  const min = minimumPlanForPath(pathname)
  if (!min) return false
  if (!plan) return true
  return !planAtLeast(plan, min)
}
