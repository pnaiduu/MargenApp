-- Technician plan limits (DB enforcement) + restore owner signup profile trigger.

begin;

-- ========= Technician counting (excludes open team invite placeholder) =========
create or replace function public.owner_technician_count(p_owner_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.technicians t
  where t.owner_id = p_owner_id
    and t.name is distinct from 'Open team invite';
$$;

create or replace function public.owner_effective_plan(p_owner_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_plan text;
begin
  select lower(trim(coalesce(u.email, '')))
  into v_email
  from auth.users u
  where u.id = p_owner_id;

  if exists (
    select 1
    from public.dev_bypass_subscription_emails d
    where lower(d.email) = v_email
  ) then
    return 'scale';
  end if;

  select s.plan
  into v_plan
  from public.subscriptions s
  where s.owner_id = p_owner_id
    and s.status in ('active', 'trialing', 'past_due')
  order by s.created_at desc nulls last
  limit 1;

  return v_plan;
end;
$$;

create or replace function public.owner_technician_limit(p_owner_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  v_plan := public.owner_effective_plan(p_owner_id);
  if v_plan is null then
    return 0;
  elsif v_plan = 'scale' then
    return 2147483647;
  elsif v_plan = 'growth' then
    return 20;
  else
    return 5;
  end if;
end;
$$;

create or replace function public.owner_can_add_technician(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owner_technician_count(p_owner_id) < public.owner_technician_limit(p_owner_id);
$$;

-- ========= Before insert: enforce cap (except placeholder row) =========
create or replace function public.enforce_technician_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is not distinct from 'Open team invite' then
    return new;
  end if;

  if not public.owner_can_add_technician(new.owner_id) then
    raise exception 'Plan limit reached'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_technician_plan_limit on public.technicians;
create trigger trg_enforce_technician_plan_limit
  before insert on public.technicians
  for each row execute function public.enforce_technician_plan_limit();

-- ========= finish_technician_owner_signup: respect cap =========
create or replace function public.finish_technician_owner_signup(
  p_user_id uuid,
  p_owner_id uuid,
  p_full_name text,
  p_auth_email text,
  p_role text default 'Technician'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  display_name text;
  display_role text;
begin
  if p_user_id is null or p_owner_id is null or p_owner_id = p_user_id then
    return;
  end if;

  if not exists (select 1 from public.profiles where id = p_owner_id) then
    return;
  end if;

  select id into existing_id from public.technicians where user_id = p_user_id limit 1;
  if existing_id is not null then
    return;
  end if;

  if not public.owner_can_add_technician(p_owner_id) then
    raise exception 'Plan limit reached'
      using errcode = 'P0001';
  end if;

  display_name := nullif(trim(coalesce(p_full_name, '')), '');
  if display_name is null then
    display_name := 'Technician';
  end if;

  display_role := nullif(trim(coalesce(p_role, '')), '');
  if display_role is null then
    display_role := 'Technician';
  end if;

  insert into public.technicians (owner_id, user_id, name, email, role, status)
  values (
    p_owner_id,
    p_user_id,
    display_name,
    nullif(trim(coalesce(p_auth_email, '')), ''),
    display_role,
    'off_duty'
  );
end;
$$;

-- ========= handle_new_user: owner profile + technician flows =========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
  owner_tid uuid;
  signup_role text;
begin
  insert into public.profiles (id, owner_id, full_name, company_name)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '')
  )
  on conflict (id) do update set
    owner_id = coalesce(public.profiles.owner_id, excluded.owner_id, new.id),
    full_name = case
      when trim(coalesce(excluded.full_name, '')) = '' then public.profiles.full_name
      else excluded.full_name
    end,
    company_name = case
      when excluded.company_name is null then public.profiles.company_name
      else excluded.company_name
    end;

  tok := nullif(trim(coalesce(new.raw_user_meta_data->>'technician_invite_token', '')), '');
  if tok is not null then
    perform public.finish_technician_invite(
      new.id,
      tok,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email
    );
    return new;
  end if;

  signup_role := nullif(trim(coalesce(new.raw_user_meta_data->>'signup_role', '')), '');
  begin
    owner_tid := nullif(trim(coalesce(new.raw_user_meta_data->>'technician_owner_id', '')), '')::uuid;
  exception
    when others then
      owner_tid := null;
  end;

  if signup_role = 'technician' and owner_tid is not null then
    perform public.finish_technician_owner_signup(
      new.id,
      owner_tid,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email,
      coalesce(new.raw_user_meta_data->>'technician_role', 'Technician')
    );
  end if;

  return new;
end;
$$;

-- Ensure trigger is attached (may be missing if auth schema was reset)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill owner_id for legacy rows
update public.profiles set owner_id = id where owner_id is null;

-- Client fallback if auth trigger was missing on the project
create or replace function public.ensure_owner_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  insert into public.profiles (id, owner_id, full_name, company_name)
  values (v_uid, v_uid, '', null)
  on conflict (id) do update set
    owner_id = coalesce(public.profiles.owner_id, excluded.owner_id, v_uid);
end;
$$;

grant execute on function public.ensure_owner_profile() to authenticated;

commit;
