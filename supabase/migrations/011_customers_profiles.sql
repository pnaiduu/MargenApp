-- Customer profiles + call matching + VIP threshold

-- Owner-set VIP threshold
alter table public.profiles
  add column if not exists vip_threshold_cents integer not null default 200000 check (vip_threshold_cents >= 0);

-- Customer notes + phone normalization
alter table public.customers
  add column if not exists owner_notes text,
  add column if not exists phone_normalized text;

create index if not exists customers_owner_phone_norm_idx on public.customers (owner_id, phone_normalized);

-- Link incoming calls to customers
alter table public.phone_calls
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists caller_phone_normalized text;

create index if not exists phone_calls_owner_phone_norm_idx on public.phone_calls (owner_id, caller_phone_normalized);
create index if not exists phone_calls_owner_customer_idx on public.phone_calls (owner_id, customer_id, occurred_at desc);

-- Normalize phone helper (E.164-ish: keep digits, keep leading + if present)
create or replace function public.normalize_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
begin
  if p is null then return null; end if;
  s := regexp_replace(trim(p), '[^0-9+]', '', 'g');
  if s = '' then return null; end if;
  -- If multiple + signs or + not at start, strip them.
  if position('+' in s) > 1 then
    s := regexp_replace(s, '\\+', '', 'g');
  end if;
  return s;
end;
$$;

-- Keep customers.phone_normalized updated
create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists trg_customers_phone_norm on public.customers;
create trigger trg_customers_phone_norm
  before insert or update of phone on public.customers
  for each row execute function public.set_customer_phone_normalized();

-- Keep phone_calls.caller_phone_normalized updated + match/create customer
create or replace function public.match_or_create_customer_for_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  norm text;
  cid uuid;
begin
  norm := public.normalize_phone(new.caller_phone);
  new.caller_phone_normalized := norm;

  if norm is null then
    return new;
  end if;

  select c.id into cid
  from public.customers c
  where c.owner_id = new.owner_id
    and c.phone_normalized = norm
  limit 1;

  if cid is null then
    insert into public.customers (owner_id, name, phone)
    values (new.owner_id, 'Unknown caller', new.caller_phone)
    returning id into cid;
  end if;

  new.customer_id := cid;
  return new;
end;
$$;

drop trigger if exists trg_phone_calls_match_customer on public.phone_calls;
create trigger trg_phone_calls_match_customer
  before insert on public.phone_calls
  for each row execute function public.match_or_create_customer_for_call();

-- Customer summary view (LTV, last service, VIP flag)
create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.owner_id,
  c.name,
  c.phone,
  c.phone_normalized,
  c.email,
  c.address,
  c.owner_notes,
  coalesce((
    select sum(i.amount_cents)
    from public.invoices i
    where i.customer_id = c.id
      and i.owner_id = c.owner_id
      and i.status = 'paid'
  ), 0) as lifetime_value_cents,
  (
    select max(j.completed_at)
    from public.jobs j
    where j.customer_id = c.id
      and j.owner_id = c.owner_id
      and j.status = 'completed'
  ) as last_service_at,
  (
    coalesce((
      select sum(i.amount_cents)
      from public.invoices i
      where i.customer_id = c.id
        and i.owner_id = c.owner_id
        and i.status = 'paid'
    ), 0) >= (select p.vip_threshold_cents from public.profiles p where p.id = c.owner_id)
  ) as is_vip
from public.customers c;

