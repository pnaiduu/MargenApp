-- Owner-pasted Stripe API key (ciphertext) for analytics sync — readable only via service role / Edge.
create table if not exists public.stripe_analytics_credentials (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  secret_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_analytics_credentials enable row level security;

comment on table public.stripe_analytics_credentials is 'Encrypted Stripe secret/restricted key per owner. No client policies — Edge Functions use service role.';

alter table public.profiles
  add column if not exists stripe_analytics_key_hint text,
  add column if not exists stripe_analytics_last_sync_at timestamptz;

comment on column public.profiles.stripe_analytics_key_hint is 'Non-secret suffix for UI (e.g. last chars of key).';

-- Cached Stripe BalanceTransaction rows for Revenue / Dashboard charts
create table if not exists public.stripe_ledger_lines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  stripe_balance_txn_id text not null,
  amount_cents bigint not null,
  fee_cents bigint not null default 0,
  currency text not null default 'usd',
  reporting_category text,
  txn_type text,
  description text,
  available_on timestamptz,
  stripe_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, stripe_balance_txn_id)
);

create index if not exists stripe_ledger_lines_owner_created_idx
  on public.stripe_ledger_lines (owner_id, stripe_created_at desc);

alter table public.stripe_ledger_lines enable row level security;

create policy stripe_ledger_lines_owner_select on public.stripe_ledger_lines
  for select to authenticated
  using (owner_id = auth.uid());

comment on table public.stripe_ledger_lines is 'Synced from Stripe Balance Transactions via Edge (owner API key).';
