import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { easePremium } from '../../lib/motion'
import { disconnectStripeAnalytics, saveStripeAnalyticsSecretKey, syncStripeAnalyticsLedger } from '../../lib/stripeAnalytics'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  hasExistingKey: boolean
}

export function StripeAnalyticsSetupModal({ open, onClose, onSaved, hasExistingKey }: Props) {
  const [secretDraft, setSecretDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSecretDraft('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const onDisconnect = useCallback(async () => {
    if (!window.confirm('Remove the saved Stripe key and delete synced ledger rows from Margen?')) return
    setBusy(true)
    setError(null)
    try {
      await disconnectStripeAnalytics()
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed')
    } finally {
      setBusy(false)
    }
  }, [onClose, onSaved])

  const onSave = useCallback(async () => {
    const k = secretDraft.trim()
    if (!k) {
      setError('Paste your Stripe secret key (sk_…) or restricted key (rk_…) first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveStripeAnalyticsSecretKey(k)
      await syncStripeAnalyticsLedger(120)
      setSecretDraft('')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save or sync')
    } finally {
      setBusy(false)
    }
  }, [secretDraft, onClose, onSaved])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: easePremium }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-analytics-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-5 shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: easePremium }}
          >
            <h2 id="stripe-analytics-title" className="text-lg font-semibold text-[var(--color-margen-text)]">
              {hasExistingKey ? 'Change Stripe API key' : 'Add Stripe API key'}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
              This is for <strong className="text-[var(--color-margen-text)]">your business Stripe account</strong> so Margen
              can read <strong className="text-[var(--color-margen-text)]">Balance Transactions</strong> and show charts. It
              does <strong className="text-[var(--color-margen-text)]">not</strong> charge your Margen subscription (that
              uses Checkout / Manage billing separately).
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[var(--color-margen-muted)]">
              <li>Log in to Stripe as <em>your company</em> (the same account where your customer payments live).</li>
              <li>
                Go to <strong className="text-[var(--color-margen-text)]">Developers</strong> →{' '}
                <strong className="text-[var(--color-margen-text)]">API keys</strong>.
              </li>
              <li>
                Either reveal the <strong className="text-[var(--color-margen-text)]">Secret key</strong> (
                <code className="rounded bg-[var(--color-margen-surface)] px-1 py-0.5 text-xs">sk_live_…</code> /{' '}
                <code className="rounded bg-[var(--color-margen-surface)] px-1 py-0.5 text-xs">sk_test_…</code>) or create a{' '}
                <strong className="text-[var(--color-margen-text)]">Restricted key</strong> (
                <code className="rounded bg-[var(--color-margen-surface)] px-1 py-0.5 text-xs">rk_…</code>) that can{' '}
                <strong className="text-[var(--color-margen-text)]">list Balance Transactions</strong>.
              </li>
              <li>Paste it below. Margen stores it encrypted and only uses it for sync jobs you trigger.</li>
            </ol>
            <p className="mt-3 rounded-md px-2.5 py-2 text-xs alert-warning">
              Prefer a read-only restricted key. Anyone with the key can do whatever that key allows in Stripe — never use
              Margen&apos;s keys or another company&apos;s keys here.
            </p>

            <label htmlFor="stripe-analytics-secret" className="mt-4 block text-xs font-medium text-[var(--color-margen-text)]">
              Secret or restricted key
            </label>
            <textarea
              id="stripe-analytics-secret"
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              rows={3}
              placeholder="sk_test_… or rk_test_…"
              className="mt-1 w-full resize-y rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            />

            {error ? (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="rounded-md bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
              >
                {busy ? 'Saving…' : hasExistingKey ? 'Change API key & sync' : 'Save & sync now'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => !busy && onClose()}
                className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] disabled:opacity-60"
              >
                Cancel
              </button>
              {hasExistingKey ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDisconnect()}
                  className="ml-auto rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-2 text-sm font-medium text-danger hover:bg-[var(--color-margen-hover)]"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
