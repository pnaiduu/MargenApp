import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { transitionShell } from '../../lib/motion'

export function AppShell() {
  const location = useLocation()
  const shellKey =
    location.pathname === '/login' ||
    location.pathname === '/signup' ||
    location.pathname === '/pricing' ||
    location.pathname === '/'
      ? 'auth'
      : 'app'

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={shellKey}
        className="min-h-dvh"
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transitionShell}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
