import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { WorkspaceAccessContext } from '../contexts/workspace-access-context'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'
import { supabase } from '../lib/supabase'
import type { SubscriptionRow } from '../lib/plans'
import {
  effectiveSubscriptionRow,
  hasActiveSaasSubscription,
  hasPaidDashboardAccess,
  isDevBypassEmail,
  isPathBlockedForPlan,
} from '../lib/subscriptionAccess'

function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex min-h-dvh items-center justify-center bg-[var(--color-margen-surface)] px-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.27, ease: easePremium }}
    >
      {children}
    </motion.div>
  )
}

export function SubscriptionAccessRoute() {
  const { user, loading: authLoading } = useAuth()
  const location = useLocation()
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }
    const ac = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, stripe_customer_id, stripe_subscription_id')
          .eq('owner_id', user.id)
          .abortSignal(ac.signal)
          .maybeSingle()
        if (ac.signal.aborted) return
        if (error) {
          setSubscription(null)
        } else if (data) {
          setSubscription(data as SubscriptionRow)
        } else {
          setSubscription(null)
        }
      } catch {
        if (!ac.signal.aborted) {
          setSubscription(null)
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => {
      ac.abort()
    }
  }, [user])

  const dev = isDevBypassEmail(user?.email)
  const paid = hasPaidDashboardAccess(subscription, user?.email)
  const path = location.pathname
  const subscribeOnly = path === '/subscribe' || path.startsWith('/subscribe/')
  /** Home is reachable without a plan so users are not stuck in a pricing↔dashboard redirect loop. */
  const dashboardHomeWithoutPaidOk = path === '/dashboard'

  const effectiveSubscription = useMemo(
    () => effectiveSubscriptionRow(subscription, user?.email),
    [subscription, user?.email],
  )

  const contextValue = useMemo(
    () => ({
      subscription,
      effectiveSubscription,
      isDevBypass: dev,
      hasPaidSaas: hasActiveSaasSubscription(subscription),
      accessLoading: authLoading || loading,
    }),
    [subscription, effectiveSubscription, dev, authLoading, loading],
  )

  if (authLoading || loading) {
    return (
      <FadeIn>
        <motion.p
          className="text-sm text-[var(--color-margen-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.25, ease: easePremium }}
        >
          Loading workspace…
        </motion.p>
      </FadeIn>
    )
  }

  if (!subscribeOnly && !paid && !dashboardHomeWithoutPaidOk) {
    return <Navigate to="/pricing" replace state={{ subscriptionRequired: true }} />
  }

  if (!subscribeOnly && paid) {
    const plan = effectiveSubscription?.plan ?? null
    if (isPathBlockedForPlan(path, plan, dev)) {
      return <Navigate to="/dashboard" replace state={{ planUpgradeRequired: true, blockedPath: path }} />
    }
  }

  return (
    <WorkspaceAccessContext.Provider value={contextValue}>
      <Outlet />
    </WorkspaceAccessContext.Provider>
  )
}
