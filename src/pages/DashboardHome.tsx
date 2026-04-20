import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { sweepOverduePaymentConfirmations } from '../lib/paymentConfirmationSweep'
import { supabase } from '../lib/supabase'
import { lastNDaysStartIso, utcDayKey } from '../lib/dates'
import { easePremium, staggerContainer, staggerItem } from '../lib/motion'
import { localDayRangeIso } from '../lib/todayRange'
import { MargenLogo } from '../components/branding/MargenLogo'
import { useWorkspaceAccess } from '../contexts/workspace-access-context'
import { DashboardRevenueChart, type DailyRevenue } from '../components/dashboard/DashboardRevenueChart'
import { MissedCallsPanel, type MissedCallRow } from '../components/dashboard/MissedCallsPanel'
import { RecentJobsPanel, type RecentJobRow } from '../components/dashboard/RecentJobsPanel'
import { TechniciansMap, type TechMapPoint } from '../components/dashboard/TechniciansMap'
import { formatUsdFromCents } from '../lib/formatUsd'

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="margen-card"
      layout
      transition={{ duration: 0.2, ease: easePremium }}
    >
      <p className="label-caps">{label}</p>
      <motion.p
        className="mt-2 text-[32px] font-semibold leading-none tabular-nums text-[#111111]"
        key={value}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: easePremium }}
      >
        {value}
      </motion.p>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-[#888888]">{hint}</p> : null}
    </motion.div>
  )
}

function buildLast30DaysRevenue(rows: { revenue_cents: number; completed_at: string | null }[]): DailyRevenue[] {
  const startIso = lastNDaysStartIso(30)
  const anchor = new Date(startIso)
  const byDay = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(anchor)
    d.setUTCDate(anchor.getUTCDate() + i)
    byDay.set(utcDayKey(d.toISOString()), 0)
  }
  for (const row of rows) {
    if (!row.completed_at) continue
    const key = utcDayKey(row.completed_at)
    if (!byDay.has(key)) continue
    byDay.set(key, (byDay.get(key) ?? 0) + (row.revenue_cents ?? 0) / 100)
  }
  return Array.from(byDay.entries()).map(([iso, revenue]) => ({
    day: iso.slice(5),
    revenue,
  }))
}

function buildLast30DaysStripeNet(rows: { amount_cents: number; stripe_created_at: string }[]): DailyRevenue[] {
  const startIso = lastNDaysStartIso(30)
  const anchor = new Date(startIso)
  const byDay = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(anchor)
    d.setUTCDate(anchor.getUTCDate() + i)
    byDay.set(utcDayKey(d.toISOString()), 0)
  }
  for (const row of rows) {
    const key = utcDayKey(row.stripe_created_at)
    if (!byDay.has(key)) continue
    byDay.set(key, (byDay.get(key) ?? 0) + (row.amount_cents ?? 0) / 100)
  }
  return Array.from(byDay.entries()).map(([iso, revenue]) => ({
    day: iso.slice(5),
    revenue,
  }))
}

function friendlyBlockedPath(p: string | undefined): string {
  if (p === '/calls' || p?.startsWith('/calls')) return 'Calls & leads'
  if (p === '/hours' || p?.startsWith('/hours')) return 'Hours & attendance'
  return 'That area'
}

export function DashboardHome() {
  const { user } = useAuth()
  const { hasPaidSaas, isDevBypass } = useWorkspaceAccess()
  const needsMargenPlan = !isDevBypass && !hasPaidSaas
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subscriptionThanks, setSubscriptionThanks] = useState(false)
  const [planUpgradeHint, setPlanUpgradeHint] = useState<string | null>(null)
  const [jobsToday, setJobsToday] = useState<number | null>(null)
  const [techActive, setTechActive] = useState<number | null>(null)
  const [revenueToday, setRevenueToday] = useState<number | null>(null)
  const [missedCallsStat, setMissedCallsStat] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statsReady, setStatsReady] = useState(false)

  const [technicians, setTechnicians] = useState<TechMapPoint[]>([])
  const [revenueSeries, setRevenueSeries] = useState<DailyRevenue[]>([])
  const [stripeNetSeries, setStripeNetSeries] = useState<DailyRevenue[]>([])
  const [stripeLedgerHasRows, setStripeLedgerHasRows] = useState(false)
  const [recentJobs, setRecentJobs] = useState<RecentJobRow[]>([])
  const [missedRows, setMissedRows] = useState<MissedCallRow[]>([])

  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [checklistDoneAt, setChecklistDoneAt] = useState<string | null>(null)
  const [setup, setSetup] = useState<{
    companyName: boolean
    aiReceptionist: boolean
    firstTechnician: boolean
    serviceArea: boolean
    stripe: boolean
  } | null>(null)

  useEffect(() => {
    if (!user) return
    void sweepOverduePaymentConfirmations(supabase, user.id)
  }, [user])

  useEffect(() => {
    if (searchParams.get('subscription') !== 'success') return
    setSubscriptionThanks(true)
    const next = new URLSearchParams(searchParams)
    next.delete('subscription')
    setSearchParams(next, { replace: true })
    const t = window.setTimeout(() => setSubscriptionThanks(false), 9000)
    return () => window.clearTimeout(t)
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const sid = searchParams.get('session_id')
    if (!sid) return
    setSubscriptionThanks(true)
    const next = new URLSearchParams(searchParams)
    next.delete('session_id')
    const qs = next.toString()
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
    const t = window.setTimeout(() => setSubscriptionThanks(false), 12_000)
    return () => window.clearTimeout(t)
  }, [searchParams, navigate, location.pathname])

  useEffect(() => {
    const st = location.state as { planUpgradeRequired?: boolean; blockedPath?: string } | undefined
    if (!st?.planUpgradeRequired) return
    const label = friendlyBlockedPath(st.blockedPath)
    setPlanUpgradeHint(
      `${label} is included on Growth and Scale. Upgrade under Settings → Margen subscription, or view plans on Pricing.`,
    )
    navigate('.', { replace: true, state: {} })
    const t = window.setTimeout(() => setPlanUpgradeHint(null), 12_000)
    return () => window.clearTimeout(t)
  }, [location.state, navigate])

  const reloadMissed = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('phone_calls')
      .select('id, caller_phone, occurred_at, estimated_value_cents')
      .eq('owner_id', user.id)
      .eq('status', 'missed')
      .order('occurred_at', { ascending: false })
      .limit(10)
    if (!error && data) setMissedRows(data as MissedCallRow[])
  }, [user])

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    const { startIso, endIso } = localDayRangeIso()
    const thirtyStart = lastNDaysStartIso(30)

    setStatsReady(false)

    async function load() {
      setLoadError(null)

      const s = ac.signal

      const profileQ = supabase
        .from('profiles')
        .select(
          'company_name, business_phone, service_area_center_lat, service_area_center_lng, service_area_radius, onboarding_welcome_dismissed, onboarding_completed_at, stripe_charges_enabled',
        )
        .eq('id', ownerId)
        .abortSignal(s)
        .maybeSingle()

      const aiRsQ = supabase
        .from('ai_receptionist_settings')
        .select('retell_agent_id')
        .eq('owner_id', ownerId)
        .abortSignal(s)
        .maybeSingle()

      const techCountQ = supabase
        .from('technicians')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .abortSignal(s)

      const jobsQ = supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .gte('scheduled_at', startIso)
        .lte('scheduled_at', endIso)
        .abortSignal(s)

      const techQ = supabase
        .from('technicians')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .in('status', ['available', 'busy'])
        .abortSignal(s)

      const revenueQ = supabase
        .from('jobs')
        .select('revenue_cents')
        .eq('owner_id', ownerId)
        .eq('status', 'completed')
        .gte('completed_at', startIso)
        .lte('completed_at', endIso)
        .abortSignal(s)

      const missedPhoneQ = supabase
        .from('phone_calls')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .eq('status', 'missed')
        .gte('occurred_at', startIso)
        .lte('occurred_at', endIso)
        .abortSignal(s)

      const techsMapQ = supabase
        .from('technicians_live')
        .select('id, name, last_lat, last_lng, map_color')
        .eq('owner_id', ownerId)
        .abortSignal(s)

      const emergencyAssigneeQ = supabase
        .from('jobs')
        .select('technician_id')
        .eq('owner_id', ownerId)
        .eq('urgency', 'emergency')
        .neq('status', 'cancelled')
        .is('emergency_ack_at', null)
        .order('emergency_created_at', { ascending: false })
        .limit(1)
        .abortSignal(s)

      const completed30Q = supabase
        .from('jobs')
        .select('revenue_cents, completed_at')
        .eq('owner_id', ownerId)
        .eq('status', 'completed')
        .gte('completed_at', thirtyStart)
        .abortSignal(s)

      const stripeLedger30Q = supabase
        .from('stripe_ledger_lines')
        .select('amount_cents, stripe_created_at')
        .eq('owner_id', ownerId)
        .gte('stripe_created_at', thirtyStart)
        .abortSignal(s)

      const recentJobsQ = supabase
        .from('jobs')
        .select('id, title, status, scheduled_at, urgency')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(5)
        .abortSignal(s)

      const missedListQ = supabase
        .from('phone_calls')
        .select('id, caller_phone, occurred_at, estimated_value_cents')
        .eq('owner_id', ownerId)
        .eq('status', 'missed')
        .order('occurred_at', { ascending: false })
        .limit(10)
        .abortSignal(s)

      const [
        profileRes,
        aiRsRes,
        techCountRes,
        jobsRes,
        techRes,
        revenueRes,
        missedPhoneRes,
        techsMapRes,
        completed30Res,
        recentJobsRes,
        missedListRes,
        emergencyAssigneeRes,
        stripeLedger30Res,
      ] = await Promise.all([
        profileQ,
        aiRsQ,
        techCountQ,
        jobsQ,
        techQ,
        revenueQ,
        missedPhoneQ,
        techsMapQ,
        completed30Q,
        recentJobsQ,
        missedListQ,
        emergencyAssigneeQ,
        stripeLedger30Q,
      ])

      if (ac.signal.aborted) return

      try {
        if (profileRes.error) throw profileRes.error
        if (jobsRes.error) throw jobsRes.error
        if (techRes.error) throw techRes.error
        if (revenueRes.error) throw revenueRes.error

        let missedCount = 0
        if (!missedPhoneRes.error) {
          missedCount = missedPhoneRes.count ?? 0
        } else {
          const legacy = await supabase
            .from('missed_calls')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', ownerId)
            .gte('occurred_at', startIso)
            .lte('occurred_at', endIso)
            .abortSignal(ac.signal)
          if (ac.signal.aborted) return
          if (legacy.error) throw legacy.error
          missedCount = legacy.count ?? 0
        }

        const revenueRows = revenueRes.data as { revenue_cents: number }[] | null
        const revenueSum =
          revenueRows?.reduce((acc, row) => acc + (row.revenue_cents ?? 0), 0) ?? 0

        const prof = profileRes.data as
          | {
              company_name: string | null
              business_phone: string | null
              service_area_center_lat: number | null
              service_area_center_lng: number | null
              service_area_radius: number | null
              onboarding_welcome_dismissed: boolean
              onboarding_completed_at: string | null
              stripe_charges_enabled: boolean
            }
          | null
          | undefined

        const aiRow = (!aiRsRes.error ? aiRsRes.data : null) as { retell_agent_id?: string | null } | null

        const computed = {
          companyName: Boolean((prof?.company_name ?? '').trim()),
          aiReceptionist: Boolean((aiRow?.retell_agent_id ?? '').trim()),
          firstTechnician: (techCountRes.count ?? 0) > 0,
          serviceArea:
            prof?.service_area_center_lat != null &&
            prof?.service_area_center_lng != null &&
            prof?.service_area_radius != null &&
            prof.service_area_radius > 0,
          stripe: Boolean(prof?.stripe_charges_enabled),
        }

        setChecklistDoneAt(prof?.onboarding_completed_at ?? null)
        setSetup(computed)
        setWelcomeOpen(!prof?.onboarding_welcome_dismissed && !prof?.onboarding_completed_at)

        setJobsToday(jobsRes.count ?? 0)
        setTechActive(techRes.count ?? 0)
        setRevenueToday(revenueSum)
        setMissedCallsStat(missedCount)

        if (!techsMapRes.error && techsMapRes.data) {
          const assigneeId = (emergencyAssigneeRes.data?.[0] as { technician_id?: string | null } | undefined)
            ?.technician_id ?? null
          const base = techsMapRes.data as TechMapPoint[]
          setTechnicians(
            base.map((t) => ({
              ...t,
              is_emergency_assignee: assigneeId ? t.id === assigneeId : false,
            })),
          )
        } else {
          setTechnicians([])
        }

        if (!completed30Res.error && completed30Res.data) {
          setRevenueSeries(buildLast30DaysRevenue(completed30Res.data as { revenue_cents: number; completed_at: string | null }[]))
        } else {
          setRevenueSeries([])
        }

        const stripeRows = (!stripeLedger30Res.error ? stripeLedger30Res.data : null) as
          | { amount_cents: number; stripe_created_at: string }[]
          | null
        if (stripeRows && stripeRows.length > 0) {
          setStripeLedgerHasRows(true)
          setStripeNetSeries(buildLast30DaysStripeNet(stripeRows))
        } else {
          setStripeLedgerHasRows(false)
          setStripeNetSeries([])
        }

        if (!recentJobsRes.error && recentJobsRes.data) {
          setRecentJobs(recentJobsRes.data as RecentJobRow[])
        } else {
          setRecentJobs([])
        }

        if (!missedListRes.error && missedListRes.data) {
          setMissedRows(missedListRes.data as MissedCallRow[])
        } else {
          setMissedRows([])
        }
      } catch (e) {
        if (!ac.signal.aborted) {
          setLoadError(e instanceof Error ? e.message : 'Could not load dashboard.')
          setJobsToday(null)
          setTechActive(null)
          setRevenueToday(null)
          setMissedCallsStat(null)
          setTechnicians([])
          setRevenueSeries([])
          setStripeNetSeries([])
          setStripeLedgerHasRows(false)
          setRecentJobs([])
          setMissedRows([])
        }
      } finally {
        if (!ac.signal.aborted) setStatsReady(true)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user])

  const setupProgress = useMemo(() => {
    if (!setup) return { done: 0, total: 5, pct: 0 }
    const done = [
      setup.companyName,
      setup.aiReceptionist,
      setup.firstTechnician,
      setup.serviceArea,
      setup.stripe,
    ].filter(Boolean).length
    const total = 5
    return { done, total, pct: Math.round((done / total) * 100) }
  }, [setup])

  useEffect(() => {
    if (!user || !setup) return
    if (checklistDoneAt) return
    const doneAll = setupProgress.done === setupProgress.total
    const payload = {
      companyName: setup.companyName,
      aiReceptionist: setup.aiReceptionist,
      firstTechnician: setup.firstTechnician,
      serviceArea: setup.serviceArea,
      stripe: setup.stripe,
    }
    void supabase
      .from('profiles')
      .update({
        onboarding_checklist: payload,
        onboarding_completed_at: doneAll ? new Date().toISOString() : null,
      })
      .eq('id', user.id)
  }, [user, setup, setupProgress, checklistDoneAt])

  async function dismissWelcome() {
    if (!user) return
    setWelcomeOpen(false)
    await supabase.from('profiles').update({ onboarding_welcome_dismissed: true }).eq('id', user.id)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <AnimatePresence>
        {welcomeOpen ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--color-margen-surface)] px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-lg text-center">
              <div className="mx-auto flex justify-center text-[var(--margen-accent)]">
                <MargenLogo className="h-16 w-auto" title="Margen" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-[var(--color-margen-text)]">Welcome to Margen</h2>
              <p className="mt-2 text-sm text-[var(--color-margen-muted)]">
                Let’s get your business set up so you can start dispatching and getting paid.
              </p>
              <button
                type="button"
                onClick={() => void dismissWelcome()}
                className="mt-6 rounded-md bg-[var(--margen-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90"
              >
                Get started
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">Today&apos;s snapshot and live operations.</p>
      </motion.div>

      {needsMargenPlan ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3 text-sm text-[var(--color-margen-text)]">
          <span className="font-semibold">No active Margen plan on this workspace yet.</span> Other areas of the app
          stay locked until checkout completes.{' '}
          <Link to="/pricing" className="font-semibold text-[var(--margen-accent)] underline underline-offset-2">
            View plans and checkout
          </Link>
          .
        </div>
      ) : null}

      {subscriptionThanks ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg px-4 py-3 text-sm alert-success"
        >
          Payment received — welcome to Margen! Your plan will show under{' '}
          <Link to="/settings" className="font-semibold underline underline-offset-2">
            Settings
          </Link>{' '}
          in a few seconds once webhooks finish syncing.
        </motion.div>
      ) : null}

      {planUpgradeHint ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg px-4 py-3 text-sm alert-warning"
        >
          {planUpgradeHint}{' '}
          <Link to="/pricing" className="font-semibold underline underline-offset-2">
            View plans
          </Link>
        </motion.div>
      ) : null}

      {!checklistDoneAt && setup ? (
        <div className="rounded-xl border border-[#ebebeb] bg-white px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-margen-text)]">Setup checklist</p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                {setupProgress.done}/{setupProgress.total} complete · {setupProgress.pct}%
              </p>
            </div>
            <div className="w-full sm:w-56">
              <div className="h-2 w-full rounded-full bg-[var(--color-margen-hover)]">
                <div className="h-2 rounded-full bg-[var(--margen-accent)]" style={{ width: `${setupProgress.pct}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <ChecklistRow done={setup.companyName} label="Add your company name" to="/settings#settings-section-profile" />
            <ChecklistRow
              done={setup.aiReceptionist}
              label="Set up your AI receptionist"
              to="/settings/ai-receptionist"
            />
            <ChecklistRow done={setup.firstTechnician} label="Add your first technician" to="/technicians" />
            <ChecklistRow
              done={setup.serviceArea}
              label="Set your service area"
              to="/settings#settings-section-service-area"
            />
            <ChecklistRow
              done={setup.stripe}
              label="Connect Stripe for payments"
              to="/settings#settings-section-payments"
            />
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {loadError ? (
          <motion.p
            key="err"
            className="text-sm text-danger"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.22, ease: easePremium }}
          >
            {loadError}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {!statsReady ? (
        <motion.div
          className="grid min-h-[200px] grid-cols-2 gap-4 rounded-xl border border-[#ebebeb] bg-white p-6 sm:grid-cols-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: easePremium }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton h-9 w-full rounded-md" />
              <div className="skeleton h-3 w-28 rounded" />
            </div>
          ))}
        </motion.div>
      ) : (
        <>
          <motion.div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <StatCard
              label="Jobs today"
              value={jobsToday === null ? '—' : String(jobsToday)}
              hint="Scheduled for today"
            />
            <StatCard
              label="Technicians active"
              value={techActive === null ? '—' : String(techActive)}
              hint="Available or on a job"
            />
            <StatCard
              label="Revenue today"
              value={revenueToday === null ? '—' : formatUsdFromCents(revenueToday)}
              hint="From completed work"
            />
            <StatCard
              label="Missed calls"
              value={missedCallsStat === null ? '—' : String(missedCallsStat)}
              hint="Logged today"
            />
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
            <div className="space-y-6 lg:col-span-8">
              <section>
                <h2 className="section-title mb-3">Technician locations</h2>
                <TechniciansMap technicians={technicians} />
              </section>
              <DashboardRevenueChart data={revenueSeries} />
              {stripeLedgerHasRows ? (
                <DashboardRevenueChart
                  data={stripeNetSeries}
                  title="Stripe net (30 days)"
                  valueLabel="Net"
                  emptyMessage="No Stripe ledger rows synced in the last 30 days."
                />
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-4 text-sm text-[var(--color-margen-muted)]">
                  <span className="font-medium text-[var(--color-margen-text)]">Stripe cash movement</span> — In{' '}
                  <Link to="/settings" className="font-semibold text-[var(--margen-accent)] underline underline-offset-2">
                    Settings → Payments
                  </Link>
                  , use <strong className="text-[var(--color-margen-text)]">Add API key</strong> (your Stripe secret or
                  restricted key), then <strong className="text-[var(--color-margen-text)]">Sync from Stripe</strong> to graph
                  net balance transactions here.
                </div>
              )}
            </div>
            <div className="space-y-6 lg:col-span-4">
              <RecentJobsPanel jobs={recentJobs} />
              <MissedCallsPanel rows={missedRows} onUpdated={() => void reloadMissed()} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ChecklistRow({ done, label, to }: { done: boolean; label: string; to: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2">
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={done} readOnly className="h-4 w-4 accent-[var(--margen-accent)]" />
        <span className={`text-sm ${done ? 'text-[var(--color-margen-muted)]' : 'text-[var(--color-margen-text)]'}`}>
          {label}
        </span>
      </div>
      <Link to={to} className="text-sm font-semibold text-[var(--margen-accent)]">
        Open
      </Link>
    </div>
  )
}
