-- AI job auto-assignment logging + job assignment note

alter table public.jobs
  add column if not exists assignment_note text;

create table if not exists public.job_assignment_decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null check (kind in ('auto', 'manual', 'failed')),
  chosen_technician_id uuid references public.technicians (id) on delete set null,
  emergency boolean not null default false,
  job_type text,
  reason text not null,
  distance_meters integer,
  distance_text text,
  duration_seconds integer,
  candidate_count integer not null default 0,
  candidates jsonb not null default '[]'::jsonb,
  raw_distance_matrix jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_assignment_decisions_owner_created_idx
  on public.job_assignment_decisions (owner_id, created_at desc);

create index if not exists job_assignment_decisions_job_idx
  on public.job_assignment_decisions (job_id, created_at desc);

alter table public.job_assignment_decisions enable row level security;

create policy job_assignment_decisions_owner_all
  on public.job_assignment_decisions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

