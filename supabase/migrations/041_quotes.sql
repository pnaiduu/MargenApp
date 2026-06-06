-- Client-facing website quote submissions (homepage quote builder)
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  plan_id text not null,
  plan_name text not null,
  plan_price integer not null,
  selected_features jsonb not null default '[]'::jsonb,
  addons_total integer not null default 0,
  monthly_total integer not null,
  additional_notes text,
  phone text
);

create index if not exists quotes_created_at_idx on public.quotes (created_at desc);

alter table public.quotes enable row level security;

create policy "Public can submit quotes"
  on public.quotes
  for insert
  to anon, authenticated
  with check (true);
