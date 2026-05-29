import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { useMediaMdUp } from '../../hooks/useMediaMdUp'
import { easePremium, pageVariants, tapButton, transitionOverlay } from '../../lib/motion'
import { Sidebar } from './Sidebar'
import { NotificationsBell } from '../notifications/NotificationsBell'
import { PageErrorBoundary } from '../PageErrorBoundary'
import { OnboardingTutorial } from '../onboarding/OnboardingTutorial'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/useAuth'

export function DashboardLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const isMd = useMediaMdUp()

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const row = data as { onboarding_completed?: boolean; onboarding_completed_at?: string | null } | null
      const done = row?.onboarding_completed === true || Boolean(row?.onboarding_completed_at)
      if (!done) setTutorialOpen(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="flex min-h-dvh bg-[var(--color-margen-surface)]">
      <OnboardingTutorial open={tutorialOpen} onDone={() => setTutorialOpen(false)} />
      <AnimatePresence mode="wait">
        {!isMd && mobileOpen ? (
          <motion.button
            key="nav-backdrop"
            type="button"
            className="fixed inset-0 z-40 bg-black/15 md:hidden"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionOverlay}
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        id="app-sidebar"
        className="fixed inset-y-0 left-0 z-50 w-56 shrink-0"
        initial={false}
        animate={{ x: isMd ? 0 : mobileOpen ? 0 : -224 }}
        transition={{ duration: 0.2, ease: easePremium }}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </motion.div>

      <div className="flex min-w-0 flex-1 flex-col md:ml-56">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3 md:justify-end md:px-6">
          <motion.button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-margen-border)] text-[var(--color-margen-text)] transition-colors hover:bg-[var(--color-margen-hover)] md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            whileTap={tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
          <div className="flex flex-1 justify-end md:flex-none">
            <NotificationsBell />
          </div>
        </header>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-6 md:px-8 md:py-8">
          <div className="relative flex min-h-0 min-h-[50vh] flex-1 flex-col">
            <PageErrorBoundary key={location.pathname}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location.pathname}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
