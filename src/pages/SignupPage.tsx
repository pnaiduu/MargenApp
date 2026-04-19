import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { SpaLink } from '../components/SpaLink'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../contexts/useAuth'
import { easePremium, tapButton } from '../lib/motion'
import { supabase } from '../lib/supabase'

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

export function SignupPage() {
  const { user, loading, configured, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const checkoutPlan = searchParams.get('plan')
  const planHint =
    checkoutPlan === 'starter' || checkoutPlan === 'growth' || checkoutPlan === 'scale' ? checkoutPlan : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
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
    if (planHint) {
      return <Navigate to={`/subscribe?plan=${planHint}`} replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      const { error: err } = await signUp(email, password, {
        fullName,
        companyName,
      })
      if (err) {
        setError(err.message)
      } else {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          navigate(planHint ? `/subscribe?plan=${planHint}` : '/pricing', { replace: true })
          return
        }
        setMessage(
          planHint
            ? 'Check your email to confirm your account, then sign in. After sign-in you can open the plans page and finish checkout.'
            : 'Check your email to confirm your account, then sign in. The plans page opens after sign-in so you can subscribe.',
        )
      }
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: easePremium, delay: 0.04 }}
      >
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Margen</p>
          <h1 className="mt-1 text-center text-2xl font-semibold text-[var(--color-margen-text)]">Create account</h1>
          <p className="mt-2 text-sm text-[var(--color-margen-muted)]">AI-powered operations for home service teams.</p>
          {planHint ? (
            <p className="mt-3 rounded-lg border border-[var(--margen-accent-muted)] bg-[var(--margen-accent-muted)] px-3 py-2 text-xs text-[var(--margen-accent)]">
              You indicated the <span className="font-semibold capitalize">{planHint}</span> plan. After your account is
              active, sign in and open the plans page to confirm billing and checkout.
            </p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-fullName" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Full name
            </label>
            <input
              id="signup-fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>
          <div>
            <label htmlFor="signup-company" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Company <span className="font-normal text-[var(--color-margen-muted)]">(optional)</span>
            </label>
            <input
              id="signup-company"
              type="text"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>

          <div className="relative min-h-[2.75rem]">
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            {message && !error ? (
              <p className="text-sm text-[var(--color-margen-muted)]" role="status">
                {message}{' '}
                <Link to="/pricing" className="font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline">
                  Go to pricing
                </Link>
              </p>
            ) : null}
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-2.5 text-sm font-medium text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-60"
            whileTap={submitting ? undefined : tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            {submitting ? 'Please wait…' : 'Create account'}
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
          <SpaLink
            to="/login"
            state={planHint ? { from: `/subscribe?plan=${planHint}` } : { intent: 'sign-in-only' }}
            className="text-[var(--margen-accent)] underline-offset-2 hover:underline"
          >
            Already have an account? Sign in
          </SpaLink>
          <span className="text-[var(--color-margen-border)]">·</span>
          <Link to="/" className="text-[var(--color-margen-muted)] underline-offset-2 hover:text-[var(--margen-accent)] hover:underline">
            Home
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
