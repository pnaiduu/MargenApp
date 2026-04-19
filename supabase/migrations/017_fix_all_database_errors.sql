-- Fix all DB errors / ensure required tables exist (owner-scoped RLS)
-- This migration is designed to be idempotent: safe to run multiple times.

begin;

-- =========
-- PROFILES
-- =========
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  company_name text,
  full_name text,
  accent_color text,
  theme text,
  service_area_radius double precision,
  retell_agent_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists owner_id uuid references auth.users (id) on delete cascade,
  add column if not exists company_name text,
  add column if not exists full_name text,
  add column if not exists accent_color text,
  add column if not exists theme text,
  add column if not exists service_area_radius double precision,
  add column if not exists retell_agent_id text,
  add column if not exists created_at timestamptz not null default now();

-- Backfill owner_id for existing rows (owner_id = id)
update public.profiles set owner_id = id where owner_id is null;

alter table public.profiles enable row level security;

drop policy if exists profiles_owner_all on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_technician_read_owner on public.profiles;

create policy profiles_owner_all
  on public.profiles for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- CUSTOMERS
-- =========
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  lifetime_value_cents integer not null default 0 check (lifetime_value_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists notes text,
  add column if not exists lifetime_value_cents integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.customers enable row level security;

drop policy if exists customers_owner_all on public.customers;
drop policy if exists customers_technician_select on public.customers;

create policy customers_owner_all
  on public.customers for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- TECHNICIANS
-- =========
create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  phone text,
  role text,
  status text not null default 'off_duty',
  latitude double precision,
  longitude double precision,
  clocked_in boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.technicians
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists role text,
  add column if not exists status text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists clocked_in boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- Keep status constraint permissive (do not drop existing checks).
alter table public.technicians enable row level security;

drop policy if exists technicians_owner_all on public.technicians;
drop policy if exists technicians_select_linked_self on public.technicians;
drop policy if exists technicians_technician_update_self on public.technicians;

create policy technicians_owner_all
  on public.technicians for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- TECHNICIANS_LIVE (TABLE as requested)
-- =========
-- You previously had a view named technicians_live. Replace it with a table.
drop view if exists public.technicians_live;

create table if not exists public.technicians_live (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz not null default now()
);

create index if not exists technicians_live_owner_updated_idx
  on public.technicians_live (owner_id, updated_at desc);

alter table public.technicians_live enable row level security;

drop policy if exists technicians_live_owner_all on public.technicians_live;

create policy technicians_live_owner_all
  on public.technicians_live for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- JOBS
-- =========
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'pending',
  urgency text,
  address text,
  latitude double precision,
  longitude double precision,
  scheduled_at timestamptz,
  completed_at timestamptz,
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.jobs
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists technician_id uuid references public.technicians (id) on delete set null,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists status text,
  add column if not exists urgency text,
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists scheduled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists revenue_cents integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.jobs enable row level security;

drop policy if exists jobs_owner_all on public.jobs;
drop policy if exists jobs_technician_select on public.jobs;
drop policy if exists jobs_technician_update on public.jobs;

create policy jobs_owner_all
  on public.jobs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- PHONE_CALLS
-- =========
create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  caller_phone text,
  duration integer,
  status text not null default 'missed',
  transcript text,
  recording_url text,
  extracted_job_details jsonb not null default '{}'::jsonb,
  converted_to_job boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.phone_calls
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists caller_phone text,
  add column if not exists duration integer,
  add column if not exists status text,
  add column if not exists transcript text,
  add column if not exists recording_url text,
  add column if not exists extracted_job_details jsonb not null default '{}'::jsonb,
  add column if not exists converted_to_job boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.phone_calls enable row level security;

drop policy if exists phone_calls_owner_all on public.phone_calls;

create policy phone_calls_owner_all
  on public.phone_calls for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- NOTIFICATIONS
-- =========
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  message text,
  type text,
  read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists title text,
  add column if not exists message text,
  add column if not exists type text,
  add column if not exists read boolean not null default false,
  add column if not exists link text,
  add column if not exists created_at timestamptz not null default now();

alter table public.notifications enable row level security;

drop policy if exists notifications_owner_all on public.notifications;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_owner_insert on public.notifications;

create policy notifications_owner_all
  on public.notifications for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- MISSED_CALLS
-- =========
create table if not exists public.missed_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  caller_phone text,
  occurred_at timestamptz not null default now(),
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  called_back boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.missed_calls
  add column if not exists owner_id uuid not null references auth.users (id) on delete cascade,
  add column if not exists caller_phone text,
  add column if not exists occurred_at timestamptz not null default now(),
  add column if not exists estimated_value_cents integer not null default 0,
  add column if not exists called_back boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.missed_calls enable row level security;

drop policy if exists missed_calls_owner_all on public.missed_calls;

create policy missed_calls_owner_all
  on public.missed_calls for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- CUSTOMER_SUMMARY VIEW
-- =========
create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.owner_id,
  c.name as customer_name,
  (select count(*) from public.jobs j where j.owner_id = c.owner_id and j.customer_id = c.id) as total_jobs,
  coalesce((select sum(j.revenue_cents) from public.jobs j where j.owner_id = c.owner_id and j.customer_id = c.id and j.status = 'completed'), 0) as total_spent_cents,
  (select max(j.completed_at) from public.jobs j where j.owner_id = c.owner_id and j.customer_id = c.id and j.status = 'completed') as last_service_at
from public.customers c;

commit;

