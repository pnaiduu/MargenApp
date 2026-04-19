-- Emergency jobs: new urgency level + ack/reassign fields

-- Extend urgency constraint to include 'emergency'
alter table public.jobs drop constraint if exists jobs_urgency_check;
alter table public.jobs
  add constraint jobs_urgency_check check (urgency in ('low', 'normal', 'high', 'urgent', 'emergency'));

-- Emergency workflow fields
alter table public.jobs
  add column if not exists emergency_created_at timestamptz,
  add column if not exists emergency_assigned_at timestamptz,
  add column if not exists emergency_ack_deadline_at timestamptz,
  add column if not exists emergency_ack_at timestamptz,
  add column if not exists emergency_ack_by uuid references auth.users (id) on delete set null,
  add column if not exists emergency_assignment_attempt int not null default 0,
  add column if not exists emergency_tried_technician_ids uuid[] not null default '{}';

create index if not exists jobs_owner_emergency_idx
  on public.jobs (owner_id, urgency, emergency_created_at desc);

create index if not exists jobs_emergency_deadline_idx
  on public.jobs (owner_id, urgency, emergency_ack_deadline_at)
  where urgency = 'emergency' and emergency_ack_at is null and status <> 'cancelled';

