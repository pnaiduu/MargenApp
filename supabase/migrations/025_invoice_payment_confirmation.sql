-- Post-job payment confirmation: tokenized link, customer-reported payment method, job paid sync.

begin;

alter table public.invoices
  add column if not exists payment_confirmation_token text,
  add column if not exists payment_confirmation_sent_at timestamptz,
  add column if not exists payment_confirmation_deadline_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists owner_payment_reminder_sent_at timestamptz;

create unique index if not exists invoices_payment_confirmation_token_uidx
  on public.invoices (payment_confirmation_token)
  where payment_confirmation_token is not null;

alter table public.invoices drop constraint if exists invoices_payment_method_check;

alter table public.invoices
  add constraint invoices_payment_method_check check (
    payment_method is null
    or payment_method in ('cash', 'card', 'zelle', 'venmo', 'check', 'other')
  );

create or replace function public.submit_payment_confirmation(p_token text, p_method text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices%rowtype;
  m text;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return false;
  end if;

  m := lower(trim(coalesce(p_method, '')));
  if m not in ('cash', 'card', 'zelle', 'venmo', 'check', 'other') then
    return false;
  end if;

  select * into inv
  from public.invoices
  where payment_confirmation_token = trim(p_token)
  limit 1;

  if not found then
    return false;
  end if;

  if inv.payment_confirmed_at is not null then
    return true;
  end if;

  update public.invoices
  set
    payment_method = m,
    payment_confirmed_at = now(),
    paid_at = now(),
    status = 'paid'
  where id = inv.id;

  update public.jobs
  set
    is_paid = true,
    paid_at = now()
  where id = inv.job_id
    and owner_id = inv.owner_id;

  return true;
end;
$$;

grant execute on function public.submit_payment_confirmation(text, text) to anon, authenticated;

-- Public (anon) read for payment confirmation page — token is the credential.
create or replace function public.get_payment_confirmation_details(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  inv public.invoices%rowtype;
  jtitle text;
  cname text;
  comp text;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return jsonb_build_object('valid', false);
  end if;

  select i.* into inv
  from public.invoices i
  where i.payment_confirmation_token = trim(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  select coalesce(j.title, 'Service') into jtitle
  from public.jobs j
  where j.id = inv.job_id;

  select coalesce(c.name, '') into cname
  from public.customers c
  where c.id = inv.customer_id;

  select coalesce(nullif(trim(p.company_name), ''), 'Margen') into comp
  from public.profiles p
  where p.id = inv.owner_id;

  return jsonb_build_object(
    'valid', true,
    'job_title', coalesce(jtitle, 'Service'),
    'customer_name', nullif(trim(cname), ''),
    'amount_cents', inv.amount_cents,
    'company_name', comp,
    'already_confirmed', inv.payment_confirmed_at is not null,
    'payment_method', inv.payment_method
  );
end;
$$;

grant execute on function public.get_payment_confirmation_details(text) to anon, authenticated;

drop policy if exists invoices_technician_insert_assigned_job on public.invoices;
create policy invoices_technician_insert_assigned_job
  on public.invoices for insert
  with check (
    exists (
      select 1
      from public.jobs j
      inner join public.technicians t on t.id = j.technician_id
      where j.id = invoices.job_id
        and j.owner_id = invoices.owner_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists invoices_technician_select_assigned on public.invoices;
create policy invoices_technician_select_assigned
  on public.invoices for select
  using (
    exists (
      select 1
      from public.jobs j
      inner join public.technicians t on t.id = j.technician_id
      where j.id = invoices.job_id
        and t.user_id = auth.uid()
    )
  );

commit;
