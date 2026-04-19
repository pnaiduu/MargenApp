import type { JobStatus } from '../../types/database'

const statusLabel: Record<JobStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const badgeClass: Record<JobStatus, string> = {
  pending: 'badge-pending',
  in_progress: 'badge-active',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <span className={badgeClass[status]}>{statusLabel[status]}</span>
}
