-- GPS privacy controls: store technician history for self only, owner sees live only during active shift.

-- Technician location events (history)
create table if not exists public.technician_location_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null
);

create index if not exists technician_location_events_tech_time_idx
  on public.technician_location_events (technician_id, recorded_at desc);

alter table public.technician_location_events enable row level security;

-- Technician can read their own location history
create policy technician_location_events_self_select on public.technician_location_events for select
  using (
    exists (
      select 1 from public.technicians t
      where t.id = technician_location_events.technician_id
        and t.user_id = auth.uid()
    )
  );

-- Technician can insert only for themselves AND only when clocked in (open clock session)
create policy technician_location_events_self_insert on public.technician_location_events for insert
  with check (
    exists (
      select 1 from public.technicians t
      where t.id = technician_location_events.technician_id
        and t.user_id = auth.uid()
        and t.owner_id = technician_location_events.owner_id
    )
    and exists (
      select 1 from public.technician_clock_sessions s
      where s.technician_id = technician_location_events.technician_id
        and s.clock_out_at is null
    )
  );

-- NOTE: no owner policy here on purpose (owner cannot query history)

-- View: owner-facing technician live positions only during open shift
create or replace view public.technicians_live as
select
  t.id,
  t.owner_id,
  t.name,
  t.map_color,
  case when s.id is null then null else t.last_lat end as last_lat,
  case when s.id is null then null else t.last_lng end as last_lng,
  case when s.id is null then null else t.last_location_at end as last_location_at
from public.technicians t
left join lateral (
  select id
  from public.technician_clock_sessions s
  where s.technician_id = t.id
    and s.clock_out_at is null
  order by s.clock_in_at desc
  limit 1
) s on true;

grant select on public.technicians_live to authenticated;

