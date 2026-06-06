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

create policy "Public can submit sales applications"
  on public.sales_applications
  for insert
  with check (true);

create policy "Public can read sales applications"
  on public.sales_applications
  for select
  using (true);
