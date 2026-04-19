import { AnimatePresence, motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { easePremium, tapButton } from '../lib/motion'

const stars = [1, 2, 3, 4, 5]

export function CustomerRatePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token || rating == null) {
      setError('Choose a star rating.')
      return
    }
    setSubmitting(true)
    const { data, error: rpcErr } = await supabase.rpc('submit_customer_rating', {
      p_token: token,
      p_rating: rating,
      p_comment: comment,
    })
    setSubmitting(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    if (data === true) setDone(true)
    else setError('This link is invalid or was already used.')
  }

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#111827] px-4">
        <p className="text-center text-sm text-[#9ca3af]">Missing rating link.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#111827] px-6">
        <motion.p
          className="text-center text-lg font-semibold text-[#f3f4f6]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easePremium }}
        >
          Thank you — your feedback helps us improve.
        </motion.p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#111827] px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: easePremium }}
      >
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Margen</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-[#f3f4f6]">Rate your visit</h1>
        <p className="mt-2 text-center text-sm text-[#9ca3af]">How did we do today?</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mx-auto mt-10 w-full max-w-sm space-y-8">
        <div>
          <p className="mb-3 text-center text-sm font-medium text-[#e5e7eb]">Tap to rate</p>
          <div className="flex justify-center gap-3">
            {stars.map((n) => (
              <motion.button
                key={n}
                type="button"
                aria-label={`${n} stars`}
                onClick={() => setRating(n)}
                className={`flex min-h-[52px] min-w-[52px] items-center justify-center rounded-xl transition-colors ${
                  rating != null && n <= rating ? 'text-[#fbbf24]' : 'text-[#9ca3af]'
                }`}
                whileTap={tapButton}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="block">
                  <path d="M12 2l2.9 6.26 6.5.95-4.7 4.58 1.1 6.47L12 17.77 6.1 20.26l1.1-6.47L2.6 9.21l6.5-.95L12 2z" />
                </svg>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="rate-comment" className="mb-2 block text-xs font-medium text-[#9ca3af]">
            A few words <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id="rate-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="What stood out?"
            className="w-full resize-none rounded-lg border border-[#374151] bg-[#1f2937] px-3 py-3 text-sm text-[#f3f4f6] outline-none focus:border-[#e5e7eb]"
          />
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
          {submitting ? 'Sending…' : 'Submit'}
        </motion.button>
      </form>
    </div>
  )
}
