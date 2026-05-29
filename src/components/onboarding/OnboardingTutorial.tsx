import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { easePremium } from '../../lib/motion'
import { supabase } from '../../lib/supabase'

const STEPS = [
  {
    title: 'Welcome to Margen',
    body: "Here's how to get started — set up your team, jobs, and payments in a few minutes.",
  },
  {
    title: 'Add your first technician',
    body: 'Go to Technicians and click Add Technician to invite someone to your crew.',
    link: { to: '/technicians', label: 'Open Technicians' },
  },
  {
    title: 'Create your first job',
    body: 'Go to Jobs and click New Job to schedule work for a customer.',
    link: { to: '/jobs', label: 'Open Jobs' },
  },
  {
    title: 'Connect Stripe to collect payments',
    body: 'Go to Payments to connect Stripe and send invoices when jobs are done.',
    link: { to: '/payments', label: 'Open Payments' },
  },
  {
    title: "You're ready",
    body: "Your workspace is set up. Explore the dashboard and we'll stay out of your way.",
  },
] as const

type Props = {
  open: boolean
  onDone: () => void
}

export function OnboardingTutorial({ open, onDone }: Props) {
  const [step, setStep] = useState(0)

  async function finish() {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (uid) {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        } as never)
        .eq('id', uid)
    }
    onDone()
  }

  async function skip() {
    await finish()
  }

  async function next() {
    if (step >= STEPS.length - 1) {
      await finish()
      return
    }
    setStep((s) => s + 1)
  }

  const current = STEPS[step]

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-6 shadow-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: easePremium }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 id="onboarding-title" className="mt-2 text-xl font-semibold text-[var(--color-margen-text)]">
              {current.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-margen-text-secondary)]">{current.body}</p>
            {'link' in current && current.link ? (
              <Link
                to={current.link.to}
                className="mt-4 inline-flex text-sm font-semibold text-[var(--margen-accent)] hover:underline"
              >
                {current.link.label} →
              </Link>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void skip()}
                className="text-sm font-medium text-[var(--color-margen-muted)] hover:text-[var(--color-margen-text)]"
              >
                Skip tutorial
              </button>
              <button
                type="button"
                onClick={() => void next()}
                className="rounded-lg bg-[var(--margen-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)]"
              >
                {step >= STEPS.length - 1 ? "Let's go" : 'Next'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
