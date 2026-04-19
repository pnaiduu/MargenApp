import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import { technicianUnavailableReassignDirect } from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { staggerContainer, staggerItem } from '../lib/motion'
import type { TechnicianStatus } from '../types/database'
import { TechnicianInviteModal } from '../components/technicians/TechnicianInviteModal'
import { technicianInviteCap } from '../lib/plans'
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
  const [listTick, setListTick] = useState(0)
  const [busyTechId, setBusyTechId] = useState<string | null>(null)
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

        const [techRes, sessRes] = await Promise.all([techQ, sessQ])

        if (ac.signal.aborted) return
        if (techRes.error) {
          setError(techRes.error.message)
          setTechnicians([])
        } else {
          setTechnicians((techRes.data ?? []) as TechRow[])
        }
        if (!sessRes.error) setSessions((sessRes.data ?? []) as SessRow[])
        else setSessions([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => ac.abort()
  }, [user, listTick])

  const cap = technicianInviteCap(effectiveSubscription)
  const atCap = cap !== null && technicians.length >= cap

  const clockedInByTech = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const row of sessions) {
      if (row.clock_out_at == null) m.set(row.technician_id, true)
    }
    return m
  }, [sessions])

  async function onUnavailable(techId: string) {
    if (!user) return
    setBusyTechId(techId)
    setError(null)
    const { error: fnErr } = await technicianUnavailableReassignDirect(supabase, user.id, techId)
    if (fnErr) setError(fnErr.message)
    setBusyTechId(null)
    setListTick((t) => t + 1)
  }

  const inviteBlockedReason = atCap
    ? cap === 0
      ? 'Add an active subscription to invite technicians.'
      : `Your plan allows up to ${cap} technicians.`
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Technicians</h1>
          <p className="mt-1 text-sm leading-relaxed text-[#555555]">
            Invite your field team, track status, and handle unavailability.
          </p>
        </div>
        <button
          type="button"
          disabled={Boolean(inviteBlockedReason)}
          onClick={() => setInviteOpen(true)}
          className="shrink-0 rounded-md border border-transparent bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-50"
        >
          Invite technician
        </button>
      </div>

      {inviteBlockedReason ? (
        <p className="rounded-md border px-3 py-2 text-sm alert-warning">{inviteBlockedReason}</p>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--color-margen-muted)]">Loading…</p>
      ) : technicians.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
          No technicians yet. Send an invite to add your first technician.
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
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {user ? (
        <TechnicianInviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          ownerId={user.id}
          onCreated={() => setListTick((x) => x + 1)}
          inviteBlockedReason={inviteBlockedReason}
        />
      ) : null}
    </div>
  )
}
