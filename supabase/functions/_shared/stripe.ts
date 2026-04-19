import Stripe from 'npm:stripe@16.12.0'

export function stripeClient() {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY')
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

