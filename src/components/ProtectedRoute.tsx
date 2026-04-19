import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'

function FadeIn({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex min-h-dvh items-center justify-center bg-[var(--color-margen-surface)] px-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.27, ease: easePremium }}
    >
      {children}
    </motion.div>
  )
}

export function ProtectedRoute() {
  const { user, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <FadeIn>
        <p className="max-w-md text-center text-sm text-[var(--color-margen-muted)]">
          Add <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> to your{' '}
          <code className="rounded border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-1 py-0.5 text-xs">.env</code> file, then restart the dev server.
        </p>
      </FadeIn>
    )
  }

  if (loading) {
    return (
      <FadeIn>
        <motion.p
          className="text-sm text-[var(--color-margen-muted)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.25, ease: easePremium }}
        >
          Loading…
        </motion.p>
      </FadeIn>
    )
  }

  if (!user) {
    const from = `${location.pathname}${location.search || ''}`
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <Outlet />
}
