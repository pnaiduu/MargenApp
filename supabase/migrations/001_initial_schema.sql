-- Margen: core schema for home-service operations
-- Run in Supabase SQL Editor or via supabase db push

-- Profiles (app users linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create index customers_owner_id_idx on public.customers (owner_id);

alter table public.customers enable row level security;

create policy "customers_owner_all"
  on public.customers for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Technicians
create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  phone text,
  email text,
  status text not null default 'off_duty'
    check (status in ('available', 'busy', 'off_duty', 'on_break')),
  created_at timestamptz not null default now()
);

create index technicians_owner_id_idx on public.technicians (owner_id);

alter table public.technicians enable row level security;

create policy "technicians_owner_all"
  on public.technicians for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  title text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  created_at timestamptz not null default now()
);

create index jobs_owner_id_idx on public.jobs (owner_id);
create index jobs_scheduled_at_idx on public.jobs (scheduled_at);
create index jobs_status_idx on public.jobs (status);

alter table public.jobs enable row level security;

create policy "jobs_owner_all"
  on public.jobs for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Missed calls (for dashboard metric)
create table public.missed_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  caller_phone text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index missed_calls_owner_occurred_idx
  on public.missed_calls (owner_id, occurred_at desc);

alter table public.missed_calls enable row level security;

create policy "missed_calls_owner_all"
  on public.missed_calls for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
