-- Stripe Connect OAuth (Standard) connected account

alter table public.profiles
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_email text;

create index if not exists profiles_stripe_connect_account_id_idx
  on public.profiles (stripe_connect_account_id);

-- Backfill from legacy Express Connect column when present
update public.profiles
set stripe_connect_account_id = stripe_account_id
where stripe_connect_account_id is null
  and stripe_account_id is not null;

comment on column public.profiles.stripe_connect_account_id is 'Stripe Connect OAuth connected account ID (acct_...)';
comment on column public.profiles.stripe_connect_email is 'Email on the connected Stripe account';
