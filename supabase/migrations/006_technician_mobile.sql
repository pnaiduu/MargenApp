-- Margen Technician mobile: field workflow, ratings QR, clock history, map coords

alter table public.customers
  add column if not exists lat double precision,
  add column if not exists lng double precision;

alter table public.jobs
  add column if not exists urgency text not null default 'normal'
    check (urgency in ('low', 'normal', 'high', 'urgent')),
  add column if not exists tech_notes text,
  add column if not exists before_photo_url text,
  add column if not exists after_photo_url text,
  add column if not exists field_status text not null default 'scheduled'
    check (field_status in ('scheduled', 'en_route', 'arrived', 'working', 'completed', 'rated'));

create table public.technician_clock_sessions (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index technician_clock_sessions_technician_idx
  on public.technician_clock_sessions (technician_id, clock_in_at desc);

alter table public.technician_clock_sessions enable row level security;

create policy technician_clock_sessions_owner_all on public.technician_clock_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy technician_clock_sessions_self on public.technician_clock_sessions for all
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

create table public.job_customer_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  rating_token text not null unique,
  rating smallint,
  comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint job_customer_ratings_rating_range check (rating is null or (rating >= 1 and rating <= 5))
);

create unique index job_customer_ratings_one_open_per_job
  on public.job_customer_ratings (job_id)
  where submitted_at is null;

create index job_customer_ratings_token_idx on public.job_customer_ratings (rating_token);

alter table public.job_customer_ratings enable row level security;

create policy job_customer_ratings_owner_all on public.job_customer_ratings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy job_customer_ratings_tech_select on public.job_customer_ratings for select
  using (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.id = job_customer_ratings.job_id
        and t.user_id = auth.uid()
    )
  );

create policy job_customer_ratings_tech_insert on public.job_customer_ratings for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.id = job_id
        and t.user_id = auth.uid()
    )
    and owner_id = (select j2.owner_id from public.jobs j2 where j2.id = job_id)
  );

-- Technicians can update their assigned jobs (field data, photos, status)
create policy jobs_technician_select on public.jobs for select
  using (
    technician_id is not null
    and exists (
      select 1 from public.technicians t
      where t.id = jobs.technician_id
        and t.user_id = auth.uid()
    )
  );

create policy jobs_technician_update on public.jobs for update
  using (
    technician_id is not null
    and exists (
      select 1 from public.technicians t
      where t.id = jobs.technician_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    technician_id is not null
    and exists (
      select 1 from public.technicians t
      where t.id = jobs.technician_id
        and t.user_id = auth.uid()
    )
  );

-- Customer read for assigned jobs
create policy customers_technician_select on public.customers for select
  using (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.customer_id = customers.id
        and t.user_id = auth.uid()
    )
  );

-- Company name on technician profile screen
create policy profiles_technician_read_owner on public.profiles for select
  using (
    id in (select t.owner_id from public.technicians t where t.user_id = auth.uid())
  );

-- Status + GPS self-update
create policy technicians_technician_update_self on public.technicians for update
  using (user_id is not null and auth.uid() = user_id)
  with check (user_id is not null and auth.uid() = user_id);

-- Public: customer submits rating via token (no auth)
create or replace function public.submit_customer_rating(p_token text, p_rating int, p_comment text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  jid uuid;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return false;
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return false;
  end if;

  update public.job_customer_ratings
  set
    rating = p_rating,
    comment = left(trim(coalesce(p_comment, '')), 500),
    submitted_at = now()
  where rating_token = trim(p_token)
    and submitted_at is null
  returning job_id into jid;

  if jid is null then
    return false;
  end if;

  update public.jobs
  set field_status = 'rated'
  where id = jid;

  return true;
end;
$$;

grant execute on function public.submit_customer_rating(text, int, text) to anon, authenticated;
