-- Technician map position + calendar colors
alter table public.technicians
  add column if not exists map_color text default '#6b7280',
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz;

-- Revenue analytics by job category
alter table public.jobs
  add column if not exists job_type text not null default 'general';

-- Incoming calls / leads (replaces ad-hoc missed_calls usage for new features)
create table public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  caller_phone text,
  occurred_at timestamptz not null default now(),
  status text not null default 'missed'
    check (status in ('answered', 'missed', 'called_back')),
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index phone_calls_owner_occurred_idx on public.phone_calls (owner_id, occurred_at desc);
create index phone_calls_owner_status_idx on public.phone_calls (owner_id, status);

alter table public.phone_calls enable row level security;

create policy phone_calls_owner_all on public.phone_calls for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
