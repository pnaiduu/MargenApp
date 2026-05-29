-- Job location fields + onboarding tutorial flag

alter table public.jobs
  add column if not exists job_address text,
  add column if not exists job_lat double precision,
  add column if not exists job_lng double precision;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

update public.profiles
set onboarding_completed = true
where onboarding_completed_at is not null
  and onboarding_completed = false;

comment on column public.jobs.job_address is 'Service location address for this job';
comment on column public.jobs.job_lat is 'Service location latitude';
comment on column public.jobs.job_lng is 'Service location longitude';
comment on column public.profiles.onboarding_completed is 'Owner dismissed or finished first-run tutorial';
