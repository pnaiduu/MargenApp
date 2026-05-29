import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useLayoutEffect, useState } from 'react'
import { easePremium } from '../../lib/motion'
import { supabase } from '../../lib/supabase'

const STEPS = [
  {
    navTarget: '/dashboard',
    description: "Welcome to Margen — here's how to get started.",
  },
  {
    navTarget: '/technicians',
    description: 'Add your first technician — go here and click Add Technician.',
  },
  {
    navTarget: '/jobs',
    description: 'Create your first job — go here and click New Job.',
  },
  {
    navTarget: '/payments',
    description: 'Connect Stripe to collect payments when jobs are done.',
  },
  {
    navTarget: '/dashboard',
    description: "You're ready — explore your workspace.",
  },
] as const

type Anchor = {
  top: number
  left: number
}

type Props = {
  open: boolean
  onDone: () => void
}

export function OnboardingTutorial({ open, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const measure = useCallback(() => {
    if (!open) return
    const target = STEPS[step]?.navTarget
    if (!target) return
    const el = document.querySelector(`[data-onboarding-nav="${target}"]`)
    if (!el) return
    const rect = el.getBoundingClientRect()
    setAnchor({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    })
  }, [open, step])

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const sidebar = document.getElementById('app-sidebar')
    const ro = sidebar ? new ResizeObserver(measure) : null
    if (sidebar) ro?.observe(sidebar)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      ro?.disconnect()
    }
  }, [open, measure])

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

  if (!open || !anchor) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        role="dialog"
        aria-labelledby="onboarding-desc"
        aria-live="polite"
        className="onboarding-bubble pointer-events-auto fixed z-[60] w-[220px]"
        style={{ top: anchor.top, left: anchor.left, transform: 'translateY(-50%)' }}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        transition={{ duration: 0.22, ease: easePremium }}
      >
        <p className="text-[11px] font-medium text-[#888888]">
          {step + 1} of {STEPS.length}
        </p>
        <p id="onboarding-desc" className="mt-1 text-[13px] leading-snug text-[#111111]">
          {current.description}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void skip()}
            className="text-[12px] font-medium text-[#888888] hover:text-[#111111]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void next()}
            className="rounded-md bg-[#111111] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#333333]"
          >
            {step >= STEPS.length - 1 ? "Let's go" : 'Next'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
