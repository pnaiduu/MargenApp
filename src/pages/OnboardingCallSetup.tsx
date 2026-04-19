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
      <p className="text-center text-lg font-medium text-[#5c5348]">Step {step} of 3</p>
      <div className="mx-auto mt-3 h-3 max-w-lg overflow-hidden rounded-full bg-[#e8dfd4]">
        <motion.div
          className="h-full rounded-full bg-[#c4713b]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: easePremium }}
        />
      </div>
    </div>
  )
}

function warmSteps(display: string): string[] {
  return [
    'Use the phone you carry for work.',
    'Open your calling app. On the number pad, copy the numbers shown above, then press call.',
    `When you hear a short sound, hang up. After that, missed calls can ring ${display} so someone friendly can answer for you.`,
  ]
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

  const onSendSms = async () => {
    setSmsBusy(true)
    setSmsError(null)
    setSmsNote(null)
    const { error } = await sendMargenForwardingSms(supabase)
    setSmsBusy(false)
    if (error) {
      setSmsError("We couldn't send a text right now. You can still finish using the steps above.")
      return
    }
    setSmsNote('Sent! Check the texts on your business phone.')
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

  const btnPrimary =
    'flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#c4713b] px-5 text-lg font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50'
  const btnSecondary =
    'flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-[#d4c4b4] bg-white px-5 text-lg font-semibold text-[#3d3429] transition hover:bg-[#fff9f3] disabled:opacity-45'

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#fff8f0]">
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
                  className="absolute h-40 w-40 rounded-full border-2 border-[#e8b89a]/50"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.7, 0.35] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative">
                  <MargenLogo className="h-24 w-auto" title="Margen" />
                </div>
              </div>
              <motion.h1
                className="mt-10 max-w-xl text-center text-[32px] font-semibold leading-tight tracking-tight text-[#2a241c]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.35, ease: easePremium }}
              >
                Let’s get your calls answered for you
              </motion.h1>
              <p className="mt-4 max-w-xl text-center text-[18px] leading-relaxed text-[#5c5348]">
                We’re saving a friendly number to your account. This only takes a moment.
              </p>
              {provisionBusy ? (
                <div className="mt-12 w-full max-w-md space-y-4">
                  <div className="h-3 overflow-hidden rounded-full bg-[#e8dfd4]">
                    <motion.div
                      className="h-full rounded-full bg-[#c4713b]"
                      initial={{ width: '8%' }}
                      animate={{ width: ['8%', '92%', '40%', '100%'] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-center text-[18px] text-[#7a6f63]">Almost there…</p>
                </div>
              ) : null}
              {provisionError ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-10 w-full max-w-lg rounded-2xl border border-red-200 bg-red-50 px-5 py-5 text-center"
                >
                  <p className="text-[18px] leading-relaxed text-red-900">{provisionError}</p>
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
              <motion.div
                layout
                className="w-full max-w-lg rounded-3xl border border-[#e8dfd4] bg-white p-8 shadow-lg sm:p-10"
              >
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ecf7ed] text-[#2f6b3a]"
                >
                  <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="mt-8 text-center text-[32px] font-semibold leading-tight text-[#2a241c]">
                  Here’s your new number
                </h2>
                <p className="mt-4 text-center text-[18px] leading-relaxed text-[#5c5348]">
                  When you can’t pick up, this number can greet your caller for you and help book the visit.
                </p>
                <p className="mt-10 text-center font-mono text-3xl font-semibold tracking-tight text-[#2a241c] sm:text-4xl">
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
              <h2 className="text-center text-[32px] font-semibold leading-tight text-[#2a241c]">One easy last step</h2>
              <p className="mt-4 text-center text-[18px] leading-relaxed text-[#5c5348]">
                Tell us who provides your business cell service so we can show you the right short code to dial.
              </p>

              <p className="mt-10 text-[18px] font-medium text-[#3d3429]">Who is your cell phone company?</p>
              <div className="mt-4 flex flex-col gap-3">
                {CARRIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onPickCarrier(opt.id)}
                    className={[
                      'min-h-14 w-full rounded-2xl border-2 px-4 text-lg font-semibold transition',
                      carrier === opt.id
                        ? 'border-[#c4713b] bg-[#fff4eb] text-[#8b4513]'
                        : 'border-[#e8dfd4] bg-white text-[#3d3429] hover:border-[#d4c4b4]',
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
                  className="mt-10 rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-md"
                >
                  <p className="text-[18px] font-medium text-[#3d3429]">Your code to dial</p>
                  <p className="mt-3 break-words font-mono text-2xl font-bold leading-snug text-[#c4713b] sm:text-3xl">
                    {forwardingActivationSnippet(carrier, margenE164)}
                  </p>
                  <ul className="mt-6 space-y-4 text-[18px] leading-relaxed text-[#3d3429]">
                    {warmSteps(formatUsDisplay(margenE164)).map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#c4713b]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <p className="mt-10 text-center text-[18px] text-[#7a6f63]">Choose your company above to see your code.</p>
              )}

              <div className="mt-10 flex flex-col gap-3">
                <button type="button" disabled={!carrier || smsBusy} onClick={() => void onSendSms()} className={btnSecondary}>
                  {smsBusy ? 'Sending…' : 'Text me these steps'}
                </button>
                <button type="button" disabled={finishBusy} onClick={() => void onFinishSetup()} className={btnPrimary}>
                  {finishBusy ? 'Saving…' : 'All set — go to my home screen'}
                </button>
              </div>
              {smsNote ? (
                <p className="mt-4 rounded-2xl bg-[#ecf7ed] px-4 py-3 text-center text-[18px] text-[#2f6b3a]">{smsNote}</p>
              ) : null}
              {smsError ? <p className="mt-4 text-center text-[18px] text-red-700">{smsError}</p> : null}

              <button
                type="button"
                onClick={onSkip}
                className="mx-auto mt-10 block min-h-12 text-[18px] font-medium text-[#7a6f63] underline-offset-4 hover:text-[#3d3429] hover:underline"
              >
                Skip for now
              </button>
              <p className="mt-8 text-center text-[16px] text-[#7a6f63]">
                Questions?{' '}
                <Link to="/settings" className="font-semibold text-[#c4713b] underline-offset-2 hover:underline">
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
