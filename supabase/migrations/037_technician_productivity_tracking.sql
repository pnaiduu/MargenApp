-- Technician productivity: job timing fields, session totals, derived metrics

begin;

alter table public.jobs
  add column if not exists started_at timestamptz,
  add column if not exists technician_rating numeric(2, 1),
  add column if not exists on_time boolean,
  add column if not exists scheduled_arrival timestamptz,
  add column if not exists actual_arrival timestamptz;

-- completed_at already exists on jobs from initial schema

create index if not exists jobs_technician_completed_idx
  on public.jobs (technician_id, completed_at desc)
  where status = 'completed';

alter table public.technician_clock_sessions
  add column if not exists total_minutes integer,
  add column if not exists session_date date;

-- Backfill session_date from clock_in
update public.technician_clock_sessions
set session_date = (clock_in_at at time zone 'utc')::date
where session_date is null;

-- Friendly alias (app may query technician_sessions)
create or replace view public.technician_sessions as
select
  id,
  technician_id,
  owner_id,
  clock_in_at as clocked_in_at,
  clock_out_at as clocked_out_at,
  total_minutes,
  coalesce(session_date, (clock_in_at at time zone 'utc')::date) as date,
  created_at
from public.technician_clock_sessions;

grant select on public.technician_sessions to authenticated;

create or replace function public.jobs_set_productivity_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sched timestamptz;
  arr timestamptz;
  grace interval := interval '15 minutes';
begin
  if new.scheduled_arrival is null and new.scheduled_at is not null then
    new.scheduled_arrival := new.scheduled_at;
  end if;

  if tg_op = 'UPDATE' then
    if new.field_status = 'arrived' and (old.field_status is distinct from 'arrived') and new.actual_arrival is null then
      new.actual_arrival := now();
    end if;
    if new.field_status = 'working' and (old.field_status is distinct from 'working') and new.started_at is null then
      new.started_at := now();
    end if;
  end if;

  if new.status = 'completed' and new.completed_at is not null then
    sched := coalesce(new.scheduled_arrival, new.scheduled_at);
    arr := new.actual_arrival;
    if sched is not null and arr is not null then
      new.on_time := arr <= sched + grace;
    elsif sched is not null and new.started_at is not null then
      new.on_time := new.started_at <= sched + grace;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_productivity_fields on public.jobs;
create trigger trg_jobs_productivity_fields
  before insert or update on public.jobs
  for each row execute function public.jobs_set_productivity_fields();

create or replace function public.sync_job_technician_rating_from_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rating is not null and new.submitted_at is not null then
    update public.jobs
    set technician_rating = new.rating::numeric
    where id = new.job_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_job_technician_rating on public.job_customer_ratings;
create trigger trg_sync_job_technician_rating
  after insert or update of rating, submitted_at on public.job_customer_ratings
  for each row execute function public.sync_job_technician_rating_from_customer();

create or replace function public.technician_clock_sessions_set_totals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.session_date is null then
    new.session_date := (new.clock_in_at at time zone 'utc')::date;
  end if;
  if new.clock_out_at is not null and new.total_minutes is null then
    new.total_minutes := greatest(
      0,
      floor(extract(epoch from (new.clock_out_at - new.clock_in_at)) / 60.0)::integer
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_technician_clock_sessions_totals on public.technician_clock_sessions;
create trigger trg_technician_clock_sessions_totals
  before insert or update on public.technician_clock_sessions
  for each row execute function public.technician_clock_sessions_set_totals();

commit;
