-- PostgREST 400 fixes:
-- 1) customer_summary: environments that stopped at 017 had columns (customer_name, total_jobs, …)
--    while the web app selects (customer_id, name, phone, address, email, lifetime_value_cents, last_service_at, is_vip).
-- 2) technicians: ensure email + role exist so selects like TechniciansPage (email, role, user_id, …) never 400.

begin;

alter table public.customers
  add column if not exists phone_normalized text,
  add column if not exists owner_notes text,
  add column if not exists notes text;

alter table public.technicians
  add column if not exists email text,
  add column if not exists role text;

create or replace view public.customer_summary as
select
  c.id as customer_id,
  c.owner_id,
  c.name,
  c.phone,
  c.phone_normalized,
  c.email,
  c.address,
  coalesce(c.owner_notes, c.notes) as owner_notes,
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
