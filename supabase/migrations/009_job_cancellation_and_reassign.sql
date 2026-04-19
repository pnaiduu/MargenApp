-- Job cancellation + reassignment support

-- Cancellation fields
alter table public.jobs
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancel_reason_details text,
  add column if not exists cancelled_by uuid references auth.users (id) on delete set null;

alter table public.jobs drop constraint if exists jobs_cancel_reason_check;
alter table public.jobs
  add constraint jobs_cancel_reason_check check (
    cancel_reason is null or cancel_reason in ('customer_cancelled', 'technician_unavailable', 'rescheduled')
  );

create index if not exists jobs_owner_cancelled_idx on public.jobs (owner_id, cancelled_at desc);
create index if not exists jobs_owner_status_sched_idx on public.jobs (owner_id, status, scheduled_at);

-- Technician "skill" fields (simple, composable)
-- skills: list of job_type values they can take (e.g. ["hvac","plumbing"])
alter table public.technicians
  add column if not exists skills text[] not null default '{}';

create index if not exists technicians_owner_status_idx on public.technicians (owner_id, status);

