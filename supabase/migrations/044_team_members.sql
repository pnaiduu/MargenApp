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

drop policy if exists admin_all on public.team_members;
create policy admin_all on public.team_members using (true) with check (true);
