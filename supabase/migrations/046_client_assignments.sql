create table if not exists public.client_assignments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  developer_id uuid references public.team_members(id),
  quote_id uuid,
  client_name text,
  monthly_amount numeric,
  status text default 'active' check (status in ('active', 'inactive', 'completed'))
);

alter table public.client_assignments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'client_assignments' and policyname = 'admin_all_assignments') then
    create policy admin_all_assignments on public.client_assignments using (true) with check (true);
  end if;
end $$;
