import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'
import type { PlanId } from '../lib/plans'
import { PRICING_PLANS } from '../lib/plans'
import { redirectToSubscriptionCheckout } from '../lib/stripeClientCheckout'

function isPlanId(s: string | null): s is PlanId {
  return s === 'starter' || s === 'growth' || s === 'scale'
}

function readBilling(): 'monthly' | 'annual' {
  try {
    const b = sessionStorage.getItem('margen_checkout_billing')
    if (b === 'annual' || b === 'monthly') return b
  } catch {
    // ignore
  }
  return 'monthly'
}

export function SubscribePage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const planParam = searchParams.get('plan')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resolvedPlan, setResolvedPlan] = useState<PlanId | null>(null)
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setError('Sign in to continue checkout.')
      setBusy(false)
      return
    }

    let stored: string | null = null
    try {
      stored = sessionStorage.getItem('margen_checkout_plan')
    } catch {
      stored = null
    }
    const effective = isPlanId(planParam) ? planParam : isPlanId(stored) ? stored : null
    if (!effective) {
      setError('Pick a plan from Pricing first.')
      setBusy(false)
      return
    }
    setResolvedPlan(effective)
    const billing = readBilling()
    const ac = new AbortController()
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        await redirectToSubscriptionCheckout({
          plan: effective,
          billing,
          ownerId: user.id,
          customerEmail: user.email ?? '',
          signal: ac.signal,
        })
        if (ac.signal.aborted) return
        try {
          sessionStorage.removeItem('margen_checkout_plan')
        } catch {
          // ignore
        }
      } catch (e) {
        if (ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Checkout failed')
        setBusy(false)
      }
    })()
    return () => {
      ac.abort()
    }
  }, [planParam, user, authLoading])

  const planMeta = resolvedPlan ? PRICING_PLANS.find((p) => p.id === resolvedPlan) : null

  return (
    <div className="mx-auto max-w-lg py-16">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: easePremium }}
        className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-6 py-10 text-center"
      >
        <h1 className="page-title">Redirecting to checkout</h1>
        {planMeta ? (
          <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
            {planMeta.name} — from ${planMeta.priceUsd}/mo
          </p>
        ) : null}
        {busy && !error ? (
          <p className="mt-6 text-sm text-[var(--color-margen-muted)]">Opening secure Stripe Checkout…</p>
        ) : null}
        {error ? (
          <>
            <p className="mt-4 text-sm text-danger">{error}</p>
            <Link
              to="/pricing"
              className="mt-6 inline-block text-sm font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline"
            >
              View plans
            </Link>
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
