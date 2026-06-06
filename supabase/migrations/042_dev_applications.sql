create table if not exists public.dev_applications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  full_name text,
  email text,
  age text,
  city_state text,
  experience text,
  built_before boolean,
  portfolio_link text,
  uses_cursor boolean,
  hours_per_week text,
  why_join text,
  commission_ok boolean
);

alter table public.dev_applications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'dev_applications' and policyname = 'public_insert_dev') then
    create policy public_insert_dev on public.dev_applications for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'dev_applications' and policyname = 'admin_all_dev') then
    create policy admin_all_dev on public.dev_applications using (true) with check (true);
  end if;
end $$;
