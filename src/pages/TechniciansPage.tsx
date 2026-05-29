import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { technicianUnavailableReassignDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { staggerContainer, staggerItem } from '../lib/motion'
import type { TechnicianStatus } from '../types/database'
import { Modal } from '../components/ui/Modal'
import { TechnicianInviteModal } from '../components/technicians/TechnicianInviteModal'
import type { PlanId } from '../lib/plans'
import {
  canAddTechnician,
  formatTechnicianLimit,
  nextPlanDisplayName,
  nextPlanForTechnicianCap,
} from '../lib/subscriptionAccess'
import { easePremium, tapButton } from '../lib/motion'
import { useWorkspaceAccess } from '../contexts/workspace-access-context'
import { localWeekRangeIso } from '../lib/dates'

type TechRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  role: string | null
  user_id: string | null
  status: TechnicianStatus
}

type InviteRow = {
  technician_id: string
  token: string
  invited_name: string
  invited_phone: string | null
  role: string
}

type SessRow = { technician_id: string; clock_in_at: string; clock_out_at: string | null }

const statusLabel: Record<TechnicianStatus, string> = {
  pending: 'Pending',
  available: 'Available',
  busy: 'Busy',
  off_duty: 'Off duty',
  on_break: 'On break',
}

function technicianBadgeClass(status: TechnicianStatus, invitePending: boolean): string {
  if (invitePending || status === 'pending') return 'badge-pending'
  switch (status) {
    case 'available':
      return 'badge-available'
    case 'busy':
      return 'badge-busy'
    case 'off_duty':
      return 'badge-off-duty'
    case 'on_break':
      return 'badge-on-break'
    default:
      return 'badge-neutral'
  }
}

function StatusBadge({ status, invitePending }: { status: TechnicianStatus; invitePending: boolean }) {
  const label = invitePending ? 'Pending' : statusLabel[status]
  const cls = technicianBadgeClass(status, invitePending)
  return <span className={cls}>{label}</span>
}

export function TechniciansPage() {
  const { user } = useAuth()
  const { effectiveSubscription } = useWorkspaceAccess()
  const [technicians, setTechnicians] = useState<TechRow[]>([])
  const [sessions, setSessions] = useState<SessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [viewInvite, setViewInvite] = useState<InviteRow | null>(null)
  const [pendingInvites, setPendingInvites] = useState<Map<string, InviteRow>>(new Map())
  const [listTick, setListTick] = useState(0)
  const [busyTechId, setBusyTechId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<TechRow | null>(null)
  const [removing, setRemoving] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { startIso: weekStart, endIso: weekEnd } = localWeekRangeIso()
        const s = ac.signal

        const techQ = supabase
          .from('technicians')
          .select('id, name, phone, email, role, user_id, status')
          .eq('owner_id', ownerId)
          .order('name')
          .abortSignal(s)

        const sessQ = supabase
          .from('technician_clock_sessions')
          .select('technician_id, clock_in_at, clock_out_at')
          .eq('owner_id', ownerId)
          .gte('clock_in_at', weekStart)
          .lte('clock_in_at', weekEnd)
          .abortSignal(s)

        const invQ = supabase
          .from('technician_invites')
          .select('technician_id, token, invited_name, invited_phone, role')
          .eq('owner_id', ownerId)
          .is('consumed_at', null)
          .gt('expires_at', new Date().toISOString())
          .abortSignal(s)

        const [techRes, sessRes, invRes] = await Promise.all([techQ, sessQ, invQ])

        if (ac.signal.aborted) return
        if (techRes.error) {
          setError(techRes.error.message)
          setTechnicians([])
        } else {
          setTechnicians((techRes.data ?? []) as TechRow[])
        }
        if (!sessRes.error) setSessions((sessRes.data ?? []) as SessRow[])
        else setSessions([])
        if (!invRes.error) {
          const m = new Map<string, InviteRow>()
          for (const row of (invRes.data ?? []) as InviteRow[]) {
            m.set(row.technician_id, row)
          }
          setPendingInvites(m)
        } else {
          setPendingInvites(new Map())
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => ac.abort()
  }, [user, listTick])

  const planId: PlanId = effectiveSubscription?.plan ?? 'starter'
  const atCap = !canAddTechnician(technicians.length, planId)
  const nextPlan = nextPlanForTechnicianCap(planId)
  const limitLabel = formatTechnicianLimit(planId)

  function tryOpenInvite() {
    if (atCap) {
      setLimitModalOpen(true)
      return
    }
    setViewInvite(null)
    setInviteOpen(true)
  }

  function openViewInvite(techId: string) {
    const inv = pendingInvites.get(techId)
    if (!inv) return
    setViewInvite(inv)
    setInviteOpen(true)
  }

  function closeInviteModal() {
    setInviteOpen(false)
    setViewInvite(null)
  }

  const existingInviteForModal = viewInvite
    ? {
        token: viewInvite.token,
        invitedName: viewInvite.invited_name,
        invitedPhone: viewInvite.invited_phone,
        role: viewInvite.role,
      }
    : null

  const clockedInByTech = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const row of sessions) {
      if (row.clock_out_at == null) m.set(row.technician_id, true)
    }
    return m
  }, [sessions])

  async function onConfirmRemove() {
    if (!user || !removeTarget) return
    setRemoving(true)
    setError(null)
    const { error: delErr } = await supabase
      .from('technicians')
      .delete()
      .eq('id', removeTarget.id)
      .eq('owner_id', user.id)
    setRemoving(false)
    if (delErr) {
      setError(delErr.message)
      return
    }
    setRemoveTarget(null)
    setListTick((t) => t + 1)
  }

  async function onUnavailable(techId: string) {
    if (!user) return
    setBusyTechId(techId)
    setError(null)
    const { error: fnErr } = await technicianUnavailableReassignDirect(supabase, user.id, techId)
    if (fnErr) setError(fnErr.message)
    setBusyTechId(null)
    setListTick((t) => t + 1)
  }

  const noSubscription = !effectiveSubscription

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Technicians</h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-margen-text-secondary)]">
            Invite your field team, track status, and handle unavailability.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={noSubscription}
            onClick={() => tryOpenInvite()}
            className="shrink-0 rounded-md border border-transparent bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-50"
          >
            Add Technician
          </button>
        </div>
      </div>

      {noSubscription ? (
        <p className="rounded-md border px-3 py-2 text-sm alert-warning">
          Add an active subscription to invite technicians.
        </p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--color-margen-muted)]">Loading…</p>
      ) : technicians.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          No technicians yet. Add your first technician to get started.
        </div>
      ) : (
        <motion.ul
          className="divide-y divide-[var(--color-margen-border)] rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {technicians.map((t) => (
            <motion.li key={t.id} variants={staggerItem} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-margen-text)]">{t.name}</p>
                <p className="text-sm text-[var(--color-margen-muted)]">
                  {[t.phone, t.email].filter(Boolean).join(' · ') || 'No contact on file'}
                  <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                  {t.role ?? 'Technician'}
                  <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                  {clockedInByTech.get(t.id) ? 'Clocked in today' : 'Not clocked in'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={t.status} invitePending={t.user_id == null} />
                {t.user_id == null && pendingInvites.has(t.id) ? (
                  <button
                    type="button"
                    onClick={() => openViewInvite(t.id)}
                    className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-sm font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
                  >
                    View invite
                  </button>
                ) : null}
                {t.status === 'available' || t.status === 'busy' ? (
                  <button
                    type="button"
                    disabled={busyTechId === t.id}
                    onClick={() => void onUnavailable(t.id)}
                    className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
                  >
                    Mark unavailable
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRemoveTarget(t)}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-sm font-medium text-danger hover:bg-[var(--color-margen-hover)]"
                >
                  Remove
                </button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <Modal open={limitModalOpen} onClose={() => setLimitModalOpen(false)} title="Technician limit reached">
        <p className="text-sm leading-relaxed text-[var(--color-margen-muted)]">
          {nextPlan ? (
            <>
              You&apos;ve reached your plan limit of {limitLabel} technicians. Upgrade to{' '}
              <span className="font-medium text-[var(--color-margen-text)]">{nextPlanDisplayName(planId)}</span> to add
              more.
            </>
          ) : (
            <>You&apos;ve reached your plan limit of {limitLabel} technicians.</>
          )}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <motion.button
            type="button"
            onClick={() => setLimitModalOpen(false)}
            className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
            whileTap={tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            Close
          </motion.button>
          {nextPlan ? (
            <Link
              to="/settings#subscription"
              onClick={() => setLimitModalOpen(false)}
              className="rounded-md border border-transparent bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90"
            >
              Upgrade plan
            </Link>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={removeTarget != null}
        onClose={() => {
          if (!removing) setRemoveTarget(null)
        }}
        title={removeTarget ? `Remove ${removeTarget.name} from your team?` : undefined}
      >
        <p className="text-sm text-[var(--color-margen-muted)]">
          This deletes their technician profile from your workspace. They will no longer appear on your team or map.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <motion.button
            type="button"
            disabled={removing}
            onClick={() => setRemoveTarget(null)}
            className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
            whileTap={tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            disabled={removing}
            onClick={() => void onConfirmRemove()}
            className="rounded-md border border-transparent bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            whileTap={removing ? undefined : tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            {removing ? 'Removing…' : 'Remove'}
          </motion.button>
        </div>
      </Modal>

      {user ? (
        <TechnicianInviteModal
          open={inviteOpen}
          onClose={closeInviteModal}
          ownerId={user.id}
          onCreated={() => {
            setListTick((x) => x + 1)
            setViewInvite(null)
          }}
          existingInvite={existingInviteForModal}
          inviteBlockedReason={
            atCap
              ? `Your plan allows up to ${limitLabel} technicians.`
              : noSubscription
                ? 'Add an active subscription to invite technicians.'
                : null
          }
        />
      ) : null}
    </div>
  )
}
