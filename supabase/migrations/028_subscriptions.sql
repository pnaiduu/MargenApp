-- SaaS subscriptions (Stripe Billing) per owner
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  plan text not null check (plan in ('starter', 'growth', 'scale')),
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id),
  unique (stripe_subscription_id)
);

create index if not exists subscriptions_owner_id_idx on public.subscriptions (owner_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

comment on table public.subscriptions is 'Owner SaaS plan via Stripe Billing (separate from Stripe Connect for payouts)';

alter table public.subscriptions enable row level security;

create policy subscriptions_select_own
  on public.subscriptions for select
  using (owner_id = (select auth.uid()));

-- Inserts/updates come from Edge Functions / webhooks (service role); no direct client writes
