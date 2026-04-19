-- customer_summary: use `name` (not customer_name), plus notes + total_jobs.
-- Also exposes is_vip (required by CustomersPage .select(..., is_vip)).
-- Safe to run in Supabase SQL Editor or via `supabase db push`.

begin;

alter table public.customers
  add column if not exists notes text;

alter table public.customers
  add column if not exists owner_notes text;

create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.owner_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  coalesce(c.notes, c.owner_notes) as notes,
  coalesce(
    (
      select sum(i.amount_cents)
      from public.invoices i
      where i.customer_id = c.id
        and i.owner_id = c.owner_id
        and i.status = 'paid'
    ),
    0
  ) as lifetime_value_cents,
  (
    select max(j.completed_at)
    from public.jobs j
    where j.customer_id = c.id
      and j.owner_id = c.owner_id
      and j.status = 'completed'
  ) as last_service_at,
  (
    select count(*)::bigint
    from public.jobs j
    where j.customer_id = c.id
      and j.owner_id = c.owner_id
  ) as total_jobs,
  (
    coalesce(
      (
        select sum(i.amount_cents)
        from public.invoices i
        where i.customer_id = c.id
          and i.owner_id = c.owner_id
          and i.status = 'paid'
      ),
      0
    ) >= coalesce(
      (select p.vip_threshold_cents from public.profiles p where p.id = c.owner_id),
      200000
    )
  ) as is_vip
from public.customers c;

commit;
