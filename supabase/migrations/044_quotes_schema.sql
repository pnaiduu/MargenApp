-- Expand quotes table for full client quote builder
alter table public.quotes
  add column if not exists full_name text,
  add column if not exists business_name text,
  add column if not exists email text,
  add column if not exists city_state text,
  add column if not exists business_description text,
  add column if not exists has_existing_site boolean,
  add column if not exists existing_site_url text,
  add column if not exists has_logo boolean,
  add column if not exists has_photos boolean,
  add column if not exists timeline text,
  add column if not exists heard_from text,
  add column if not exists rep_code text,
  add column if not exists plan text,
  add column if not exists features jsonb default '[]'::jsonb,
  add column if not exists anything_else text;

create policy "Public can read quotes"
  on public.quotes
  for select
  using (true);
