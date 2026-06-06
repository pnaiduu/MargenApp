create table if not exists public.commissions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  team_member_id uuid references public.team_members(id),
  client_name text,
  quote_id uuid,
  amount numeric,
  month text,
  paid boolean default false,
  paid_at timestamptz,
  commission_status text default 'pending' check (commission_status in ('pending', 'earned', 'paid_out'))
);

alter table public.commissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'commissions' and policyname = 'admin_all_commissions') then
    create policy admin_all_commissions on public.commissions using (true) with check (true);
  end if;
end $$;
