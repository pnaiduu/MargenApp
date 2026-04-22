import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'
import { formatUsDisplay } from '../lib/forwardingDialCode'
import {
  PLACEHOLDER_MARGEN_PHONE_SID,
  placeholderMargenE164ForOwner,
} from '../lib/margenTwilio'
import { supabase } from '../lib/supabase'

type Step = 1 | 2 | 3

const slide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
}

function WizardProgress({ step }: { step: Step }) {
  const pct = (step / 3) * 100
  return (
    <div className="w-full shrink-0 px-5 pt-6 sm:px-8">
      <p className="text-center text-lg font-medium text-[var(--color-margen-muted)]">Step {step} of 3</p>
      <div className="mx-auto mt-3 h-3 max-w-lg overflow-hidden rounded-full bg-[#ebebeb]">
        <motion.div
          className="h-full rounded-full bg-[var(--margen-accent)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: easePremium }}
        />
      </div>
    </div>
  )
}

export function OnboardingCallSetup() {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [margenE164, setMargenE164] = useState<string | null>(null)
  const [displayNumber, setDisplayNumber] = useState<string>('')
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisionBusy, setProvisionBusy] = useState(false)
  const provisionStarted = useRef(false)

  const [copyError, setCopyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const runPlaceholderSetup = useCallback(async () => {
    if (!user) return
    setProvisionBusy(true)
    setProvisionError(null)
    try {
      const { data: existing, error: readErr } = await supabase
        .from('profiles')
        .select('margen_phone_number, margen_phone_sid')
        .eq('id', user.id)
        .maybeSingle()
      if (readErr) throw new Error(readErr.message)

      const row = existing as { margen_phone_number?: string | null } | null
      const num = row?.margen_phone_number?.trim()
      if (num) {
        setMargenE164(num)
        setDisplayNumber(formatUsDisplay(num))
        setStep(2)
        return
      }

      const e164 = placeholderMargenE164ForOwner(user.id)
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          margen_phone_number: e164,
          margen_phone_sid: PLACEHOLDER_MARGEN_PHONE_SID,
        } as never)
        .eq('id', user.id)
      if (upErr) throw new Error(upErr.message)

      setMargenE164(e164)
      setDisplayNumber(formatUsDisplay(e164))
      setStep(2)
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setProvisionBusy(false)
    }
  }, [user])

  useEffect(() => {
    if (!user || provisionStarted.current) return
    provisionStarted.current = true
    void runPlaceholderSetup()
  }, [user, runPlaceholderSetup])

  const margenPhone = (margenE164 ?? '').trim()
  const displayPhone = displayNumber

  const btnAccent =
    'margen-btn-accent inline-flex w-full items-center justify-center disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#fafaf8]">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            className="flex min-h-dvh flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: easePremium }}
          >
            <WizardProgress step={1} />
            <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-4 sm:px-10">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute h-40 w-40 rounded-full border-2 border-[#ebebeb]"
                  animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.75, 0.4] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative">
                  <MargenLogo className="h-24 w-auto" title="Margen" />
                </div>
              </div>
              <motion.h1
                className="mt-10 max-w-xl text-center text-[32px] font-semibold leading-tight tracking-tight text-[#111111]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.35, ease: easePremium }}
              >
                Let’s get your calls answered for you
              </motion.h1>
              <p className="mt-4 max-w-xl text-center text-[18px] leading-relaxed text-[var(--color-margen-text-secondary)]">
                We’re saving a friendly number to your account. This only takes a moment.
              </p>
              {provisionBusy ? (
                <div className="mt-12 w-full max-w-md space-y-4">
                  <div className="h-3 overflow-hidden rounded-full bg-[#ebebeb]">
                    <motion.div
                      className="h-full rounded-full bg-[var(--margen-accent)]"
                      initial={{ width: '8%' }}
                      animate={{ width: ['8%', '92%', '40%', '100%'] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-center text-[18px] text-[var(--color-margen-muted)]">Almost there…</p>
                </div>
              ) : null}
              {provisionError ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-10 w-full max-w-lg rounded-xl border border-[#ebebeb] bg-white px-5 py-5 text-center"
                >
                  <p className="text-[18px] leading-relaxed text-danger">{provisionError}</p>
                  <button type="button" onClick={() => void runPlaceholderSetup()} className={`${btnAccent} mt-6`}>
                    Try again
                  </button>
                </motion.div>
              ) : null}
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="s2"
            className="flex min-h-dvh flex-col"
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.36, ease: easePremium }}
          >
            <WizardProgress step={2} />
            <div className="flex flex-1 flex-col items-center px-5 pb-16 pt-6 sm:px-8">
              <motion.div
                layout
                className="w-full max-w-lg rounded-xl border border-[#ebebeb] bg-white p-8 sm:p-10"
              >
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--margen-accent)_10%,transparent)] text-[var(--margen-accent)]"
                >
                  <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="mt-8 text-center text-[32px] font-semibold leading-tight text-[#111111]">
                  Here’s your new number
                </h2>
                <p className="mt-4 text-center text-[18px] leading-relaxed text-[var(--color-margen-text-secondary)]">
                  When you can’t pick up, this number can greet your caller for you and help book the visit.
                </p>
                <p className="mt-10 text-center font-mono text-3xl font-bold tracking-tight text-[#111111] sm:text-4xl">
                  {displayNumber}
                </p>
                <button type="button" onClick={() => setStep(3)} className={`${btnAccent} mt-12`}>
                  Continue
                </button>
              </motion.div>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div
            key="s3"
            className="flex min-h-dvh flex-col"
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.36, ease: easePremium }}
          >
            <WizardProgress step={3} />
            <div className="mx-auto w-full max-w-lg flex-1 px-5 pb-12 pt-6 sm:px-8">
              <div className="rounded-xl border border-[#ebebeb] bg-white p-6 sm:p-8">
                <div className="flex flex-col items-center gap-6 text-center">
                  <h2 style={{ fontSize: 32, fontWeight: 600, color: '#111111' }}>You&apos;re all set</h2>
                  <p style={{ fontSize: 18, color: '#555555' }}>Your AI receptionist is ready to answer calls</p>
                  <p style={{ fontSize: 36, fontWeight: 700, fontFamily: 'monospace', color: '#111111' }}>
                    {displayPhone}
                  </p>
                  <p style={{ fontSize: 15, color: '#555555', maxWidth: 400 }}>
                    Share this as your business phone number. Every call goes straight to your AI receptionist — 24
                    hours a day.
                  </p>
                  <div className="flex w-full flex-col gap-3">
                    <button
                      type="button"
                      className="margen-btn-accent inline-flex w-full items-center justify-center disabled:opacity-60"
                      style={{ minHeight: 56 }}
                      disabled={!margenPhone}
                      onClick={() => {
                        setCopyError(null)
                        void navigator.clipboard.writeText(margenPhone).then(
                          () => {
                            setCopied(true)
                            window.setTimeout(() => setCopied(false), 2000)
                          },
                          () => setCopyError('Copy did not work. Try highlighting the number instead.'),
                        )
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy number'}
                    </button>
                    <button
                      type="button"
                      className="margen-btn-accent inline-flex w-full items-center justify-center"
                      style={{ minHeight: 56 }}
                      onClick={() => {
                        window.location.href = '/dashboard'
                      }}
                    >
                      Go to my dashboard
                    </button>
                  </div>
                </div>
              </div>

              {copyError ? (
                <p className="mt-4 text-center text-sm text-danger" role="alert">
                  {copyError}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
