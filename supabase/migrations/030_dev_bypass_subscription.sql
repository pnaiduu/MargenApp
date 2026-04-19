-- Dev accounts: persist Scale subscription without Stripe (must match client allowlist in src/lib/subscriptionAccess.ts)
create table if not exists public.dev_bypass_subscription_emails (
  email text primary key
);

alter table public.dev_bypass_subscription_emails enable row level security;

insert into public.dev_bypass_subscription_emails (email)
values ('davynaidu@gmail.com')
on conflict (email) do nothing;

create or replace function public.sync_dev_bypass_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_cust text;
  v_sub text;
begin
  if v_uid is null or v_email = '' then
    return;
  end if;

  if not exists (
    select 1
    from public.dev_bypass_subscription_emails d
    where lower(d.email) = v_email
  ) then
    return;
  end if;

  v_cust := 'cus_dev_' || replace(v_uid::text, '-', '');
  v_sub := 'sub_dev_' || replace(v_uid::text, '-', '');

  insert into public.subscriptions (
    owner_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_end
  )
  values (v_uid, v_cust, v_sub, 'scale', 'active', null)
  on conflict (owner_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_end = excluded.current_period_end;
end;
$$;

grant execute on function public.sync_dev_bypass_subscription() to authenticated;

comment on function public.sync_dev_bypass_subscription() is
  'If JWT email is in dev_bypass_subscription_emails, upsert subscriptions row as Scale/active with placeholder Stripe ids.';
