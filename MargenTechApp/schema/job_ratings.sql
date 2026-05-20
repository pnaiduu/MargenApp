-- Run in Supabase SQL editor (production) so the technician app can save customer ratings.
-- One row per job after the visit.

create table if not exists public.job_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  customer_phone text not null,
  submitted_at timestamptz not null default now()
);

create unique index if not exists job_ratings_one_per_job on public.job_ratings (job_id);

alter table public.job_ratings enable row level security;

drop policy if exists job_ratings_tech_select on public.job_ratings;
drop policy if exists job_ratings_tech_insert on public.job_ratings;

create policy job_ratings_tech_select on public.job_ratings for select
  using (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.id = job_ratings.job_id
        and t.user_id = auth.uid()
    )
  );

create policy job_ratings_tech_insert on public.job_ratings for insert
  with check (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.id = job_id
        and t.user_id = auth.uid()
    )
    and owner_id = (select j2.owner_id from public.jobs j2 where j2.id = job_id)
  );

grant select, insert on public.job_ratings to authenticated;
