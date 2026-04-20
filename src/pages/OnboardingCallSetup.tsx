import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useAuth } from '../contexts/useAuth'
import { easePremium } from '../lib/motion'
import {
  CARRIER_OPTIONS,
  type CarrierId,
  forwardingActivationSnippet,
  formatUsDisplay,
} from '../lib/forwardingDialCode'
import {
  PLACEHOLDER_MARGEN_PHONE_SID,
  placeholderMargenE164ForOwner,
  sendMargenForwardingSms,
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
      <p className="text-center text-lg font-medium text-[var(--color-margen-text)]">Step {step} of 3</p>
      <div className="mx-auto mt-3 h-3 max-w-lg overflow-hidden rounded-full bg-[var(--color-margen-border)]">
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

function StepCircle({ n }: { n: number }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-xl font-semibold text-[var(--color-margen-text)]">
      {n}
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

  const [carrier, setCarrier] = useState<CarrierId | null>(null)
  const [smsBusy, setSmsBusy] = useState(false)
  const [smsNote, setSmsNote] = useState<string | null>(null)
  const [smsError, setSmsError] = useState<string | null>(null)
  const [finishBusy, setFinishBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const activationCode = useMemo(
    () => (carrier && margenE164 ? forwardingActivationSnippet(carrier, margenE164) : ''),
    [carrier, margenE164],
  )

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

  const onCopyCode = async () => {
    if (!activationCode) return
    try {
      await navigator.clipboard.writeText(activationCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setSmsError('Copy did not work. You can highlight the number and copy it by hand.')
    }
  }

  const onSendSms = async () => {
    setSmsBusy(true)
    setSmsError(null)
    setSmsNote(null)
    const { error } = await sendMargenForwardingSms(supabase)
    setSmsBusy(false)
    if (error) {
      setSmsError("We couldn't send a text right now. You can still follow the steps above.")
      return
    }
    setSmsNote('Sent! Check the texts on your business phone.')
  }

  const onFinishSetup = async () => {
    if (!user) return
    setFinishBusy(true)
    const { error } = await supabase.from('profiles').update({ call_forwarding_active: true } as never).eq('id', user.id)
    if (error) {
      setFinishBusy(false)
      setSmsError(error.message)
      return
    }
    window.location.href = '/dashboard'
  }

  const onSkip = () => {
    window.location.href = '/dashboard'
  }

  const btnPrimary =
    'margen-btn-accent inline-flex w-full items-center justify-center disabled:opacity-60'
  const btnSecondary =
    'flex w-full items-center justify-center rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-margen-text)] transition hover:bg-[var(--color-margen-hover)] disabled:opacity-60'

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-margen-surface)]">
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
                  className="absolute h-40 w-40 rounded-full border-2 border-[var(--color-margen-border)]"
                  animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.75, 0.4] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative">
                  <MargenLogo className="h-24 w-auto" title="Margen" />
                </div>
              </div>
              <motion.h1
                className="mt-10 max-w-xl text-center text-[32px] font-semibold leading-tight tracking-tight text-[var(--color-margen-text)]"
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
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--color-margen-border)]">
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
                  className="margen-card-static mt-10 w-full max-w-lg px-5 py-5 text-center"
                >
                  <p className="text-[18px] leading-relaxed text-red-800">{provisionError}</p>
                  <button type="button" onClick={() => void runPlaceholderSetup()} className={`${btnPrimary} mt-6`}>
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
              <motion.div layout className="margen-card-static w-full max-w-lg p-8 sm:p-10">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] text-[var(--color-margen-text)]"
                >
                  <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="mt-8 text-center text-[32px] font-semibold leading-tight text-[var(--color-margen-text)]">
                  Here’s your new number
                </h2>
                <p className="mt-4 text-center text-[18px] leading-relaxed text-[var(--color-margen-text-secondary)]">
                  When you can’t pick up, this number can greet your caller for you and help book the visit.
                </p>
                <p className="mt-10 text-center font-mono text-3xl font-semibold tracking-tight text-[var(--color-margen-text)] sm:text-4xl">
                  {displayNumber}
                </p>
                <button type="button" onClick={() => setStep(3)} className={`${btnPrimary} mt-12`}>
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
              <div className="margen-card-static p-6 sm:p-8">
                <h2 className="text-center text-[28px] font-semibold leading-tight text-[var(--color-margen-text)] sm:text-[32px]">
                  Connect your phone
                </h2>
                <p className="mt-3 text-center text-[17px] leading-relaxed text-[var(--color-margen-text-secondary)]">
                  Who provides your business cell? Tap the one you use so we can show you the right code.
                </p>

                <p className="mt-8 text-[17px] font-medium text-[var(--color-margen-text)]">Your cell company</p>
                <div className="mt-3 flex flex-col gap-3">
                  {CARRIER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onPickCarrier(opt.id)}
                      className={[
                        'min-h-12 w-full rounded-md border px-4 py-3 text-left text-sm font-medium transition',
                        carrier === opt.id
                          ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--color-margen-text)]'
                          : 'border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-[var(--color-margen-text)] hover:border-[var(--color-margen-border-hover)] hover:bg-[var(--color-margen-hover)]',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {carrier && margenE164 ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-8">
                    <div className="flex gap-4">
                      <StepCircle n={1} />
                      <p className="flex-1 pt-2 text-[18px] leading-snug text-[var(--color-margen-text)]">
                        Open your phone&apos;s dial pad
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <StepCircle n={2} />
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="text-[18px] leading-snug text-[var(--color-margen-text)]">Type this number exactly:</p>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-margen-muted)]">
                          Your activation code
                        </p>
                        <div className="flex flex-col gap-3 rounded-md border border-[var(--color-margen-border)] bg-[var(--margen-accent-muted)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0 break-all font-mono text-[32px] font-bold leading-tight text-[var(--color-margen-text)]">
                            {activationCode}
                          </p>
                          <button
                            type="button"
                            onClick={() => void onCopyCode()}
                            className="shrink-0 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] transition hover:bg-[var(--color-margen-hover)]"
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <StepCircle n={3} />
                      <p className="flex-1 pt-2 text-[18px] leading-snug text-[var(--color-margen-text)]">
                        Press call — you&apos;ll hear a short beep, then hang up
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <StepCircle n={4} />
                      <p className="flex-1 pt-2 text-[18px] leading-snug text-[var(--color-margen-text)]">
                        That&apos;s it! Missed calls will now be answered for you automatically.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <p className="mt-8 text-center text-[17px] text-[var(--color-margen-muted)]">
                    Choose your company above and your steps will show up right here.
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={!carrier || smsBusy}
                  onClick={() => void onSendSms()}
                  className={btnPrimary}
                >
                  {smsBusy ? 'Sending…' : 'Send these steps to my phone'}
                </button>
                <button type="button" disabled={finishBusy} onClick={() => void onFinishSetup()} className={btnSecondary}>
                  {finishBusy ? 'Saving…' : "I've done it — take me to my dashboard"}
                </button>
              </div>

              {smsNote ? (
                <p className="mt-4 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3 text-center text-[17px] text-[var(--color-margen-text)]">
                  {smsNote}
                </p>
              ) : null}
              {smsError ? <p className="mt-4 text-center text-[17px] text-red-700">{smsError}</p> : null}

              <button
                type="button"
                onClick={onSkip}
                className="mx-auto mt-6 block min-h-11 text-[16px] font-medium text-[var(--color-margen-muted)] underline-offset-4 hover:text-[var(--color-margen-text)] hover:underline"
              >
                Skip for now
              </button>

              <p className="mt-8 text-center text-[15px] text-[var(--color-margen-muted)]">
                Questions?{' '}
                <Link
                  to="/settings"
                  className="font-semibold text-[var(--margen-accent)] underline-offset-2 hover:underline"
                >
                  Open settings
                </Link>
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
