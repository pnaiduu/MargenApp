alter table public.quotes add column if not exists payment_status text default 'pending';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotes_payment_status_check'
  ) then
    alter table public.quotes add constraint quotes_payment_status_check
      check (payment_status in ('pending', 'paid', 'cancelled'));
  end if;
exception when others then null;
end $$;
