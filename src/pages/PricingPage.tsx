import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { easePremium, tapButton } from '../lib/motion'
import type { PlanId } from '../lib/plans'
import { redirectToSubscriptionCheckout } from '../lib/stripeClientCheckout'

type Billing = 'monthly' | 'annual'

type FeatureRow = { text: string; included: boolean }

type PlanCard = {
  id: PlanId
  name: string
  monthly: number
  annual: number
  techLine: string
  included: FeatureRow[]
  locked: FeatureRow[]
  popular?: boolean
  contactSales?: boolean
}

const PLANS: PlanCard[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 299,
    annual: 2990,
    techLine: 'Up to 5 technicians',
    included: [
      { text: 'Up to 5 technicians', included: true },
      { text: 'AI receptionist up to 300 calls/month', included: true },
      { text: 'Job creation and scheduling', included: true },
      { text: 'Customer profiles', included: true },
      { text: 'Basic revenue tracking', included: true },
      { text: '1 service area', included: true },
      { text: 'Email support', included: true },
    ],
    locked: [
      { text: 'AI auto-assignment', included: false },
      { text: 'GPS tracking', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Customer ratings', included: false },
      { text: 'Multiple service areas', included: false },
      { text: 'Payment integration', included: false },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 599,
    annual: 5990,
    techLine: 'Up to 20 technicians',
    popular: true,
    included: [
      { text: 'Up to 20 technicians', included: true },
      { text: 'AI receptionist up to 1,000 calls/month', included: true },
      { text: 'Everything in Starter', included: true },
      { text: 'AI auto job assignment', included: true },
      { text: 'Live GPS technician tracking', included: true },
      { text: 'Advanced revenue analytics', included: true },
      { text: 'Missed revenue calculator', included: true },
      { text: 'Customer ratings system', included: true },
      { text: 'Hours and attendance tracking', included: true },
      { text: 'Up to 3 service areas', included: true },
      { text: 'Stripe payment integration', included: true },
      { text: 'Priority email support', included: true },
    ],
    locked: [
      { text: 'Unlimited technicians', included: false },
      { text: 'Unlimited calls', included: false },
      { text: 'White label AI', included: false },
      { text: 'API access', included: false },
      { text: 'Phone support', included: false },
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    monthly: 1499,
    annual: 14990,
    techLine: 'Unlimited technicians',
    contactSales: true,
    included: [
      { text: 'Unlimited technicians', included: true },
      { text: 'Unlimited AI calls', included: true },
      { text: 'Everything in Growth', included: true },
      { text: 'White label AI receptionist', included: true },
      { text: 'Unlimited service areas', included: true },
      { text: 'API access', included: true },
      { text: 'Custom reporting', included: true },
      { text: 'Dedicated onboarding specialist', included: true },
      { text: 'Phone and priority support', included: true },
      { text: 'Early access to new features', included: true },
    ],
    locked: [],
  },
]

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6V11z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PricingPage() {
  const { user, loading, configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [billing, setBilling] = useState<Billing>('monthly')
  const [subscriptionRequiredBanner, setSubscriptionRequiredBanner] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  useEffect(() => {
    const st = location.state as { subscriptionRequired?: boolean } | undefined
    if (!st?.subscriptionRequired) return
    setSubscriptionRequiredBanner(true)
    navigate('.', { replace: true, state: {} })
  }, [location.state, navigate])

  const persistCheckoutIntent = useCallback((planId: PlanId, b: Billing) => {
    try {
      sessionStorage.setItem('margen_checkout_plan', planId)
      sessionStorage.setItem('margen_checkout_billing', b)
    } catch {
      // ignore
    }
  }, [])

  const onChoosePlan = useCallback(
    async (planId: PlanId) => {
      setCheckoutError(null)
      if (loading || !user) return
      persistCheckoutIntent(planId, billing)
      setCheckoutBusy(true)
      try {
        await redirectToSubscriptionCheckout({
          plan: planId,
          billing,
          ownerId: user.id,
          customerEmail: user.email ?? '',
        })
      } catch (e) {
        setCheckoutError(e instanceof Error ? e.message : 'Checkout could not start')
        setCheckoutBusy(false)
      }
    },
    [billing, loading, persistCheckoutIntent, user],
  )

  const onContactSales = useCallback(() => {
    window.location.href = 'mailto:hello@margen.com?subject=Margen%20Scale%20plan'
  }, [])

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="max-w-md text-center text-sm text-[var(--color-margen-muted)]">
          Add <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> to your{' '}
          <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">.env</code> file, then restart the dev server.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="text-sm text-[var(--color-margen-muted)]">Verifying your session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: '/pricing' }} />
  }

  return (
    <div className="min-h-dvh bg-[var(--color-margen-surface)] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: easePremium }}
          className="mb-10 rounded-2xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3 text-center sm:px-6"
        >
          <p className="text-sm font-medium text-[var(--color-margen-text)] sm:text-base">
            Founding member pricing available — lock in{' '}
            <span className="font-semibold text-[var(--margen-accent)]">50% off forever</span>. Limited spots.
          </p>
        </motion.div>

        <div className="text-center">
          {subscriptionRequiredBanner ? (
            <div className="mx-auto mb-8 max-w-xl rounded-xl px-4 py-3 text-sm alert-warning">
              Choose a Margen plan below to unlock the dashboard. After checkout, you&apos;ll land on your dashboard.
            </div>
          ) : null}
          {checkoutError ? (
            <div className="mx-auto mb-6 max-w-xl rounded-xl px-4 py-3 text-sm alert-error">
              {checkoutError}
            </div>
          ) : null}

          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Margen</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-margen-text)] sm:text-4xl">
            Plans built for field service teams
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--color-margen-muted)] sm:text-base">
            Pick monthly or annual billing. Annual is billed as 10× the monthly rate — two months on us.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--color-margen-muted)]">
            Choose a plan below to continue to secure checkout, or{' '}
            <Link to="/dashboard" className="font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline">
              open your dashboard
            </Link>
            .
          </p>

          <div className="mx-auto mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="inline-flex rounded-full border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-1">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                  billing === 'monthly'
                    ? 'bg-[var(--margen-accent)] text-[var(--margen-accent-fg)]'
                    : 'text-[var(--color-margen-muted)] hover:text-[var(--color-margen-text)]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('annual')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                  billing === 'annual'
                    ? 'bg-[var(--margen-accent)] text-[var(--margen-accent-fg)]'
                    : 'text-[var(--color-margen-muted)] hover:text-[var(--color-margen-text)]'
                }`}
              >
                Annual
              </button>
            </div>
            {billing === 'annual' ? (
              <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold alert-success">
                2 months free
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3 lg:gap-5 lg:pt-2">
          {PLANS.map((plan, i) => {
            const isPopular = Boolean(plan.popular)
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: easePremium, delay: 0.05 * i }}
                whileHover={{ y: -4, transition: { duration: 0.22, ease: easePremium } }}
                className={[
                  'relative flex flex-col rounded-2xl border bg-[var(--color-margen-surface-elevated)] p-6 transition-colors duration-300',
                  isPopular
                    ? 'z-[1] border-[var(--margen-accent)] ring-2 ring-[var(--margen-accent-muted)] lg:-mt-1 lg:scale-[1.03]'
                    : 'border-[var(--color-margen-border)]',
                ].join(' ')}
              >
                {isPopular ? (
                  <span className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--margen-accent)] px-4 py-1 text-xs font-bold uppercase tracking-wide text-[var(--margen-accent-fg)]">
                    Most popular
                  </span>
                ) : null}
                <h2 className="text-xl font-bold text-[var(--color-margen-text)]">{plan.name}</h2>
                <p className="mt-1 text-sm text-[var(--color-margen-muted)]">{plan.techLine}</p>
                <p className="mt-5 flex flex-wrap items-baseline gap-1">
                  <span className="text-4xl font-bold tabular-nums tracking-tight text-[var(--color-margen-text)]">
                    {billing === 'monthly' ? `$${plan.monthly.toLocaleString()}` : `$${plan.annual.toLocaleString()}`}
                  </span>
                  <span className="text-sm text-[var(--color-margen-muted)]">
                    {billing === 'monthly' ? '/month' : '/year'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                  {billing === 'annual' ? 'Billed annually · 10× monthly (2 months free)' : 'Per workspace · billed monthly'}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[...plan.included, ...plan.locked].map((row) => (
                    <li key={row.text} className="flex gap-2.5">
                      {row.included ? (
                        <span className="mt-0.5 shrink-0 text-[#166534]" aria-hidden>
                          <IconCheck className="block" />
                        </span>
                      ) : (
                        <span className="mt-0.5 shrink-0 text-[var(--color-margen-muted)]" aria-hidden>
                          <IconLock className="block opacity-80" />
                        </span>
                      )}
                      <span className={row.included ? 'text-[var(--color-margen-text)]' : 'text-[var(--color-margen-muted)]'}>
                        {row.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.contactSales ? (
                  <motion.button
                    type="button"
                    onClick={onContactSales}
                    disabled={checkoutBusy}
                    className="mt-8 w-full rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] py-3.5 text-sm font-semibold text-[var(--color-margen-text)] transition-colors hover:border-[var(--margen-accent)] hover:bg-[var(--margen-accent-muted)]"
                    whileTap={tapButton}
                  >
                    Contact sales
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    onClick={() => void onChoosePlan(plan.id)}
                    disabled={checkoutBusy}
                    className={[
                      'mt-8 w-full rounded-xl py-3.5 text-sm font-semibold transition-opacity',
                      isPopular
                        ? 'bg-[var(--margen-accent)] text-[var(--margen-accent-fg)] shadow-md hover:opacity-95'
                        : 'border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] text-[var(--color-margen-text)] hover:border-[var(--margen-accent)] hover:bg-[var(--margen-accent-muted)]',
                      checkoutBusy ? 'opacity-50' : '',
                    ].join(' ')}
                    whileTap={checkoutBusy ? undefined : tapButton}
                  >
                    {checkoutBusy ? 'Opening Stripe…' : 'Continue to checkout'}
                  </motion.button>
                )}
              </motion.div>
            )
          })}
        </div>

        <p className="mt-14 text-center text-sm text-[var(--color-margen-muted)]">
          <Link to="/dashboard" className="font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline">
            Dashboard
          </Link>
          {' · '}
          <Link to="/" className="underline-offset-2 hover:text-[var(--margen-accent)] hover:underline">
            Home
          </Link>
        </p>
      </div>
    </div>
  )
}
