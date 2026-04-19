-- Align customer_summary with web app columns (017 view was minimal → PostgREST 400 on bad select).
-- Restore technician_clock_sessions for owner dashboard (404 if only 017+019 ran).
-- Apply after 020_invoices_table.sql (view references public.invoices).

begin;

alter table public.customers
  add column if not exists phone_normalized text,
  add column if not exists owner_notes text;

create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.owner_id,
  c.name,
  c.phone,
  c.phone_normalized,
  c.email,
  c.address,
  coalesce(c.owner_notes, c.notes) as owner_notes,
  coalesce(
    (
      select sum(i.amount_cents)
      from public.invoices i
      where i.customer_id = c.id
        and i.owner_id = c.owner_id
        and i.status = 'paid'
    ),
    0
  ) as lifetime_value_cents,
  (
    select max(j.completed_at)
    from public.jobs j
    where j.customer_id = c.id
      and j.owner_id = c.owner_id
      and j.status = 'completed'
  ) as last_service_at,
  (
    coalesce(
      (
        select sum(i.amount_cents)
        from public.invoices i
        where i.customer_id = c.id
          and i.owner_id = c.owner_id
          and i.status = 'paid'
      ),
      0
    ) >= coalesce(
      (select p.vip_threshold_cents from public.profiles p where p.id = c.owner_id),
      200000
    )
  ) as is_vip
from public.customers c;

create table if not exists public.technician_clock_sessions (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists technician_clock_sessions_technician_idx
  on public.technician_clock_sessions (technician_id, clock_in_at desc);

create index if not exists technician_clock_sessions_owner_idx
  on public.technician_clock_sessions (owner_id, clock_in_at desc);

alter table public.technician_clock_sessions enable row level security;

drop policy if exists technician_clock_sessions_owner_all on public.technician_clock_sessions;
drop policy if exists technician_clock_sessions_self on public.technician_clock_sessions;

create policy technician_clock_sessions_owner_all
  on public.technician_clock_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy technician_clock_sessions_self
  on public.technician_clock_sessions for all
  using (
    exists (
      select 1 from public.technicians t
      where t.id = technician_clock_sessions.technician_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.technicians t
      where t.id = technician_clock_sessions.technician_id
        and t.user_id = auth.uid()
    )
  );

commit;
