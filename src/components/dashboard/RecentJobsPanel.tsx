import { JobStatusBadge } from '../jobs/JobStatusBadge'
import type { JobStatus } from '../../types/database'

export type RecentJobRow = {
  id: string
  title: string
  status: JobStatus
  scheduled_at: string | null
  urgency?: string | null
}

export function RecentJobsPanel({ jobs }: { jobs: RecentJobRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] transition hover:-translate-y-px hover:border-[var(--color-margen-border-hover)]">
      <div className="border-b border-[var(--color-margen-border)] px-6 py-4">
        <h2 className="card-title">Recent jobs</h2>
        <p className="mt-1 text-xs text-[var(--color-margen-muted)]">Latest five</p>
      </div>
      <ul className="divide-y divide-[var(--color-margen-border)]">
        {jobs.length === 0 ? (
          <li className="px-6 py-6 text-center text-sm text-[var(--color-margen-muted)]">No jobs yet.</li>
        ) : (
          jobs.map((job) => (
            <li key={job.id} className="flex items-start justify-between gap-3 px-6 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-relaxed text-[var(--color-margen-text)]">
                  {job.urgency === 'emergency' ? (
                    <span className="badge-emergency mr-2 align-middle">Emergency</span>
                  ) : null}
                  {job.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-margen-muted)]">
                  {job.scheduled_at
                    ? new Date(job.scheduled_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Unscheduled'}
                </p>
              </div>
              <JobStatusBadge status={job.status} />
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
