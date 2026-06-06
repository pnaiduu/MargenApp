create table if not exists public.sales_applications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  full_name text,
  email text,
  age text,
  city_state text,
  has_sales_experience boolean,
  does_cold_calls boolean,
  approach_description text,
  has_car boolean,
  why_join text,
  commission_ok boolean
);

alter table public.sales_applications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'sales_applications' and policyname = 'public_insert_sales') then
    create policy public_insert_sales on public.sales_applications for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'sales_applications' and policyname = 'admin_all_sales') then
    create policy admin_all_sales on public.sales_applications using (true) with check (true);
  end if;
end $$;
