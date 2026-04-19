import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'
import {
  CARRIER_OPTIONS,
  type CarrierId,
  forwardingActivationSnippet,
  forwardingStepsHtml,
  formatUsDisplay,
  guessAreaCodeForProvisioning,
} from '../lib/forwardingDialCode'
import { provisionMargenTwilioNumber, sendMargenForwardingSms } from '../lib/margenTwilio'
import { supabase } from '../lib/supabase'

type Step = 1 | 2 | 3

const slide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -22 },
}

export function OnboardingCallSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [margenE164, setMargenE164] = useState<string | null>(null)
  const [displayNumber, setDisplayNumber] = useState<string>('')
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisionBusy, setProvisionBusy] = useState(false)
  const provisionStarted = useRef(false)

  const [carrier, setCarrier] = useState<CarrierId | null>(null)
  const [smsBusy, setSmsBusy] = useState(false)
  const [smsNote, setSmsNote] = useState<string | null>(null)
  const [smsError, setSmsError] = useState<string | null>(null)
  const [finishBusy, setFinishBusy] = useState(false)

  const runProvision = useCallback(async () => {
    if (!user) return
    setProvisionBusy(true)
    setProvisionError(null)
    try {
      const { data: prof, error: pe } = await supabase
        .from('profiles')
        .select('business_address, business_phone, margen_phone_number')
        .eq('id', user.id)
        .maybeSingle()
      if (pe) throw new Error(pe.message)
      const ac = guessAreaCodeForProvisioning(
        (prof as { business_address?: string | null })?.business_address ?? null,
        (prof as { business_phone?: string | null })?.business_phone ?? null,
      )
      const { data, error } = await provisionMargenTwilioNumber(supabase, { area_code: ac })
      if (error) throw error
      const num = data?.phone_number ?? (prof as { margen_phone_number?: string | null })?.margen_phone_number
      if (!num) throw new Error('No phone number was returned. Please try again.')
      setMargenE164(num)
      setDisplayNumber(data?.formatted ?? formatUsDisplay(num))
      setStep(2)
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : 'Something went wrong setting up your line.')
    } finally {
      setProvisionBusy(false)
    }
  }, [user])

  useEffect(() => {
    if (!user || provisionStarted.current) return
    provisionStarted.current = true
    void runProvision()
  }, [user, runProvision])

  const persistCarrierAndCode = useCallback(
    async (c: CarrierId) => {
      if (!user || !margenE164) return
      const code = forwardingActivationSnippet(c, margenE164)
      const { error } = await supabase
        .from('profiles')
        .update({
          carrier: c,
          twilio_forwarding_code: code,
        } as never)
        .eq('id', user.id)
      if (error) setSmsError(error.message)
    },
    [user, margenE164],
  )

  const onPickCarrier = (c: CarrierId) => {
    setCarrier(c)
    setSmsError(null)
    setSmsNote(null)
    void persistCarrierAndCode(c)
  }

  const onSendSms = async () => {
    setSmsBusy(true)
    setSmsError(null)
    setSmsNote(null)
    const { error } = await sendMargenForwardingSms(supabase)
    setSmsBusy(false)
    if (error) {
      setSmsError(error.message)
      return
    }
    setSmsNote('Sent! Check your texts on your business phone.')
  }

  const onFinishSetup = async () => {
    if (!user) return
    setFinishBusy(true)
    const { error } = await supabase.from('profiles').update({ call_forwarding_active: true } as never).eq('id', user.id)
    setFinishBusy(false)
    if (error) {
      setSmsError(error.message)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  const onSkip = () => {
    navigate('/dashboard', { replace: true })
  }

  const progress = (
    <div className="flex items-center justify-center gap-2 px-4 pt-6">
      {([1, 2, 3] as const).map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={[
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              step >= n
                ? 'bg-[var(--margen-accent)] text-[var(--margen-accent-fg)]'
                : 'border border-white/20 bg-white/5 text-white/50',
            ].join(' ')}
          >
            {n}
          </div>
          {n < 3 ? <div className="hidden h-px w-8 bg-white/15 sm:block" /> : null}
        </div>
      ))}
      <p className="ml-3 text-xs font-medium text-white/60 sm:hidden">Step {step} of 3</p>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="s1"
            className="fixed inset-0 flex flex-col bg-[#071222]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: easePremium }}
          >
            {progress}
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16">
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="absolute h-36 w-36 rounded-full border-2 border-[var(--margen-accent)]/35"
                  animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.85, 0.45] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute h-44 w-44 rounded-full border border-white/10"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.45, 0.2] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative text-[var(--margen-accent)]">
                  <MargenLogo className="h-20 w-auto" title="Margen" />
                </div>
              </div>
              <motion.h1
                className="mt-10 max-w-md text-center text-xl font-semibold text-white"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35, ease: easePremium }}
              >
                Setting up your AI receptionist
              </motion.h1>
              <p className="mt-3 max-w-sm text-center text-sm text-white/65">
                Setting up your dedicated AI phone number…
              </p>
              {provisionBusy ? (
                <div className="mt-10 w-full max-w-xs space-y-3">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-[var(--margen-accent)]"
                      initial={{ width: '12%' }}
                      animate={{ width: ['12%', '88%', '55%', '100%'] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-center text-xs text-white/70">This usually takes under a minute.</p>
                </div>
              ) : null}
              {provisionError ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 w-full max-w-md rounded-xl px-4 py-4 text-center alert-error"
                >
                  <p className="text-sm">{provisionError}</p>
                  <button
                    type="button"
                    onClick={() => void runProvision()}
                    className="mt-4 rounded-lg bg-[var(--margen-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)]"
                  >
                    Try again
                  </button>
                </motion.div>
              ) : null}
            </div>
            <p className="pb-6 text-center text-xs text-white/35">Step 1 of 3</p>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="s2"
            className="min-h-dvh bg-[var(--color-margen-surface)] px-4 py-10"
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.38, ease: easePremium }}
          >
            <div className="mx-auto max-w-lg pt-4">
              <div className="mb-6 flex items-center justify-center gap-2 text-[var(--color-margen-muted)]">
                <span className="text-xs font-semibold uppercase tracking-wide">Step 2 of 3</span>
              </div>
              <motion.div
                layout
                className="rounded-2xl border border-[var(--color-margen-border)] bg-white px-6 py-10"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#dcfce7] text-[#166534]"
                >
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="mt-6 text-center text-lg font-semibold text-[var(--color-margen-text)]">
                  Your AI number is ready
                </h2>
                <p className="mt-2 text-center text-sm text-[var(--color-margen-muted)]">
                  Missed calls to your business will be answered by your AI receptionist.
                </p>
                <p className="mt-8 text-center font-mono text-2xl font-semibold tracking-tight text-[var(--color-margen-text)] sm:text-3xl">
                  {displayNumber}
                </p>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-10 w-full rounded-xl bg-[var(--margen-accent)] py-3.5 text-sm font-semibold text-[var(--margen-accent-fg)] shadow-md transition hover:opacity-95"
                >
                  Continue
                </button>
              </motion.div>
            </div>
          </motion.div>
        ) : null}

        {step === 3 ? (
          <motion.div
            key="s3"
            className="min-h-dvh bg-[var(--color-margen-surface)] px-4 py-8 pb-12"
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.38, ease: easePremium }}
          >
            <div className="mx-auto max-w-lg">
              <p className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-margen-muted)]">
                Step 3 of 3
              </p>
              <h2 className="mt-4 text-center text-2xl font-semibold text-[var(--color-margen-text)]">One last step</h2>
              <p className="mt-2 text-center text-sm text-[var(--color-margen-muted)]">
                Forward your missed calls to your AI number in about 10 seconds.
              </p>

              <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-[var(--color-margen-muted)]">
                Who provides your business cell service?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CARRIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPickCarrier(opt.id)}
                    className={[
                      'rounded-full border px-3 py-2.5 text-sm font-medium transition',
                      carrier === opt.id
                        ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                        : 'border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-[var(--color-margen-text)] hover:border-[var(--margen-accent)]/40',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {carrier && margenE164 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 rounded-2xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-5"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                    Your activation code or steps
                  </p>
                  <p className="mt-3 break-words text-lg font-bold leading-snug text-[var(--margen-accent)] sm:text-xl">
                    {forwardingActivationSnippet(carrier, margenE164)}
                  </p>
                  <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[var(--color-margen-text)]">
                    {forwardingStepsHtml(carrier, margenE164).map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--margen-accent)]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <p className="mt-8 text-center text-sm text-[var(--color-margen-muted)]">
                  Pick your carrier above to see simple steps for your phone.
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={!carrier || smsBusy}
                  onClick={() => void onSendSms()}
                  className="w-full rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] py-3.5 text-sm font-semibold text-[var(--color-margen-text)] transition hover:border-[var(--margen-accent)]/50 disabled:opacity-45"
                >
                  {smsBusy ? 'Sending…' : 'Send to my phone'}
                </button>
                <button
                  type="button"
                  disabled={finishBusy}
                  onClick={() => void onFinishSetup()}
                  className="w-full rounded-xl bg-[var(--margen-accent)] py-3.5 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-50"
                >
                  {finishBusy ? 'Saving…' : "I've set it up"}
                </button>
              </div>
              {smsNote ? (
                <p className="mt-3 rounded-md px-3 py-2 text-center text-sm alert-success">{smsNote}</p>
              ) : null}
              {smsError ? <p className="mt-3 text-center text-sm text-danger">{smsError}</p> : null}

              <button
                type="button"
                onClick={onSkip}
                className="mx-auto mt-8 block text-sm text-[var(--color-margen-muted)] underline-offset-4 hover:text-[var(--color-margen-text)] hover:underline"
              >
                Skip for now
              </button>
              <p className="mt-6 text-center text-xs text-[var(--color-margen-muted)]">
                Need help?{' '}
                <Link to="/settings" className="font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline">
                  Settings
                </Link>
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
