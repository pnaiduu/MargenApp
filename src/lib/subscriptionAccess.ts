import type { PlanId, SubscriptionRow } from './plans'
import { planAtLeast, planById } from './plans'

/** Max technicians for a plan tier (`Infinity` = unlimited). */
export function getTechnicianLimit(plan: string): number {
  const id = plan.toLowerCase()
  if (id === 'scale') return Infinity
  if (id === 'growth') return 20
  return 5
}

export function canAddTechnician(currentCount: number, plan: string): boolean {
  const limit = getTechnicianLimit(plan)
  if (!Number.isFinite(limit)) return true
  return currentCount < limit
}

/** Human label for limit (e.g. "5" or "unlimited"). */
export function formatTechnicianLimit(plan: string): string {
  const limit = getTechnicianLimit(plan)
  return Number.isFinite(limit) ? String(limit) : 'unlimited'
}

/** Next upgrade tier for technician cap messaging. */
export function nextPlanForTechnicianCap(plan: PlanId): PlanId | null {
  if (plan === 'starter') return 'growth'
  if (plan === 'growth') return 'scale'
  return null
}

export function nextPlanDisplayName(plan: PlanId): string {
  const next = nextPlanForTechnicianCap(plan)
  return next ? (planById(next)?.name ?? next) : ''
}

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
