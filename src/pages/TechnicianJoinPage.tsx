import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useAuth } from '../contexts/useAuth'
import { supabase } from '../lib/supabase'
import { inviteAppDeepLink, inviteJoinAbsoluteUrl } from '../lib/inviteUrl'
import { easePremium, tapButton } from '../lib/motion'

type LookupOk = {
  invited_name: string
  role: string
  company_name: string
}

function tryOpenMargenApp(deepLink: string) {
  if (typeof window === 'undefined') return
  const hidden = document.createElement('a')
  hidden.href = deepLink
  hidden.style.display = 'none'
  document.body.appendChild(hidden)
  hidden.click()
  document.body.removeChild(hidden)
  window.setTimeout(() => {
    window.location.href = deepLink
  }, 80)
}

export function TechnicianJoinPage() {
  const { token: rawToken } = useParams<{ token: string }>()
  const token = rawToken?.trim() ? decodeURIComponent(rawToken.trim()) : ''
  const hasToken = Boolean(token)
  const { user, loading: authLoading, configured, signOut } = useAuth()

  const [lookupLoading, setLookupLoading] = useState(() => hasToken && configured)
  const [lookup, setLookup] = useState<LookupOk | null>(null)
  const [lookupFailed, setLookupFailed] = useState(!hasToken)
  const [triedApp, setTriedApp] = useState(false)

  const webUrl = hasToken ? inviteJoinAbsoluteUrl(token) : ''
  const appLink = hasToken ? inviteAppDeepLink(token) : ''

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
            invited_name: String(row.invited_name ?? ''),
            role: String(row.role ?? ''),
            company_name: String(row.company_name ?? ''),
          })
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

  useEffect(() => {
    if (!hasToken || lookupLoading || lookupFailed || !lookup || triedApp) return
    setTriedApp(true)
    tryOpenMargenApp(appLink)
  }, [appLink, hasToken, lookup, lookupFailed, lookupLoading, triedApp])

  if (!configured) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="text-center text-sm text-[var(--color-margen-muted)]">Supabase is not configured.</p>
      </div>
    )
  }

  if (!authLoading && user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--color-margen-surface)] px-4">
        <p className="max-w-sm text-center text-sm text-[var(--color-margen-muted)]">
          You&apos;re already signed in. Sign out to accept this technician invite in the Margen app.
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
          {lookup.company_name ? (
            <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
              <span className="font-medium text-[var(--color-margen-text)]">{lookup.company_name}</span>
              <span> · {lookup.role}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-margen-muted)]">{lookup.role}</p>
          )}
        </div>

        <h1 className="text-center text-2xl font-semibold text-[var(--color-margen-text)]">
          Download the Margen app to join your team
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[var(--color-margen-muted)]">
          {lookup.invited_name ? (
            <>
              Hi {lookup.invited_name} — open this invite in the Margen technician app to create your account and
              connect to your employer.
            </>
          ) : (
            <>Open this invite in the Margen technician app to create your account and connect to your employer.</>
          )}
        </p>

        <motion.a
          href={appLink}
          className="mt-8 block w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-3 text-center text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90"
          whileTap={tapButton}
          onClick={(e) => {
            e.preventDefault()
            tryOpenMargenApp(appLink)
          }}
        >
          Open in Margen app
        </motion.a>

        <p className="mt-6 text-center text-xs text-[var(--color-margen-muted)]">
          If the app doesn&apos;t open, install Margen from the App Store or Google Play, then tap the button again or
          paste your invite link when creating an account.
        </p>

        {webUrl ? (
          <p className="mt-4 break-all text-center font-mono text-[10px] text-[var(--color-margen-muted)]">{webUrl}</p>
        ) : null}

        <p className="mt-8 text-center text-sm text-[var(--color-margen-muted)]">
          <Link to="/login" state={{ intent: 'sign-in-only' }} className="text-[var(--margen-accent)] underline-offset-2 hover:underline">
            Owner sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
