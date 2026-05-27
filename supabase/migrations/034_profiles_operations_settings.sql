-- Owner operations toggles: auto-assign jobs and auto-sort schedule.

begin;

alter table public.profiles
  add column if not exists auto_assign_jobs boolean not null default true,
  add column if not exists auto_sort_schedule boolean not null default true;

update public.profiles
set
  auto_assign_jobs = coalesce(auto_assign_jobs, true),
  auto_sort_schedule = coalesce(auto_sort_schedule, true)
where auto_assign_jobs is distinct from true
   or auto_sort_schedule is distinct from true;

commit;
