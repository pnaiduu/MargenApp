import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import {
  cancelJobDirect,
  createInvoiceDirect,
  createJobDirect,
  reassignJobDirect,
} from '../lib/directSupabaseActions'
import { supabase } from '../lib/supabase'
import { easePremium, staggerContainer, staggerItem } from '../lib/motion'
import { JobStatusBadge } from '../components/jobs/JobStatusBadge'
import type { JobStatus } from '../types/database'

type JobRow = {
  id: string
  title: string
  status: JobStatus
  scheduled_at: string | null
  job_type: string
  urgency: string
  revenue_cents: number
  is_paid: boolean
  technician_id?: string | null
  customers: { name: string; phone: string | null } | null
}

const statusLabel: Record<JobStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function JobsPage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createUrgency, setCreateUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')
  const [createCustomerId, setCreateCustomerId] = useState<string>('')
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelJob, setCancelJob] = useState<JobRow | null>(null)
  const [cancelReason, setCancelReason] = useState<'customer_cancelled' | 'technician_unavailable' | 'rescheduled'>(
    'customer_cancelled',
  )
  const [cancelDetails, setCancelDetails] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignJob, setReassignJob] = useState<JobRow | null>(null)
  const [techs, setTechs] = useState<{ id: string; name: string }[]>([])
  const [reassignTechId, setReassignTechId] = useState<string>('')
  const [jobsRefresh, setJobsRefresh] = useState(0)

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: qErr } = await supabase
          .from('jobs')
          .select('id, title, status, scheduled_at, job_type, urgency, revenue_cents, is_paid, technician_id, customers(name, phone)')
          .eq('owner_id', ownerId)
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .abortSignal(ac.signal)
        if (ac.signal.aborted) return
        if (qErr) {
          setError(qErr.message)
          setJobs([])
        } else {
          setJobs((data ?? []) as JobRow[])
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user, jobsRefresh])

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    async function loadCustomers() {
      const { data, error: qErr } = await supabase
        .from('customers')
        .select('id, name')
        .eq('owner_id', ownerId)
        .order('name')
        .abortSignal(ac.signal)
      if (ac.signal.aborted) return
      if (!qErr && data) setCustomers(data as { id: string; name: string }[])
    }
    void loadCustomers()
    return () => {
      ac.abort()
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    async function loadTechs() {
      const { data, error: qErr } = await supabase
        .from('technicians')
        .select('id, name')
        .eq('owner_id', ownerId)
        .order('name')
        .abortSignal(ac.signal)
      if (ac.signal.aborted) return
      if (!qErr && data) setTechs(data as { id: string; name: string }[])
    }
    void loadTechs()
    return () => {
      ac.abort()
    }
  }, [user])

  const grouped = useMemo(() => {
    const order: JobStatus[] = ['pending', 'in_progress', 'completed', 'cancelled']
    const map: Record<JobStatus, JobRow[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    }
    for (const j of jobs) {
      map[j.status].push(j)
    }
    return order.map((s) => ({ status: s, items: map[s] }))
  }, [jobs])

  function formatWhen(iso: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  async function sendInvoice(jobId: string) {
    if (!user) return
    const ownerId = user.id
    setBusyJobId(jobId)
    setError(null)
    const { error: fnErr } = await createInvoiceDirect(supabase, ownerId, { job_id: jobId, send_sms: true })
    if (fnErr) setError(fnErr.message)
    else setJobsRefresh((n) => n + 1)
    setBusyJobId(null)
  }

  async function submitCancel() {
    if (!user || !cancelJob) return
    const ownerId = user.id
    setBusyJobId(cancelJob.id)
    setError(null)
    const { error: fnErr } = await cancelJobDirect(supabase, ownerId, {
      job_id: cancelJob.id,
      reason: cancelReason,
      reason_details: cancelDetails.trim() || undefined,
    })
    if (fnErr) setError(fnErr.message)
    else setJobsRefresh((n) => n + 1)
    setBusyJobId(null)
    setCancelOpen(false)
    setCancelJob(null)
    setCancelDetails('')
    setCancelReason('customer_cancelled')
  }

  async function submitCreate() {
    if (!user) return
    const ownerId = user.id
    if (!createCustomerId) {
      setError('Select a customer for the job.')
      return
    }
    if (!createTitle.trim()) {
      setError('Enter a job title.')
      return
    }
    setBusyJobId('create')
    setError(null)
    const { error: fnErr } = await createJobDirect(supabase, ownerId, {
      customer_id: createCustomerId,
      title: createTitle.trim(),
      description: createDesc.trim() || undefined,
      urgency: createUrgency,
    })
    if (fnErr) setError(fnErr.message)
    else setJobsRefresh((n) => n + 1)
    setBusyJobId(null)
    setCreateOpen(false)
    setCreateTitle('')
    setCreateDesc('')
    setCreateUrgency('routine')
    setCreateCustomerId('')
  }

  async function submitReassign() {
    if (!user || !reassignJob) return
    const ownerId = user.id
    setBusyJobId(reassignJob.id)
    setError(null)
    const { error: fnErr } = await reassignJobDirect(supabase, ownerId, {
      job_id: reassignJob.id,
      technician_id: reassignTechId || null,
      note: reassignTechId ? 'Manual reassignment by owner' : 'Unassigned by owner',
    })
    if (fnErr) setError(fnErr.message)
    else setJobsRefresh((n) => n + 1)
    setBusyJobId(null)
    setReassignOpen(false)
    setReassignJob(null)
    setReassignTechId('')
  }

  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="page-title">Jobs</h1>
            <p className="mt-1 text-sm leading-relaxed text-[#555555]">
              All jobs by status for your account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-md border border-transparent bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            New job
          </button>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="err"
            className="mb-4 text-sm text-danger"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.22, ease: easePremium }}
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            className="flex min-h-[180px] items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: easePremium }}
          >
            <motion.p
              className="text-sm text-[var(--color-margen-muted)]"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.26, repeat: Infinity, ease: 'easeInOut' }}
            >
              Loading jobs…
            </motion.p>
          </motion.div>
        ) : jobs.length === 0 ? (
          <motion.div
            key="empty"
            className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: easePremium }}
          >
            No jobs yet. Add customers and jobs in Supabase or your admin tools to see them here.
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="space-y-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: easePremium }}
          >
            {grouped.map(({ status, items }) =>
              items.length === 0 ? null : (
                <motion.section
                  key={status}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.29, ease: easePremium }}
                >
                  <h2 className="mb-3 text-sm font-semibold text-[var(--color-margen-text)]">
                    {statusLabel[status]}
                    <span className="ml-2 font-normal text-[var(--color-margen-muted)]">
                      ({items.length})
                    </span>
                  </h2>
                  <motion.ul
                    className="divide-y divide-[var(--color-margen-border)] rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)]"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {items.map((job) => (
                        <motion.li
                          key={job.id}
                          variants={staggerItem}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          layout
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--color-margen-text)]">
                              {job.urgency === 'emergency' ? (
                                <span className="badge-emergency mr-2 align-middle text-xs font-semibold">Emergency</span>
                              ) : null}
                              {job.title}
                            </p>
                            <p className="text-sm text-[var(--color-margen-muted)]">
                              {job.customers?.name ?? 'No customer linked'}
                              <span className="mx-2 text-[var(--color-margen-border)]">·</span>
                              {formatWhen(job.scheduled_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {job.status !== 'cancelled' ? (
                              <button
                                type="button"
                                disabled={busyJobId === job.id}
                                onClick={() => {
                                  setReassignJob(job)
                                  setReassignTechId(job.technician_id ?? '')
                                  setReassignOpen(true)
                                }}
                                className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
                              >
                                Reassign
                              </button>
                            ) : null}
                            {job.status !== 'completed' && job.status !== 'cancelled' ? (
                              <button
                                type="button"
                                disabled={busyJobId === job.id}
                                onClick={() => {
                                  setCancelJob(job)
                                  setCancelOpen(true)
                                }}
                                className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            ) : null}
                            {job.status === 'completed' && !job.is_paid ? (
                              <button
                                type="button"
                                disabled={busyJobId === job.id}
                                onClick={() => void sendInvoice(job.id)}
                                className="rounded-md bg-[var(--margen-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--margen-accent-fg)] disabled:opacity-60"
                              >
                                Send invoice
                              </button>
                            ) : null}
                            <JobStatusBadge status={job.status} />
                          </div>
                        </motion.li>
                    ))}
                  </motion.ul>
                </motion.section>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cancelOpen && cancelJob ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setCancelOpen(false)
              setCancelJob(null)
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 shadow-xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: easePremium }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-[var(--color-margen-text)]">Cancel job</p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                {cancelJob.title} {cancelJob.customers?.name ? `· ${cancelJob.customers.name}` : ''}
              </p>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Reason
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as typeof cancelReason)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              >
                <option value="customer_cancelled">Customer cancelled</option>
                <option value="technician_unavailable">Technician unavailable</option>
                <option value="rescheduled">Rescheduled</option>
              </select>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Details (optional)
              </label>
              <textarea
                value={cancelDetails}
                onChange={(e) => setCancelDetails(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="Add any notes…"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelOpen(false)
                    setCancelJob(null)
                  }}
                  className="rounded-md border border-[var(--color-margen-border)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={busyJobId === cancelJob.id}
                  onClick={() => void submitCancel()}
                  className="rounded-md bg-[#991b1b] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
                >
                  Cancel job
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 shadow-xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: easePremium }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-[var(--color-margen-text)]">New job</p>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Customer
              </label>
              <select
                value={createCustomerId}
                onChange={(e) => setCreateCustomerId(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              >
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Title
              </label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                placeholder="e.g. No hot water"
              />

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Urgency
              </label>
              <select
                value={createUrgency}
                onChange={(e) => setCreateUrgency(e.target.value as typeof createUrgency)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Description (optional)
              </label>
              <textarea
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-md border border-[var(--color-margen-border)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={busyJobId === 'create'}
                  onClick={() => void submitCreate()}
                  className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reassignOpen && reassignJob ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setReassignOpen(false)
              setReassignJob(null)
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 shadow-xl"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: easePremium }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-[var(--color-margen-text)]">Manual reassign</p>
              <p className="mt-1 text-sm text-[var(--color-margen-muted)]">
                {reassignJob.title} {reassignJob.customers?.name ? `· ${reassignJob.customers.name}` : ''}
              </p>

              <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                Technician
              </label>
              <select
                value={reassignTechId}
                onChange={(e) => setReassignTechId(e.target.value)}
                className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              >
                <option value="">Unassigned</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReassignOpen(false)
                    setReassignJob(null)
                  }}
                  className="rounded-md border border-[var(--color-margen-border)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={busyJobId === reassignJob.id}
                  onClick={() => void submitReassign()}
                  className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
