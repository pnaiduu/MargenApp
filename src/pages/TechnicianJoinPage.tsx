import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SpaLink } from '../components/SpaLink'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabase'
import { inviteLoginEmail } from '../lib/inviteUrl'
import { easePremium, tapButton } from '../lib/motion'

type LookupOk = {
  found: true
  invited_name: string
  role: string
  company_name: string
}

export function TechnicianJoinPage() {
  const { token: rawToken } = useParams<{ token: string }>()
  const token = rawToken?.trim() ? decodeURIComponent(rawToken.trim()) : ''
  const hasToken = Boolean(token)
  const { user, loading: authLoading, configured, signUp, signOut } = useAuth()

  const [lookupLoading, setLookupLoading] = useState(() => hasToken && configured)
  const [lookup, setLookup] = useState<LookupOk | null>(null)
  const [lookupFailed, setLookupFailed] = useState(!hasToken)

  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')

  useEffect(() => {
    if (!configured || !hasToken) return
    let cancelled = false
    async function run() {
      setLookupLoading(true)
      setLookupFailed(false)
      const { data, error: rpcErr } = await supabase.rpc('lookup_technician_invite', { p_token: token })
      if (cancelled) return
      if (rpcErr) {
        setLookupFailed(true)
        setLookup(null)
      } else {
        const row = data as { found?: boolean; invited_name?: string; role?: string; company_name?: string } | null
        if (row?.found) {
          setLookup({
            found: true,
            invited_name: String(row.invited_name ?? ''),
            role: String(row.role ?? ''),
            company_name: String(row.company_name ?? ''),
          })
          setFullName(String(row.invited_name ?? ''))
        } else {
          setLookupFailed(true)
          setLookup(null)
        }
      }
      setLookupLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [configured, hasToken, token])

  if (!configured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="text-center text-sm text-[var(--color-margen-muted)]">Supabase is not configured.</p>
      </div>
    )
  }

  if (!authLoading && user && !done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="max-w-sm text-center text-sm text-[var(--color-margen-muted)]">
          You&apos;re already signed in. Sign out to accept this technician invite.
        </p>
        <motion.button
          type="button"
          className="mt-6 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)]"
          onClick={() => void signOut()}
          whileTap={tapButton}
        >
          Sign out
        </motion.button>
        <Link to="/" className="mt-4 text-sm text-[var(--margen-accent)] underline-offset-2 hover:underline">
          Back to home
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <motion.div
          className="w-full max-w-sm rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: easePremium }}
        >
          <p className="text-center text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            Margen
          </p>
          <h1 className="mt-2 text-center text-lg font-semibold text-[var(--color-margen-text)]">
            You&apos;re in
          </h1>
          <p className="mt-2 text-center text-sm text-[var(--color-margen-muted)]">
            Use this email to sign in next time (save it somewhere safe):
          </p>
          <p className="mt-3 break-all rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-center font-mono text-xs text-[var(--color-margen-text)]">
            {loginEmail}
          </p>
          <motion.button
            type="button"
            className="mt-4 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] py-2 text-sm font-medium text-[var(--margen-accent)]"
            onClick={() => void navigator.clipboard.writeText(loginEmail)}
            whileTap={tapButton}
          >
            Copy email
          </motion.button>
          <Link
            to="/login"
            state={{ intent: 'sign-in-only' }}
            className="mt-4 block w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-2.5 text-center text-sm font-medium text-[var(--margen-accent-fg)]"
          >
            Go to sign in
          </Link>
        </motion.div>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) return
    const name = fullName.trim()
    if (!name || password.length < 6) {
      setError('Enter your name and a password of at least 6 characters.')
      return
    }
    const email = inviteLoginEmail(token)
    setSubmitting(true)
    const { error: err } = await signUp(email, password, {
      fullName: name,
      technicianInviteToken: token,
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setLoginEmail(email)
    setDone(true)
  }

  if (authLoading || (hasToken && configured && lookupLoading)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-margen-surface)]">
        <p className="text-sm text-[var(--color-margen-muted)]">Loading…</p>
      </div>
    )
  }

  if (!hasToken || lookupFailed || !lookup) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="text-center text-sm text-[var(--color-margen-muted)]">
          This invite link is invalid or has expired.
        </p>
        <Link
          to="/login"
          state={{ intent: 'sign-in-only' }}
          className="mt-6 text-sm font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-margen-surface)]">
      <motion.div
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: easePremium }}
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <MargenLogo aria-hidden className="h-14 w-auto" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Margen</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-margen-text)]">Join your team</h1>
          <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
            {lookup.company_name ? (
              <>
                <span className="text-[var(--color-margen-text)]">{lookup.company_name}</span>
                <span> · {lookup.role}</span>
              </>
            ) : (
              <span>{lookup.role}</span>
            )}
          </p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <label htmlFor="tj-name" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Your name
            </label>
            <input
              id="tj-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
          </div>
          <div>
            <label htmlFor="tj-password" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Password
            </label>
            <input
              id="tj-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />
            <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
              We&apos;ll create a secure Margen login for you — you&apos;ll see your sign-in email after this step.
            </p>
          </div>

          <AnimatePresence mode="popLayout">
            {error ? (
              <motion.p
                key="e"
                className="text-sm text-danger"
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-2.5 text-sm font-medium text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-60"
            whileTap={submitting ? undefined : tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </motion.button>
        </form>

        <p className="mt-8 text-center text-sm text-[var(--color-margen-muted)]">
          <SpaLink to="/login" state={{ intent: 'sign-in-only' }} className="text-[var(--margen-accent)] underline-offset-2 hover:underline">
            Already have an account?
          </SpaLink>
        </p>
      </motion.div>
    </div>
  )
}
