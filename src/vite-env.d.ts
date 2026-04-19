/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Optional: enables live technician map on the dashboard */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Public site URL for invite links / QR (e.g. https://trymargen.com) */
  readonly VITE_PUBLIC_SITE_URL?: string
  /** Domain for synthetic technician login emails (invite.{token}@domain) */
  readonly VITE_INVITE_EMAIL_DOMAIN?: string
  /** Shared Margen Retell account — used from the dashboard to list voices and deploy agents */
  readonly VITE_RETELL_API_KEY?: string
  /** Stripe.js publishable key — required for client Checkout (subscriptions) */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** Recurring Price IDs from Stripe Dashboard (monthly) */
  readonly VITE_STRIPE_STARTER_PRICE_ID?: string
  readonly VITE_STRIPE_GROWTH_PRICE_ID?: string
  readonly VITE_STRIPE_SCALE_PRICE_ID?: string
  /** Optional annual Price IDs (10× monthly). If unset, annual toggle uses monthly price ID. */
  readonly VITE_STRIPE_STARTER_PRICE_ID_ANNUAL?: string
  readonly VITE_STRIPE_GROWTH_PRICE_ID_ANNUAL?: string
  readonly VITE_STRIPE_SCALE_PRICE_ID_ANNUAL?: string
  /** Comma-separated emails that bypass Margen SaaS subscription checks (full access for QA). Default includes davynaidu@gmail.com in code. */
  readonly VITE_DEV_BYPASS_EMAILS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
