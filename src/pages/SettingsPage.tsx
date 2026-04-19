import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HexColorPicker } from 'react-colorful'
import { easePremium } from '../lib/motion'
import { normalizeHex } from '../lib/logoFilter'
import { stripeConnectStartDemo, stripeConnectSyncDemo } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/useAuth'
import { usePreferences } from '../contexts/usePreferences'
import {
  parseCoveredCities,
  ServiceAreaEditor,
  type ServiceAreaInitial,
  type ServiceAreaSnapshot,
} from '../components/settings/ServiceAreaEditor'
import { retellTestCallDemo } from '../lib/directSupabaseActions'
import {
  CARRIER_OPTIONS,
  type CarrierId,
  forwardingActivationSnippet,
  formatUsDisplay,
  guessAreaCodeForProvisioning,
} from '../lib/forwardingDialCode'
import { provisionMargenTwilioNumber, sendMargenForwardingSms } from '../lib/margenTwilio'
import { cancelSubscriptionAtPeriodEnd, openStripeBillingPortal } from '../lib/stripeSubscription'
import { syncStripeAnalyticsLedger } from '../lib/stripeAnalytics'
import { StripeAnalyticsSetupModal } from '../components/settings/StripeAnalyticsSetupModal'
import { planById, type SubscriptionRow } from '../lib/plans'
import { isDevBypassEmail } from '../lib/subscriptionAccess'

function tryParseHex(s: string): string | null {
  const t = s.trim()
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return normalizeHex(t)
  if (/^[0-9A-Fa-f]{6}$/i.test(t)) return normalizeHex(`#${t}`)
  return null
}

export function SettingsPage() {
  const { user } = useAuth()
  const { accentHex, setAccentHex, persistError, saving } = usePreferences()
  const [hexDraft, setHexDraft] = useState(accentHex)
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null)
  const [stripeEnabled, setStripeEnabled] = useState<boolean | null>(null)
  const [stripeDetailsSubmitted, setStripeDetailsSubmitted] = useState<boolean | null>(null)
  const [stripeBusy, setStripeBusy] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [vipThresholdCents, setVipThresholdCents] = useState<number | null>(null)
  const [vipDraft, setVipDraft] = useState<string>('')
  const [vipBusy, setVipBusy] = useState(false)
  const [vipError, setVipError] = useState<string | null>(null)

  const [companyDraft, setCompanyDraft] = useState('')
  const [logoUrlDraft, setLogoUrlDraft] = useState('')
  const [businessPhoneDraft, setBusinessPhoneDraft] = useState('')
  const [ringsBeforeAiDraft, setRingsBeforeAiDraft] = useState('3')
  const [bizHoursEnabled, setBizHoursEnabled] = useState(false)
  const [bizHoursOpenDraft, setBizHoursOpenDraft] = useState('09:00')
  const [bizHoursCloseDraft, setBizHoursCloseDraft] = useState('17:00')
  const [afterHoursMsgDraft, setAfterHoursMsgDraft] = useState('')
  const [serviceAreaSnapshot, setServiceAreaSnapshot] = useState<ServiceAreaSnapshot>({
    business_address: null,
    business_lat: null,
    business_lng: null,
    service_radius_miles: null,
    covered_cities: [],
  })
  const [serviceAreaInitial, setServiceAreaInitial] = useState<ServiceAreaInitial | null>(null)
  const [serviceAreaResetToken, setServiceAreaResetToken] = useState(0)
  const [bizBusy, setBizBusy] = useState(false)
  const [bizError, setBizError] = useState<string | null>(null)
  const [saasSubscription, setSaasSubscription] = useState<SubscriptionRow | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [stripeAnalyticsHint, setStripeAnalyticsHint] = useState<string | null>(null)
  const [stripeAnalyticsLastSyncAt, setStripeAnalyticsLastSyncAt] = useState<string | null>(null)
  const [stripeAnalyticsModalOpen, setStripeAnalyticsModalOpen] = useState(false)
  const [stripeAnalyticsOpBusy, setStripeAnalyticsOpBusy] = useState(false)
  const [stripeAnalyticsOpError, setStripeAnalyticsOpError] = useState<string | null>(null)

  const [margenPhone, setMargenPhone] = useState<string | null>(null)
  const [margenPhoneSid, setMargenPhoneSid] = useState<string | null>(null)
  const [callForwardingActive, setCallForwardingActive] = useState(false)
  const [carrierDraft, setCarrierDraft] = useState<CarrierId | ''>('')
  const [callSetupBusy, setCallSetupBusy] = useState(false)
  const [callSetupError, setCallSetupError] = useState<string | null>(null)
  const [callSetupOk, setCallSetupOk] = useState<string | null>(null)
  const [callSmsBusy, setCallSmsBusy] = useState(false)
  const [callTestBusy, setCallTestBusy] = useState(false)
  const [callChangeBusy, setCallChangeBusy] = useState(false)

  useEffect(() => {
    setHexDraft(accentHex)
  }, [accentHex])

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function loadStripeState() {
      const [profRes, subRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'company_name, logo_url, business_phone, rings_before_ai, business_hours, after_hours_message, business_address, business_lat, business_lng, service_radius_miles, covered_cities, service_area_center_lat, service_area_center_lng, service_area_radius, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_analytics_key_hint, stripe_analytics_last_sync_at, vip_threshold_cents, margen_phone_number, margen_phone_sid, carrier, call_forwarding_active, twilio_forwarding_code',
          )
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, stripe_customer_id, stripe_subscription_id')
          .eq('owner_id', userId)
          .maybeSingle(),
      ])
      if (cancelled) return
      const { data, error } = profRes
      if (error) {
        setStripeError(error.message)
        return
      }
      if (!subRes.error && subRes.data) {
        setSaasSubscription(subRes.data as SubscriptionRow)
      } else {
        setSaasSubscription(null)
      }
      setCompanyDraft(data?.company_name ?? '')
      setLogoUrlDraft(data?.logo_url ?? '')
      setBusinessPhoneDraft(data?.business_phone ?? '')
      const rawRings = typeof data?.rings_before_ai === 'number' ? data.rings_before_ai : 3
      const clampedRings = Math.min(5, Math.max(1, Math.round(rawRings)))
      setRingsBeforeAiDraft(String(clampedRings))
      setMargenPhone((data as { margen_phone_number?: string | null }).margen_phone_number ?? null)
      setMargenPhoneSid((data as { margen_phone_sid?: string | null }).margen_phone_sid ?? null)
      setCallForwardingActive(Boolean((data as { call_forwarding_active?: boolean }).call_forwarding_active))
      const car = (data as { carrier?: string | null }).carrier
      setCarrierDraft(
        car && CARRIER_OPTIONS.some((c) => c.id === car) ? (car as CarrierId) : '',
      )
      const bh = (data?.business_hours ?? {}) as {
        enabled?: boolean
        days?: Record<string, { open?: string; close?: string }>
      }
      setBizHoursEnabled(Boolean(bh.enabled))
      const mon = bh.days?.mon
      setBizHoursOpenDraft(mon?.open ?? '09:00')
      setBizHoursCloseDraft(mon?.close ?? '17:00')
      setAfterHoursMsgDraft(data?.after_hours_message ?? '')
      const lat =
        (data as { business_lat?: number | null }).business_lat ??
        data?.service_area_center_lat ??
        null
      const lng =
        (data as { business_lng?: number | null }).business_lng ??
        data?.service_area_center_lng ??
        null
      const radMiles =
        (data as { service_radius_miles?: number | null }).service_radius_miles ??
        data?.service_area_radius ??
        null
      const addr = (data as { business_address?: string | null }).business_address ?? null
      const rawCities = (data as { covered_cities?: unknown }).covered_cities
      const cities = parseCoveredCities(rawCities)
      setServiceAreaInitial({
        address: addr,
        lat,
        lng,
        radiusMiles: radMiles,
        cities,
      })
      setServiceAreaResetToken((t) => t + 1)
      setServiceAreaSnapshot({
        business_address: addr,
        business_lat: lat,
        business_lng: lng,
        service_radius_miles: lat != null && lng != null ? (radMiles ?? 25) : null,
        covered_cities: cities,
      })
      setStripeAccountId(data?.stripe_account_id ?? null)
      setStripeEnabled(data?.stripe_charges_enabled ?? null)
      setStripeDetailsSubmitted(data?.stripe_details_submitted ?? null)
      setStripeAnalyticsHint((data as { stripe_analytics_key_hint?: string | null })?.stripe_analytics_key_hint ?? null)
      setStripeAnalyticsLastSyncAt(
        (data as { stripe_analytics_last_sync_at?: string | null })?.stripe_analytics_last_sync_at ?? null,
      )
      setVipThresholdCents(data?.vip_threshold_cents ?? null)
      setVipDraft(
        typeof data?.vip_threshold_cents === 'number'
          ? ((data.vip_threshold_cents ?? 0) / 100).toFixed(0)
          : '',
      )
    }
    void loadStripeState()
    return () => {
      cancelled = true
    }
  }, [user])

  const onServiceAreaChange = useCallback((s: ServiceAreaSnapshot) => {
    setServiceAreaSnapshot(s)
  }, [])

  async function reloadSubscription() {
    if (!user) return
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!error && data) setSaasSubscription(data as SubscriptionRow)
    else setSaasSubscription(null)
  }

  const refreshStripeAnalyticsFromProfile = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('profiles')
      .select('stripe_analytics_key_hint, stripe_analytics_last_sync_at')
      .eq('id', user.id)
      .maybeSingle()
    if (error) return
    setStripeAnalyticsHint((data as { stripe_analytics_key_hint?: string | null })?.stripe_analytics_key_hint ?? null)
    setStripeAnalyticsLastSyncAt(
      (data as { stripe_analytics_last_sync_at?: string | null })?.stripe_analytics_last_sync_at ?? null,
    )
  }, [user])

  async function handleSyncStripeLedger() {
    setStripeAnalyticsOpBusy(true)
    setStripeAnalyticsOpError(null)
    try {
      await syncStripeAnalyticsLedger(120)
      await refreshStripeAnalyticsFromProfile()
    } catch (e) {
      setStripeAnalyticsOpError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setStripeAnalyticsOpBusy(false)
    }
  }

  async function handleBillingPortal() {
    setBillingBusy(true)
    setBillingError(null)
    try {
      await openStripeBillingPortal()
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Could not open billing portal')
    } finally {
      setBillingBusy(false)
    }
  }

  async function handleCancelSubscription() {
    if (!window.confirm('Cancel your Margen subscription at the end of the current billing period?')) return
    setBillingBusy(true)
    setBillingError(null)
    try {
      await cancelSubscriptionAtPeriodEnd()
      await reloadSubscription()
    } catch (e) {
      setBillingError(e instanceof Error ? e.message : 'Could not cancel subscription')
    } finally {
      setBillingBusy(false)
    }
  }

  async function startStripeConnect() {
    if (!user) return
    setStripeBusy(true)
    setStripeError(null)
    const { data, error } = await stripeConnectStartDemo(supabase, user.id)
    if (error) {
      setStripeError(error.message)
      setStripeBusy(false)
      return
    }
    const url = (data as { url?: string; stripe_account_id?: string } | null)?.url
    const acct = (data as { url?: string; stripe_account_id?: string } | null)?.stripe_account_id ?? null
    if (acct) setStripeAccountId(acct)
    setStripeEnabled(true)
    setStripeDetailsSubmitted(true)
    if (url) window.location.assign(url)
    setStripeBusy(false)
  }

  async function syncStripeConnect() {
    if (!user) return
    setStripeBusy(true)
    setStripeError(null)
    const { data, error } = await stripeConnectSyncDemo(supabase, user.id)
    if (error) {
      setStripeError(error.message)
      setStripeBusy(false)
      return
    }
    const d = data as { stripe_charges_enabled?: boolean; stripe_details_submitted?: boolean } | null
    setStripeEnabled(Boolean(d?.stripe_charges_enabled))
    setStripeDetailsSubmitted(Boolean(d?.stripe_details_submitted))
    setStripeBusy(false)
  }

  async function saveVipThreshold() {
    if (!user) return
    setVipBusy(true)
    setVipError(null)
    const dollars = Number(vipDraft)
    if (!Number.isFinite(dollars) || dollars < 0) {
      setVipError('Enter a valid non-negative number.')
      setVipBusy(false)
      return
    }
    const cents = Math.round(dollars * 100)
    const { error } = await supabase.from('profiles').update({ vip_threshold_cents: cents }).eq('id', user.id)
    if (error) setVipError(error.message)
    else setVipThresholdCents(cents)
    setVipBusy(false)
  }

  async function saveBusinessSettings() {
    if (!user) return
    setBizBusy(true)
    setBizError(null)
    const lat = serviceAreaSnapshot.business_lat
    const lng = serviceAreaSnapshot.business_lng
    const radius = serviceAreaSnapshot.service_radius_miles
    if (lat != null && !Number.isFinite(lat)) {
      setBizError('Service area latitude is invalid.')
      setBizBusy(false)
      return
    }
    if (lng != null && !Number.isFinite(lng)) {
      setBizError('Service area longitude is invalid.')
      setBizBusy(false)
      return
    }
    if (radius != null && (!Number.isFinite(radius) || radius < 0)) {
      setBizError('Service area radius is invalid.')
      setBizBusy(false)
      return
    }
    if (!/^\d{2}:\d{2}$/.test(bizHoursOpenDraft.trim()) || !/^\d{2}:\d{2}$/.test(bizHoursCloseDraft.trim())) {
      setBizError('Business hours must be in HH:MM format.')
      setBizBusy(false)
      return
    }

    const business_hours = {
      enabled: bizHoursEnabled,
      days: {
        mon: { open: bizHoursOpenDraft.trim(), close: bizHoursCloseDraft.trim() },
        tue: { open: bizHoursOpenDraft.trim(), close: bizHoursCloseDraft.trim() },
        wed: { open: bizHoursOpenDraft.trim(), close: bizHoursCloseDraft.trim() },
        thu: { open: bizHoursOpenDraft.trim(), close: bizHoursCloseDraft.trim() },
        fri: { open: bizHoursOpenDraft.trim(), close: bizHoursCloseDraft.trim() },
      },
    }
    const patch: Record<string, unknown> = {
      company_name: companyDraft.trim() || null,
      logo_url: logoUrlDraft.trim() || null,
      business_phone: businessPhoneDraft.trim() || null,
      business_hours,
      after_hours_message: afterHoursMsgDraft.trim() || null,
    }
    if (lat != null && lng != null && radius != null) {
      patch.business_address = serviceAreaSnapshot.business_address
      patch.business_lat = lat
      patch.business_lng = lng
      patch.service_radius_miles = radius
      patch.covered_cities = serviceAreaSnapshot.covered_cities
      patch.service_area_center_lat = lat
      patch.service_area_center_lng = lng
      patch.service_area_radius = radius
    }

    const { error } = await supabase.from('profiles').update(patch as never).eq('id', user.id)
    if (error) setBizError(error.message)
    setBizBusy(false)
  }

  async function saveCallPreferences() {
    if (!user) return
    setCallSetupBusy(true)
    setCallSetupError(null)
    setCallSetupOk(null)
    const rings = ringsBeforeAiDraft.trim() ? Number(ringsBeforeAiDraft) : 3
    if (!Number.isFinite(rings) || rings < 1 || rings > 5) {
      setCallSetupError('Rings before the AI answers should be between 1 and 5.')
      setCallSetupBusy(false)
      return
    }
    const patch: Record<string, unknown> = {
      rings_before_ai: Math.round(rings),
    }
    if (carrierDraft && CARRIER_OPTIONS.some((c) => c.id === carrierDraft) && margenPhone) {
      patch.carrier = carrierDraft
      patch.twilio_forwarding_code = forwardingActivationSnippet(carrierDraft, margenPhone)
    } else if (carrierDraft && CARRIER_OPTIONS.some((c) => c.id === carrierDraft)) {
      patch.carrier = carrierDraft
    }
    const { error } = await supabase.from('profiles').update(patch as never).eq('id', user.id)
    if (error) setCallSetupError(error.message)
    else setCallSetupOk('Call preferences saved.')
    setCallSetupBusy(false)
  }

  async function persistCarrierChoice(c: CarrierId) {
    setCarrierDraft(c)
    if (!user || !margenPhone) return
    setCallSetupError(null)
    const code = forwardingActivationSnippet(c, margenPhone)
    const { error } = await supabase
      .from('profiles')
      .update({ carrier: c, twilio_forwarding_code: code } as never)
      .eq('id', user.id)
    if (error) setCallSetupError(error.message)
  }

  async function handleForwardingSms() {
    setCallSmsBusy(true)
    setCallSetupError(null)
    setCallSetupOk(null)
    const { error } = await sendMargenForwardingSms(supabase)
    setCallSmsBusy(false)
    if (error) setCallSetupError(error.message)
    else setCallSetupOk('We texted your business phone with the forwarding steps.')
  }

  async function handleTestAiCall() {
    setCallTestBusy(true)
    setCallSetupError(null)
    setCallSetupOk(null)
    const { error } = await retellTestCallDemo(supabase)
    setCallTestBusy(false)
    if (error) setCallSetupError(error.message)
    else setCallSetupOk('Placing a test call to your business phone — pick up to hear your AI receptionist.')
  }

  async function handleChangeMargenNumber() {
    if (!user) return
    if (
      !window.confirm(
        'Change your Margen AI number? The current number will be released and may not be available again.',
      )
    ) {
      return
    }
    setCallChangeBusy(true)
    setCallSetupError(null)
    setCallSetupOk(null)
    try {
      const ac = guessAreaCodeForProvisioning(serviceAreaSnapshot.business_address, businessPhoneDraft.trim() || null)
      const { error: provErr } = await provisionMargenTwilioNumber(supabase, { area_code: ac, replace_existing: true })
      if (provErr) throw provErr
      const { data: p2, error: e2 } = await supabase
        .from('profiles')
        .select('margen_phone_number, margen_phone_sid')
        .eq('id', user.id)
        .maybeSingle()
      if (e2) throw new Error(e2.message)
      setMargenPhone((p2 as { margen_phone_number?: string | null })?.margen_phone_number ?? null)
      setMargenPhoneSid((p2 as { margen_phone_sid?: string | null })?.margen_phone_sid ?? null)
      setCallSetupOk('Your new Margen number is ready.')
    } catch (e) {
      setCallSetupError(e instanceof Error ? e.message : 'Could not change the number.')
    } finally {
      setCallChangeBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">
          Company profile, payments, integrations, and accent color.
        </p>
      </motion.div>

      <div className="space-y-10">
        <section>
          <h2 className="section-title">
            Business profile
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            These settings power branding, call matching, and service area.
          </p>
          <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Company name
              </label>
              <input
                value={companyDraft}
                onChange={(e) => setCompanyDraft(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="Your company"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Logo URL
              </label>
              <input
                value={logoUrlDraft}
                onChange={(e) => setLogoUrlDraft(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Business phone number
              </label>
              <input
                value={businessPhoneDraft}
                onChange={(e) => setBusinessPhoneDraft(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="+15551234567"
              />
              <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                Set your existing business number to enable click-to-callback and call routing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                After-hours message
              </label>
              <input
                value={afterHoursMsgDraft}
                onChange={(e) => setAfterHoursMsgDraft(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="Thanks for calling — we’re closed right now…"
              />
            </div>

            <div className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-margen-text)]">Business hours</p>
                  <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                    When enabled, calls outside business hours will play the after-hours message and route to the AI receptionist.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBizHoursEnabled((v) => !v)}
                  className={[
                    'rounded-md border px-3 py-1.5 text-xs font-medium',
                    bizHoursEnabled
                      ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                      : 'border-[var(--color-margen-border)] text-[var(--color-margen-muted)] hover:bg-[var(--color-margen-hover)] hover:text-[var(--color-margen-text)]',
                  ].join(' ')}
                >
                  {bizHoursEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                    Open (Mon–Fri)
                  </label>
                  <input
                    value={bizHoursOpenDraft}
                    onChange={(e) => setBizHoursOpenDraft(e.target.value)}
                    className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                    Close (Mon–Fri)
                  </label>
                  <input
                    value={bizHoursCloseDraft}
                    onChange={(e) => setBizHoursCloseDraft(e.target.value)}
                    className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                    placeholder="17:00"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--color-margen-border)] pt-5">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[var(--color-margen-text)]">Service area</p>
                <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                  Set where you operate and how far you travel. Your map, presets, and coverage summary save with business settings.
                </p>
              </div>
              <ServiceAreaEditor
                resetToken={serviceAreaResetToken}
                initial={serviceAreaInitial}
                onChange={onServiceAreaChange}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>{bizError ? <p className="text-sm text-danger">{bizError}</p> : null}</div>
              <button
                type="button"
                disabled={bizBusy}
                onClick={() => void saveBusinessSettings()}
                className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
              >
                Save business settings
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">
            AI call setup
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Your Margen phone line receives forwarded missed calls, then routes callers to your AI receptionist.
          </p>
          <div className="mt-4 rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                  Margen AI number
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-[var(--color-margen-text)]">
                  {margenPhone ? formatUsDisplay(margenPhone) : 'Not set up yet'}
                </p>
              </div>
              <span
                className={[
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                  callForwardingActive ? 'badge-available' : 'badge-pending',
                ].join(' ')}
              >
                {callForwardingActive ? 'Active' : 'Not set up yet'}
              </span>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--color-margen-muted)]">
              Your business cell carrier
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CARRIER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => void persistCarrierChoice(opt.id)}
                  className={[
                    'rounded-full border px-2 py-2 text-xs font-medium transition sm:text-sm',
                    carrierDraft === opt.id
                      ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                      : 'border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] text-[var(--color-margen-text)] hover:border-[var(--margen-accent)]/40',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {margenPhone && carrierDraft ? (
              <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-3">
                <p className="text-xs text-[var(--color-margen-muted)]">Forwarding activation</p>
                <p className="mt-1 text-sm font-semibold text-[var(--margen-accent)]">
                  {forwardingActivationSnippet(carrierDraft, margenPhone)}
                </p>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-[var(--color-margen-text)]">Rings before AI picks up</label>
                <span className="font-mono text-sm text-[var(--margen-accent)]">{ringsBeforeAiDraft}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={ringsBeforeAiDraft}
                onChange={(e) => setRingsBeforeAiDraft(e.target.value)}
                className="mt-2 w-full accent-[var(--margen-accent)]"
              />
              <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                How long your phone rings before the call goes to your Margen line (about 6 seconds per ring).
              </p>
            </div>

            {!callForwardingActive ? (
              <button
                type="button"
                className="mt-4 text-left text-xs font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline"
                onClick={async () => {
                  if (!user) return
                  setCallSetupError(null)
                  const { error } = await supabase
                    .from('profiles')
                    .update({ call_forwarding_active: true } as never)
                    .eq('id', user.id)
                  if (error) setCallSetupError(error.message)
                  else setCallForwardingActive(true)
                }}
              >
                I&apos;ve turned on forwarding — mark as active
              </button>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={callSmsBusy || !margenPhone}
                onClick={() => void handleForwardingSms()}
                className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-margen-text)] hover:border-[var(--margen-accent)]/45 disabled:opacity-50"
              >
                {callSmsBusy ? 'Sending…' : 'Send forwarding code to my phone'}
              </button>
              <button
                type="button"
                disabled={callTestBusy || !margenPhone}
                onClick={() => void handleTestAiCall()}
                className="rounded-lg bg-[var(--margen-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-50"
              >
                {callTestBusy ? 'Calling…' : 'Test AI receptionist'}
              </button>
              <button
                type="button"
                disabled={callChangeBusy || !margenPhoneSid}
                onClick={() => void handleChangeMargenNumber()}
                className="rounded-lg border border-[var(--color-margen-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-50"
              >
                {callChangeBusy ? 'Working…' : 'Change number'}
              </button>
              <button
                type="button"
                disabled={callSetupBusy}
                onClick={() => void saveCallPreferences()}
                className="rounded-lg border border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent)] disabled:opacity-50"
              >
                {callSetupBusy ? 'Saving…' : 'Save call preferences'}
              </button>
            </div>
            <Link
              to="/onboarding/call-setup"
              className="mt-3 inline-block text-xs font-medium text-[var(--margen-accent)] underline-offset-2 hover:underline"
            >
              Open full-screen setup wizard
            </Link>
            {callSetupError ? <p className="mt-3 text-sm text-danger">{callSetupError}</p> : null}
            {callSetupOk ? (
              <p className="mt-3 rounded-md px-3 py-2 text-sm alert-success">{callSetupOk}</p>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="section-title">
            AI Receptionist
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Build your call flow, choose a voice, set business hours, and deploy to your phone agent.
          </p>
          <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            <button
              type="button"
              onClick={() => window.location.assign('/settings/ai-receptionist')}
              className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)]"
            >
              Open AI Receptionist settings
            </button>
          </div>
        </section>

        <section>
          <h2 className="section-title">
            VIP customers
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Customers are flagged VIP when lifetime value exceeds your threshold.
          </p>
          <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
              VIP lifetime value threshold (USD)
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={vipDraft}
                onChange={(e) => setVipDraft(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="2000"
              />
              <button
                type="button"
                disabled={vipBusy}
                onClick={() => void saveVipThreshold()}
                className="shrink-0 rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
              Current: {vipThresholdCents == null ? '—' : `$${(vipThresholdCents / 100).toFixed(0)}`}
            </p>
            {vipError ? <p className="mt-2 text-sm text-danger">{vipError}</p> : null}
          </div>
        </section>

        <section>
          <h2 className="section-title">
            Margen subscription
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Your workspace plan is billed separately from Stripe Connect (customer invoice payments).
          </p>
          {isDevBypassEmail(user?.email) ? (
            <div className="mt-3 rounded-md px-3 py-2 text-xs alert-success">
              <span className="font-semibold">Developer access.</span> This workspace is tied to a dev email — you can
              test the full product without an active Margen subscription or card charges. Plan limits in the app match
              Scale for QA.
            </div>
          ) : null}
          <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            {saasSubscription ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-[var(--color-margen-text)]">
                      {planById(saasSubscription.plan)?.name ?? saasSubscription.plan} plan
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                      {planById(saasSubscription.plan)
                        ? `$${planById(saasSubscription.plan)!.priceUsd.toLocaleString()} / month`
                        : '—'}
                      <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                      Status: <span className="font-medium text-[var(--color-margen-text)]">{saasSubscription.status}</span>
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                      Next billing:{' '}
                      {saasSubscription.current_period_end
                        ? new Date(saasSubscription.current_period_end).toLocaleDateString(undefined, {
                            dateStyle: 'medium',
                          })
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/pricing"
                    className="inline-flex items-center justify-center rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)]"
                  >
                    Upgrade plan
                  </Link>
                  <button
                    type="button"
                    disabled={billingBusy || ['canceled', 'unpaid', 'incomplete_expired'].includes(saasSubscription.status)}
                    onClick={() => void handleCancelSubscription()}
                    className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-50"
                  >
                    Cancel subscription
                  </button>
                  <button
                    type="button"
                    disabled={billingBusy}
                    onClick={() => void handleBillingPortal()}
                    className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-50"
                  >
                    Manage billing
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--color-margen-muted)]">No active Margen subscription on file yet.</p>
                <Link
                  to="/pricing"
                  className="inline-flex shrink-0 items-center justify-center rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)]"
                >
                  View plans
                </Link>
              </div>
            )}
            {billingError ? <p className="mt-3 text-sm text-danger">{billingError}</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-4 py-4">
          <h2 className="section-title">
            Stripe in Margen — quick guide
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--color-margen-muted)]">
            <li>
              <span className="font-medium text-[var(--color-margen-text)]">Paying Margen (subscription)</span> — Your
              Starter / Growth / Scale plan is billed by Margen through Stripe Checkout or the customer portal. You never
              paste an API key for that; use <strong className="text-[var(--color-margen-text)]">View plans</strong> /{' '}
              <strong className="text-[var(--color-margen-text)]">Manage billing</strong> above.
            </li>
            <li>
              <span className="font-medium text-[var(--color-margen-text)]">Your business Stripe (customers)</span> —{' '}
              <strong className="text-[var(--color-margen-text)]">Stripe Connect</strong> links{' '}
              <em>your</em> Stripe account so customer invoice payments can go to your bank.
            </li>
            <li>
              <span className="font-medium text-[var(--color-margen-text)]">Charts &amp; Revenue (optional)</span> — To
              graph <em>your</em> money movement in Margen, paste a key from <strong className="text-[var(--color-margen-text)]">your</strong>{' '}
              Stripe Dashboard → Developers → API keys (secret key <code className="rounded bg-[var(--color-margen-surface-elevated)] px-1 text-xs">sk_…</code>) or create a{' '}
              <strong className="text-[var(--color-margen-text)]">restricted</strong> key (
              <code className="rounded bg-[var(--color-margen-surface-elevated)] px-1 text-xs">rk_…</code>) with permission to{' '}
              <strong className="text-[var(--color-margen-text)]">read Balance Transactions</strong>. That key is only for
              pulling ledger data into Margen — it is not your Margen subscription charge.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="section-title">
            Payments (Stripe)
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Connect your business Stripe account for customer payments. Optionally add an API key from the same account for
            analytics charts.
          </p>

          <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-margen-text)]">Stripe Connect</p>
                <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                  {stripeAccountId ? (
                    <>
                      Account: <span className="font-mono">{stripeAccountId}</span>
                      <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                      Charges enabled: <span className="font-medium">{stripeEnabled ? 'Yes' : 'No'}</span>
                    </>
                  ) : (
                    'Not connected yet.'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={stripeBusy}
                  onClick={() => void startStripeConnect()}
                  className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
                >
                  {stripeAccountId ? 'Reconnect Stripe' : 'Connect Stripe'}
                </button>
                <button
                  type="button"
                  disabled={stripeBusy || !stripeAccountId}
                  onClick={() => void syncStripeConnect()}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
                >
                  Refresh status
                </button>
              </div>
            </div>
            {stripeDetailsSubmitted === false ? (
              <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                Stripe onboarding not completed yet. Finish onboarding to accept payments.
              </p>
            ) : null}
            {stripeError ? <p className="mt-2 text-sm text-danger">{stripeError}</p> : null}
          </div>

          <div className="mt-4 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4">
            <p className="text-sm font-medium text-[var(--color-margen-text)]">Stripe account analytics</p>
            <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
              Use a <strong className="text-[var(--color-margen-text)]">secret</strong> or{' '}
              <strong className="text-[var(--color-margen-text)]">restricted</strong> key from{' '}
              <em>your</em> Stripe account (dashboard.stripe.com → Developers → API keys). Margen encrypts it and syncs
              Balance Transactions for Revenue / Dashboard — separate from your Margen subscription billing.
            </p>
            {stripeAnalyticsHint ? (
              <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                Saved key <span className="font-mono text-[var(--color-margen-text)]">{stripeAnalyticsHint}</span>
                <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                Last sync:{' '}
                <span className="font-medium text-[var(--color-margen-text)]">
                  {stripeAnalyticsLastSyncAt
                    ? new Date(stripeAnalyticsLastSyncAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                    : 'Never'}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--color-margen-muted)]">No analytics key saved yet.</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={stripeAnalyticsOpBusy}
                onClick={() => {
                  setStripeAnalyticsOpError(null)
                  setStripeAnalyticsModalOpen(true)
                }}
                className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
              >
                {stripeAnalyticsHint ? 'Change API key…' : 'Add API key…'}
              </button>
              <button
                type="button"
                disabled={stripeAnalyticsOpBusy || !stripeAnalyticsHint}
                onClick={() => void handleSyncStripeLedger()}
                className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
              >
                {stripeAnalyticsOpBusy ? 'Syncing…' : 'Sync from Stripe'}
              </button>
            </div>
            {stripeAnalyticsOpError ? <p className="mt-2 text-sm text-danger">{stripeAnalyticsOpError}</p> : null}
          </div>
        </section>

        <StripeAnalyticsSetupModal
          open={stripeAnalyticsModalOpen}
          onClose={() => setStripeAnalyticsModalOpen(false)}
          onSaved={() => void refreshStripeAnalyticsFromProfile()}
          hasExistingKey={Boolean(stripeAnalyticsHint)}
        />

        <section>
          <h2 className="section-title">
            Accent color
          </h2>
          <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
            Used for primary actions, active navigation, links, and highlights.
          </p>
          <div className="mt-4 space-y-4">
            <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)] p-3">
              <HexColorPicker
                color={accentHex}
                onChange={(c) => setAccentHex(c)}
                style={{ width: '100%', height: 180 }}
              />
            </div>
            <div>
              <label htmlFor="accent-hex" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
                Hex code
              </label>
              <input
                id="accent-hex"
                type="text"
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={() => {
                  const parsed = tryParseHex(hexDraft)
                  if (parsed) setAccentHex(parsed)
                  else setHexDraft(accentHex)
                }}
                placeholder="#FF5733"
                spellCheck={false}
                className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              />
            </div>
          </div>
        </section>

        {persistError ? <p className="text-sm text-danger">{persistError}</p> : null}
        {saving ? <p className="text-sm text-[var(--color-margen-muted)]">Saving…</p> : null}
      </div>
    </div>
  )
}
