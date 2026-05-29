import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { useWorkspaceAccess } from '../../contexts/workspace-access-context'
import { isPathBlockedForPlan } from '../../lib/subscriptionAccess'
import { easePremium, staggerContainer, staggerItem } from '../../lib/motion'
import { supabase } from '../../lib/supabase'
import { MargenLogo } from '../branding/MargenLogo'

const nav: { to: string; label: string; end?: boolean }[] = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/jobs', label: 'Jobs' },
  { to: '/customers', label: 'Customers' },
  { to: '/technicians', label: 'Technicians' },
  { to: '/hours', label: 'Hours & Attendance' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/revenue', label: 'Revenue' },
  { to: '/payments', label: 'Payments' },
  { to: '/settings', label: 'Settings' },
]

export function Sidebar({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  const { user, signOut } = useAuth()
  const { effectiveSubscription, isDevBypass } = useWorkspaceAccess()
  const plan = effectiveSubscription?.plan ?? null
  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('profiles').select('company_name').eq('id', user.id).maybeSingle()
      if (!cancelled) setCompanyName((data as { company_name?: string | null } | null)?.company_name ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <aside className="flex h-dvh w-full flex-col border-r border-[var(--color-margen-border)] bg-[var(--color-margen-sidebar)]">
      <div className="border-b border-[var(--color-margen-border)] px-5 pb-4 pt-5">
        <MargenLogo className="h-11 w-auto" title="Margen" />
        <p className="mt-2 truncate text-[13px] leading-snug text-[var(--color-margen-muted)]">
          {(companyName ?? '').trim() || 'Your workspace'}
        </p>
      </div>

      <motion.nav
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
        aria-label="Main"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {nav.map(({ to, label, end }) => {
          const blocked = isPathBlockedForPlan(to, plan, isDevBypass)
          const title = blocked
            ? `${label} requires Growth plan or higher — upgrade under Settings → Margen subscription.`
            : undefined
          return (
            <motion.div key={to} variants={staggerItem}>
              <NavLink
                to={to}
                end={end}
                data-onboarding-nav={to}
                title={title}
                aria-disabled={blocked}
                onClick={(e) => {
                  if (blocked) {
                    e.preventDefault()
                    return
                  }
                  onNavigate?.()
                }}
                className={({ isActive }) =>
                  [
                    'block rounded-md border-l-[3px] border-transparent py-2.5 pl-3 pr-3 text-sm font-medium transition-colors duration-200',
                    blocked
                      ? 'cursor-not-allowed text-[var(--color-margen-muted)] opacity-50'
                      : isActive
                        ? 'sidebar-nav-active'
                        : 'text-[var(--color-margen-text-secondary)] hover:bg-[var(--color-margen-hover)]',
                  ].join(' ')
                }
              >
                {label}
              </NavLink>
            </motion.div>
          )
        })}
      </motion.nav>

      <div className="mt-auto border-t border-[var(--color-margen-border)] px-4 py-4">
        <p className="truncate text-xs leading-snug text-[var(--color-margen-muted)]">{user?.email ?? ''}</p>
        <motion.button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] py-2 text-sm font-medium text-[var(--color-margen-text)] transition-colors duration-200 hover:bg-[var(--color-margen-hover)]"
          whileTap={{ scale: 0.99 }}
          transition={{ duration: 0.14, ease: easePremium }}
        >
          Sign out
        </motion.button>
      </div>
    </aside>
  )
}
