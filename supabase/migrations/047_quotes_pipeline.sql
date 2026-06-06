alter table public.quotes add column if not exists status text default 'new';
alter table public.quotes add column if not exists assigned_developer_id uuid;
alter table public.quotes add column if not exists assigned_developer_name text;
alter table public.quotes add column if not exists plan_price numeric;
alter table public.quotes add column if not exists selected_features jsonb;
alter table public.quotes add column if not exists not_selected_features jsonb;
alter table public.quotes add column if not exists notes text;

-- Pipeline columns from earlier migrations (safe if already exist)
alter table public.quotes add column if not exists full_name text;
alter table public.quotes add column if not exists business_name text;
alter table public.quotes add column if not exists email text;
alter table public.quotes add column if not exists city_state text;
alter table public.quotes add column if not exists business_description text;
alter table public.quotes add column if not exists has_existing_site boolean;
alter table public.quotes add column if not exists existing_site_url text;
alter table public.quotes add column if not exists has_logo boolean;
alter table public.quotes add column if not exists has_photos boolean;
alter table public.quotes add column if not exists timeline text;
alter table public.quotes add column if not exists heard_from text;
alter table public.quotes add column if not exists rep_code text;
alter table public.quotes add column if not exists plan text;
alter table public.quotes add column if not exists anything_else text;
alter table public.quotes add column if not exists monthly_total integer;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_status_check'
  ) then
    alter table public.quotes add constraint quotes_status_check
      check (status in ('new', 'reviewed', 'accepted', 'dev_assigned', 'site_live', 'active_client', 'rejected'));
  end if;
exception when others then null;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'quotes' and policyname = 'admin_all_quotes'
  ) then
    create policy admin_all_quotes on public.quotes using (true) with check (true);
  end if;
end $$;

alter table public.commissions add column if not exists commission_status text default 'pending';
