-- Payments + Invoices (Stripe + Twilio)
-- Adds invoices table and Stripe Connect fields for owners.

-- Owner Stripe Connect state
alter table public.profiles
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false;

create index if not exists profiles_stripe_account_id_idx on public.profiles (stripe_account_id);

-- Track job paid state separately from "completed"
alter table public.jobs
  add column if not exists paid_at timestamptz,
  add column if not exists is_paid boolean not null default false;

create index if not exists jobs_owner_paid_idx on public.jobs (owner_id, is_paid, paid_at desc);

-- Invoices generated from jobs (or manually)
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'void')),

  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',

  invoice_number bigint generated always as identity,

  stripe_checkout_session_id text,
  stripe_checkout_url text,
  stripe_payment_intent_id text,

  sms_to text,
  sent_at timestamptz,
  last_reminder_at timestamptz,

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_owner_created_idx on public.invoices (owner_id, created_at desc);
create index if not exists invoices_owner_status_idx on public.invoices (owner_id, status);
create index if not exists invoices_owner_paid_idx on public.invoices (owner_id, paid_at desc);
create index if not exists invoices_job_id_idx on public.invoices (job_id);

alter table public.invoices enable row level security;

create policy "invoices_owner_all"
  on public.invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

