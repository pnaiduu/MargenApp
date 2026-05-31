import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeStripeConnectCode } from '../lib/stripeConnect'

export function StripeCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Connecting your Stripe account…')

  useEffect(() => {
    const err = searchParams.get('error_description') ?? searchParams.get('error')
    if (err) {
      setMessage(decodeURIComponent(err))
      const id = window.setTimeout(() => navigate('/payments?stripe=error', { replace: true }), 2500)
      return () => window.clearTimeout(id)
    }

    const code = searchParams.get('code')
    if (!code) {
      setMessage('Missing authorization code from Stripe.')
      const id = window.setTimeout(() => navigate('/payments?stripe=error', { replace: true }), 2500)
      return () => window.clearTimeout(id)
    }

    let cancelled = false
    void (async () => {
      try {
        await exchangeStripeConnectCode(code)
        if (cancelled) return
        navigate('/payments?stripe=connected', { replace: true })
      } catch (e) {
        if (cancelled) return
        setMessage(e instanceof Error ? e.message : 'Could not connect Stripe.')
        window.setTimeout(() => navigate('/payments?stripe=error', { replace: true }), 3000)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-margen-border)] border-t-[var(--margen-accent)]" />
      <p className="mt-4 max-w-md text-sm text-[var(--color-margen-text-secondary)]">{message}</p>
    </div>
  )
}
