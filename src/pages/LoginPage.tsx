import { motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/useAuth'
import { easePremium, tapButton } from '../lib/motion'
import { safeReturnPath } from '../lib/safeReturnPath'

function formatSubmitError(caught: unknown): string {
  const name =
    typeof caught === 'object' && caught !== null && 'name' in caught
      ? String((caught as { name: string }).name)
      : caught instanceof Error
        ? caught.name
        : ''
  if (name === 'AbortError') {
    return 'The request was cancelled or interrupted. Check your connection and try again.'
  }
  if (caught instanceof Error && caught.message) return caught.message
  if (typeof caught === 'string' && caught) return caught
  return 'Something went wrong. Please try again.'
}

function readCheckoutPlanFromStorage() {
  try {
    return sessionStorage.getItem('margen_checkout_plan')
  } catch {
    return null
  }
}

function planIdFromSubscribeReturn(from: string | undefined): string | null {
  if (!from?.startsWith('/subscribe')) return null
  const q = from.indexOf('?')
  if (q === -1) return null
  try {
    const plan = new URLSearchParams(from.slice(q + 1)).get('plan')
    return plan === 'starter' || plan === 'growth' || plan === 'scale' ? plan : null
  } catch {
    return null
  }
}

export function LoginPage() {
  const { user, loading, configured, signIn } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const routeIntent = (location.state as { intent?: string } | undefined)?.intent
  const returnFrom = (location.state as { from?: string } | undefined)?.from

  useEffect(() => {
    if (routeIntent !== 'sign-in-only') return
    try {
      sessionStorage.removeItem('margen_checkout_plan')
      sessionStorage.removeItem('margen_checkout_billing')
    } catch {
      /* ignore */
    }
    // Do not call navigate() here — replacing the same route can blank the screen with RR7 + motion shell.
  }, [routeIntent])

  const checkoutPlan =
    routeIntent === 'sign-in-only'
      ? null
      : searchParams.get('plan') ?? readCheckoutPlanFromStorage() ?? planIdFromSubscribeReturn(returnFrom)
  const planHint =
    checkoutPlan === 'starter' || checkoutPlan === 'growth' || checkoutPlan === 'scale' ? checkoutPlan : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [policiesOpen, setPoliciesOpen] = useState(false)

  if (!configured) {
    return (
      <motion.div
        className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: easePremium }}
      >
        <p className="max-w-md text-center text-sm text-[var(--color-margen-muted)]">
          Copy <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">.env.example</code> to{' '}
          <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">.env</code> and set your Supabase URL and anon key.
        </p>
      </motion.div>
    )
  }

  if (!loading && user) {
    return <Navigate to={safeReturnPath(location.state)} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: err } = await signIn(email, password)
      if (err) setError(err.message)
    } catch (caught) {
      setError(formatSubmitError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-margen-surface)]">
      <Modal open={policiesOpen} onClose={() => setPoliciesOpen(false)} title="Data & privacy">
        <p className="text-sm leading-relaxed text-[var(--color-margen-muted)]">
          Margen processes operational data you store in your workspace to run scheduling, dispatch, and reporting. Use
          this environment in line with your company&apos;s policies and applicable law. Contact your administrator for
          retention and access rules.
        </p>
        <motion.button
          type="button"
          className="mt-6 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] py-2.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
          onClick={() => setPoliciesOpen(false)}
          whileTap={tapButton}
          transition={{ duration: 0.14, ease: easePremium }}
        >
          Close
        </motion.button>
      </Modal>

      <motion.div
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: easePremium, delay: 0.04 }}
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Margen</p>
          <h1 className="mt-1 text-center text-2xl font-semibold text-[var(--color-margen-text)]">Sign in</h1>
          <p className="mt-2 text-sm text-[var(--color-margen-muted)]">AI-powered operations for home service teams.</p>
          {(returnFrom === '/pricing' || (typeof returnFrom === 'string' && returnFrom.startsWith('/pricing?'))) &&
          routeIntent !== 'sign-in-only' ? (
            <p className="mt-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-xs text-[var(--color-margen-muted)]">
              After you sign in, you&apos;ll go to the plans page to pick a tier and complete checkout.
            </p>
          ) : null}
          {planHint ? (
            <p className="mt-3 rounded-lg border border-[var(--margen-accent-muted)] bg-[var(--margen-accent-muted)] px-3 py-2 text-xs text-[var(--margen-accent)]">
              You&apos;re subscribing to the <span className="font-semibold capitalize">{planHint}</span> plan. Sign in,
              then you&apos;ll continue to secure checkout.
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <motion.button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-2.5 text-sm font-medium text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-60"
            whileTap={submitting ? undefined : tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            {submitting ? 'Please wait…' : 'Sign in'}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-xs text-[var(--color-margen-muted)]">
          By continuing you agree to your organization&apos;s{' '}
          <button
            type="button"
            className="font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline"
            onClick={() => setPoliciesOpen(true)}
          >
            data policies
          </button>
          .
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm">
          <Link to="/signup" className="text-[var(--margen-accent)] underline-offset-2 hover:underline">
            Create an account
          </Link>
          <span className="text-[var(--color-margen-border)]">·</span>
          <Link to="/pricing" className="text-[var(--color-margen-muted)] underline-offset-2 hover:text-[var(--margen-accent)] hover:underline">
            Plans
          </Link>
          <span className="text-[var(--color-margen-border)]">·</span>
          <Link to="/" className="text-[var(--color-margen-muted)] underline-offset-2 hover:text-[var(--margen-accent)] hover:underline">
            Home
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
