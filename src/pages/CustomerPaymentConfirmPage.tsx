import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { easePremium, tapButton } from '../lib/motion'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
] as const

type Method = (typeof METHODS)[number]['value']

type Details = {
  valid: boolean
  job_title?: string
  customer_name?: string | null
  amount_cents?: number
  company_name?: string
  already_confirmed?: boolean
  payment_method?: string | null
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function methodLabel(m: string | null | undefined) {
  const row = METHODS.find((x) => x.value === m)
  return row?.label ?? m ?? '—'
}

export function CustomerPaymentConfirmPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [details, setDetails] = useState<Details | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [method, setMethod] = useState<Method | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetails = useCallback(async () => {
    if (!token) return
    setLoadError(null)
    const { data, error: rpcErr } = await supabase.rpc('get_payment_confirmation_details', {
      p_token: token,
    })
    if (rpcErr) {
      setLoadError(rpcErr.message)
      setDetails(null)
      return
    }
    setDetails((data ?? { valid: false }) as Details)
  }, [token])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token || !method) {
      setError('Please choose how you paid.')
      return
    }
    setSubmitting(true)
    const { data, error: rpcErr } = await supabase.rpc('submit_payment_confirmation', {
      p_token: token,
      p_method: method,
    })
    setSubmitting(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    if (data === true) {
      setDetails((d) =>
        d && d.valid ? { ...d, already_confirmed: true, payment_method: method } : d,
      )
      setDone(true)
    } else setError('This link is invalid or could not be saved.')
  }

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111827] px-4">
        <p className="text-center text-sm text-[#9ca3af]">Missing confirmation link.</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111827] px-4">
        <p className="text-center text-sm text-danger">{loadError}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111827] px-4">
        <p className="text-sm text-[#9ca3af]">Loading…</p>
      </div>
    )
  }

  if (!details.valid) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111827] px-4">
        <p className="text-center text-sm text-[#9ca3af]">This payment link is not valid.</p>
      </div>
    )
  }

  if (done || details.already_confirmed) {
    const m = details.payment_method
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#111827] px-6">
        <motion.p
          className="text-center text-lg font-semibold text-[#f3f4f6]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easePremium }}
        >
          {details.already_confirmed && !done
            ? `You already confirmed payment (${methodLabel(m)}). Thank you.`
            : `Thank you — we recorded ${methodLabel(m)}.`}
        </motion.p>
      </div>
    )
  }

  const company = details.company_name ?? 'Margen'
  const title = details.job_title ?? 'Service'
  const amount = formatUsd(details.amount_cents ?? 0)

  return (
    <div className="flex min-h-dvh flex-col bg-[#111827] px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: easePremium }}
      >
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">{company}</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-[#f3f4f6]">Confirm your payment</h1>
        <p className="mt-2 text-center text-sm text-[#9ca3af]">Tell us how you paid for your visit.</p>
      </motion.div>

      <div className="mx-auto mt-8 w-full max-w-sm rounded-xl border border-[#374151] bg-[#1f2937] px-4 py-4">
        <p className="text-sm font-semibold text-[#f3f4f6]">{title}</p>
        {details.customer_name ? (
          <p className="mt-1 text-xs text-[#9ca3af]">Customer: {details.customer_name}</p>
        ) : null}
        <p className="mt-3 text-2xl font-bold tabular-nums text-[#e5e7eb]">{amount}</p>
      </div>

      <form onSubmit={onSubmit} className="mx-auto mt-8 w-full max-w-sm space-y-6">
        <div>
          <p className="mb-3 text-center text-sm font-medium text-[#e5e7eb]">How did you pay?</p>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((opt) => (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => setMethod(opt.value)}
                className={`min-h-[48px] rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  method === opt.value
                    ? 'border-[#e5e7eb] bg-[#e5e7eb] text-[#111827]'
                    : 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]'
                }`}
                whileTap={tapButton}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.p
              key="e"
              role="alert"
              className="text-center text-sm text-danger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <motion.button
          type="submit"
          disabled={submitting}
          className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-[#e5e7eb] text-sm font-bold text-[#111827] disabled:opacity-50"
          whileTap={submitting ? undefined : tapButton}
        >
          {submitting ? 'Sending…' : 'Confirm payment'}
        </motion.button>
      </form>
    </div>
  )
}
