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

create policy "Public can submit dev applications"
  on public.dev_applications
  for insert
  with check (true);

create policy "Public can read dev applications"
  on public.dev_applications
  for select
  using (true);
