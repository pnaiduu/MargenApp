create table if not exists public.commissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  team_member_id uuid references public.team_members(id),
  client_name text,
  quote_id uuid references public.quotes(id),
  amount numeric,
  month text,
  paid boolean default false,
  paid_at timestamptz
);

alter table public.commissions enable row level security;

drop policy if exists admin_all on public.commissions;
create policy admin_all on public.commissions using (true) with check (true);
