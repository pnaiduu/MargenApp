import { motion } from 'framer-motion'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { easePremium } from '../lib/motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/useAuth'
import {
  parseCoveredCities,
  ServiceAreaEditor,
  type ServiceAreaInitial,
  type ServiceAreaSnapshot,
} from '../components/settings/ServiceAreaEditor'
import { cancelSubscriptionAtPeriodEnd, openStripeBillingPortal } from '../lib/stripeSubscription'
import { planById, type SubscriptionRow } from '../lib/plans'
import {
  effectiveSubscriptionRow,
  getTechnicianLimit,
  isDevBypassEmail,
} from '../lib/subscriptionAccess'
import { OPEN_TEAM_INVITE_NAME } from '../lib/teamInvite'

const PAGE_BG = '#fafaf8'
const CARD_BORDER = '#ebebeb'

const NAV: { id: string; label: string }[] = [
  { id: 'profile', label: 'Business profile' },
  { id: 'service-area', label: 'Service Area' },
  { id: 'operations', label: 'Operations' },
  { id: 'subscription', label: 'Subscription' },
]

function scrollToSection(id: string) {
  document.getElementById(`settings-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SettingsSectionCard({
  id,
  title,
  children,
  footer,
}: {
  id: string
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <section id={`settings-section-${id}`} className="scroll-mt-8">
      <div
        className="rounded-xl border bg-white p-6 shadow-sm"
        style={{ borderColor: CARD_BORDER }}
      >
        <h2 className="text-[18px] font-medium leading-snug text-[#111111]">{title}</h2>
        <div className="mt-5">{children}</div>
        {footer ? (
          <div
            className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-5"
            style={{ borderColor: CARD_BORDER }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function SettingsPage() {
  const location = useLocation()
  const { user } = useAuth()

  const [companyDraft, setCompanyDraft] = useState('')
  const [businessPhoneDraft, setBusinessPhoneDraft] = useState('')
  const [serviceAreaSnapshot, setServiceAreaSnapshot] = useState<ServiceAreaSnapshot>({
    business_address: null,
    business_lat: null,
    business_lng: null,
    service_radius_miles: null,
    covered_cities: [],
  })
  const [serviceAreaInitial, setServiceAreaInitial] = useState<ServiceAreaInitial | null>(null)
  const [serviceAreaResetToken, setServiceAreaResetToken] = useState(0)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileOk, setProfileOk] = useState<string | null>(null)
  const [areaBusy, setAreaBusy] = useState(false)
  const [areaError, setAreaError] = useState<string | null>(null)
  const [areaOk, setAreaOk] = useState<string | null>(null)
  const [saasSubscription, setSaasSubscription] = useState<SubscriptionRow | null>(null)
  const [technicianCount, setTechnicianCount] = useState(0)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const [autoAssignJobs, setAutoAssignJobs] = useState(true)
  const [autoSortSchedule, setAutoSortSchedule] = useState(true)
  const [operationsBusy, setOperationsBusy] = useState(false)
  const [operationsError, setOperationsError] = useState<string | null>(null)

  useEffect(() => {
    const raw = location.hash?.replace(/^#/, '') ?? ''
    const id = raw.startsWith('settings-section-')
      ? raw
      : raw
        ? `settings-section-${raw}`
        : ''
    if (!id) return
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    async function load() {
      const [profRes, subRes, techCountRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'company_name, business_phone, auto_assign_jobs, auto_sort_schedule, business_address, business_lat, business_lng, service_radius_miles, covered_cities, service_area_center_lat, service_area_center_lng, service_area_radius',
          )
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, stripe_customer_id, stripe_subscription_id')
          .eq('owner_id', userId)
          .maybeSingle(),
        supabase
          .from('technicians')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .neq('name', OPEN_TEAM_INVITE_NAME),
      ])
      if (cancelled) return
      const { data, error } = profRes
      if (error) {
        setProfileError(error.message)
        return
      }
      if (!subRes.error && subRes.data) {
        setSaasSubscription(subRes.data as SubscriptionRow)
      } else {
        setSaasSubscription(null)
      }
      setTechnicianCount(techCountRes.count ?? 0)
      setCompanyDraft(data?.company_name ?? '')
      setBusinessPhoneDraft(data?.business_phone ?? '')
      setAutoAssignJobs((data as { auto_assign_jobs?: boolean }).auto_assign_jobs !== false)
      setAutoSortSchedule((data as { auto_sort_schedule?: boolean }).auto_sort_schedule !== false)
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
    }
    void load()
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

  async function saveProfileSection() {
    if (!user) return
    setProfileBusy(true)
    setProfileError(null)
    setProfileOk(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        company_name: companyDraft.trim() || null,
        business_phone: businessPhoneDraft.trim() || null,
      } as never)
      .eq('id', user.id)
    if (error) setProfileError(error.message)
    else setProfileOk('Profile saved.')
    setProfileBusy(false)
  }

  async function persistOperationsSetting(
    field: 'auto_assign_jobs' | 'auto_sort_schedule',
    value: boolean,
  ) {
    if (!user) return
    setOperationsBusy(true)
    setOperationsError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value } as never)
      .eq('id', user.id)
    if (error) {
      setOperationsError(error.message)
      if (field === 'auto_assign_jobs') setAutoAssignJobs(!value)
      else setAutoSortSchedule(!value)
    }
    setOperationsBusy(false)
  }

  async function saveServiceAreaSection() {
    if (!user) return
    setAreaBusy(true)
    setAreaError(null)
    setAreaOk(null)
    const lat = serviceAreaSnapshot.business_lat
    const lng = serviceAreaSnapshot.business_lng
    const radius = serviceAreaSnapshot.service_radius_miles
    if (lat != null && !Number.isFinite(lat)) {
      setAreaError('Latitude is invalid.')
      setAreaBusy(false)
      return
    }
    if (lng != null && !Number.isFinite(lng)) {
      setAreaError('Longitude is invalid.')
      setAreaBusy(false)
      return
    }
    if (radius != null && (!Number.isFinite(radius) || radius < 0)) {
      setAreaError('Radius is invalid.')
      setAreaBusy(false)
      return
    }
    if (lat == null || lng == null || radius == null) {
      setAreaError('Choose a location on the map and a service radius.')
      setAreaBusy(false)
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        business_address: serviceAreaSnapshot.business_address,
        business_lat: lat,
        business_lng: lng,
        service_radius_miles: radius,
        covered_cities: serviceAreaSnapshot.covered_cities,
        service_area_center_lat: lat,
        service_area_center_lng: lng,
        service_area_radius: radius,
      } as never)
      .eq('id', user.id)
    if (error) setAreaError(error.message)
    else setAreaOk('Service area saved.')
    setAreaBusy(false)
  }

  const fieldClass =
    'w-full rounded-lg border border-[#ebebeb] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[var(--margen-accent)] focus:ring-2 focus:ring-[var(--margen-accent-muted)]'
  const labelClass = 'mb-1.5 block text-xs font-medium text-[#555555]'

  const effectiveSub = effectiveSubscriptionRow(saasSubscription, user?.email)
  const subscriptionPlanId = effectiveSub?.plan ?? 'starter'
  const technicianLimit = getTechnicianLimit(subscriptionPlanId)
  const technicianUsageLabel = Number.isFinite(technicianLimit)
    ? `${technicianCount} / ${technicianLimit} technicians`
    : `${technicianCount} / unlimited technicians`
  const showPlanUpgrade = subscriptionPlanId !== 'scale'
  const hasSubscriptionCard = Boolean(saasSubscription) || isDevBypassEmail(user?.email)

  return (
    <div className="min-h-dvh" style={{ backgroundColor: PAGE_BG }}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
        >
          <h1 className="page-title">Settings</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#555555]">
            Manage your workspace and team settings.
          </p>
        </motion.div>

        <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">
          <aside className="shrink-0 lg:w-52">
            <nav className="sticky top-8 space-y-0.5 rounded-xl border border-[#ebebeb] bg-white p-2 shadow-sm">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#555555] transition hover:bg-[#f5f5f5] hover:text-[#111111]"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 space-y-8 pb-16">
            <SettingsSectionCard
              id="profile"
              title="Business profile"
              footer={
                <>
                  {profileError ? <p className="mr-auto text-sm text-danger">{profileError}</p> : null}
                  {profileOk ? <p className="mr-auto text-sm text-[#555555]">{profileOk}</p> : null}
                  <button
                    type="button"
                    disabled={profileBusy}
                    onClick={() => void saveProfileSection()}
                    className="rounded-lg bg-[var(--margen-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
                  >
                    {profileBusy ? 'Saving…' : 'Save'}
                  </button>
                </>
              }
            >
              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="settings-company">
                    Company name
                  </label>
                  <input
                    id="settings-company"
                    value={companyDraft}
                    onChange={(e) => setCompanyDraft(e.target.value)}
                    className={fieldClass}
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="settings-phone">
                    Business phone number
                  </label>
                  <input
                    id="settings-phone"
                    value={businessPhoneDraft}
                    onChange={(e) => setBusinessPhoneDraft(e.target.value)}
                    className={`${fieldClass} font-mono`}
                    placeholder="+15551234567"
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-[#888888]">
                    Your main business line for customer contact.
                  </p>
                </div>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              id="service-area"
              title="Service area"
              footer={
                <>
                  {areaError ? <p className="mr-auto text-sm text-danger">{areaError}</p> : null}
                  {areaOk ? <p className="mr-auto text-sm text-[#555555]">{areaOk}</p> : null}
                  <button
                    type="button"
                    disabled={areaBusy}
                    onClick={() => void saveServiceAreaSection()}
                    className="rounded-lg bg-[var(--margen-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
                  >
                    {areaBusy ? 'Saving…' : 'Save'}
                  </button>
                </>
              }
            >
              <ServiceAreaEditor
                resetToken={serviceAreaResetToken}
                initial={serviceAreaInitial}
                onChange={onServiceAreaChange}
              />
            </SettingsSectionCard>

            <SettingsSectionCard id="operations" title="Operations">
              <p className="text-sm leading-relaxed text-[#555555]">
                Control how new jobs are assigned and how your schedule is ordered.
              </p>
              {operationsError ? (
                <p className="mt-4 text-sm text-danger" role="alert">
                  {operationsError}
                </p>
              ) : null}
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-[#ebebeb] bg-[#fafafa] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111111]">Auto-assign jobs</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#888888]">
                        When on, new jobs are assigned to the best available technician by location and availability.
                        When off, jobs stay unassigned until you assign them manually.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium tabular-nums text-[#555555]">
                        {autoAssignJobs ? 'On' : 'Off'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoAssignJobs}
                        disabled={operationsBusy}
                        onClick={() => {
                          const next = !autoAssignJobs
                          setAutoAssignJobs(next)
                          void persistOperationsSetting('auto_assign_jobs', next)
                        }}
                        className={[
                          'relative h-8 w-14 rounded-full border transition disabled:opacity-60',
                          autoAssignJobs
                            ? 'border-[var(--margen-accent)] bg-[var(--margen-accent)]'
                            : 'border-[#ebebeb] bg-[#e8e8e8]',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
                            autoAssignJobs ? 'left-7' : 'left-1',
                          ].join(' ')}
                        />
                        <span className="sr-only">{autoAssignJobs ? 'On' : 'Off'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#ebebeb] bg-[#fafafa] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111111]">Auto-sort schedule</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#888888]">
                        When on, the schedule is optimized by location and urgency. When off, you control job order
                        manually on the schedule page.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium tabular-nums text-[#555555]">
                        {autoSortSchedule ? 'On' : 'Off'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={autoSortSchedule}
                        disabled={operationsBusy}
                        onClick={() => {
                          const next = !autoSortSchedule
                          setAutoSortSchedule(next)
                          void persistOperationsSetting('auto_sort_schedule', next)
                        }}
                        className={[
                          'relative h-8 w-14 rounded-full border transition disabled:opacity-60',
                          autoSortSchedule
                            ? 'border-[var(--margen-accent)] bg-[var(--margen-accent)]'
                            : 'border-[#ebebeb] bg-[#e8e8e8]',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition',
                            autoSortSchedule ? 'left-7' : 'left-1',
                          ].join(' ')}
                        />
                        <span className="sr-only">{autoSortSchedule ? 'On' : 'Off'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard id="subscription" title="Subscription">
              <div className="flex flex-wrap items-center gap-2">
                {isDevBypassEmail(user?.email) ? (
                  <span className="inline-flex rounded-full border border-[#ebebeb] bg-[#f0f0f0] px-2.5 py-0.5 text-[11px] font-medium text-[#666666]">
                    Dev account · full access (Scale)
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-[#555555]">
                <span className="text-[#888888]">Technicians on your plan</span>{' '}
                <span className="font-medium text-[#111111]">{technicianUsageLabel}</span>
              </p>

              <div className="mt-5 rounded-xl border border-[#ebebeb] bg-[#fafafa] p-5">
                {hasSubscriptionCard && effectiveSub ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold capitalize text-[#111111]">
                          {planById(effectiveSub.plan)?.name ?? effectiveSub.plan}
                        </p>
                        <p className="mt-1 text-sm text-[#555555]">
                          {(() => {
                            const p = planById(effectiveSub.plan)
                            if (!p || !Number.isFinite(p.priceUsd) || p.priceUsd <= 0) return '—'
                            return `$${p.priceUsd.toLocaleString()} / month`
                          })()}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium capitalize text-[#111111] ring-1 ring-[#ebebeb]">
                        {effectiveSub.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#555555]">
                      <span className="text-[#888888]">Next billing</span>{' '}
                      <span className="font-medium text-[#111111]">
                        {effectiveSub.current_period_end
                          ? new Date(effectiveSub.current_period_end).toLocaleDateString(undefined, {
                              dateStyle: 'long',
                            })
                          : '—'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {showPlanUpgrade ? (
                        <Link
                          to="/pricing"
                          className="inline-flex items-center justify-center rounded-lg bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)]"
                        >
                          Upgrade plan
                        </Link>
                      ) : null}
                      <Link
                        to="/pricing"
                        className="inline-flex items-center justify-center rounded-lg border border-[#ebebeb] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5]"
                      >
                        {showPlanUpgrade ? 'View plans' : 'Change plan'}
                      </Link>
                      {saasSubscription && !isDevBypassEmail(user?.email) ? (
                        <>
                          <button
                            type="button"
                            disabled={
                              billingBusy ||
                              ['canceled', 'unpaid', 'incomplete_expired'].includes(saasSubscription.status)
                            }
                            onClick={() => void handleCancelSubscription()}
                            className="rounded-lg border border-[#ebebeb] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5] disabled:opacity-50"
                          >
                            Cancel at period end
                          </button>
                          <button
                            type="button"
                            disabled={billingBusy}
                            onClick={() => void handleBillingPortal()}
                            className="rounded-lg border border-[#ebebeb] bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#f5f5f5] disabled:opacity-50"
                          >
                            Manage billing
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#555555]">No active Margen subscription on file yet.</p>
                    <Link
                      to="/pricing"
                      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)]"
                    >
                      View plans
                    </Link>
                  </div>
                )}
                {billingError ? <p className="mt-3 text-sm text-danger">{billingError}</p> : null}
              </div>
            </SettingsSectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
