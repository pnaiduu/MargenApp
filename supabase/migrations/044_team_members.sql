create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  full_name text,
  email text,
  phone text,
  role text check (role in ('developer', 'salesperson')),
  rep_code text unique,
  status text default 'active' check (status in ('active', 'inactive')),
  notes text
);

alter table public.team_members enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'team_members' and policyname = 'admin_all_team') then
    create policy admin_all_team on public.team_members using (true) with check (true);
  end if;
end $$;
