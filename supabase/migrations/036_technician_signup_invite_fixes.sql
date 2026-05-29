-- Technician signup + 6-char invite codes + post-login claim + status constraint

begin;

-- Ensure pending is a valid technician status (idempotent)
alter table public.technicians drop constraint if exists technicians_status_check;
alter table public.technicians
  add constraint technicians_status_check check (
    status in ('pending', 'available', 'busy', 'off_duty', 'on_break')
  );

-- 6-character invite codes (was length >= 8)
create or replace function public.lookup_technician_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.technician_invites%rowtype;
  co_name text;
begin
  if p_token is null or length(trim(p_token)) < 4 then
    return jsonb_build_object('found', false);
  end if;

  select * into inv
  from public.technician_invites
  where token = trim(p_token)
    and consumed_at is null
    and expires_at > now();

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select company_name into co_name from public.profiles where id = inv.owner_id;

  return jsonb_build_object(
    'found', true,
    'invited_name', inv.invited_name,
    'role', inv.role,
    'company_name', coalesce(co_name, '')
  );
end;
$$;

create or replace function public.finish_technician_invite(
  p_user_id uuid,
  p_token text,
  p_full_name text,
  p_auth_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.technician_invites%rowtype;
  n int;
begin
  if p_token is null or length(trim(p_token)) < 4 then
    return;
  end if;

  select * into inv
  from public.technician_invites
  where token = trim(p_token)
    and consumed_at is null
    and expires_at > now()
  for update;

  if not found then
    return;
  end if;

  update public.technicians
  set
    user_id = p_user_id,
    name = case
      when trim(coalesce(p_full_name, '')) = '' then public.technicians.name
      else trim(p_full_name)
    end,
    email = coalesce(nullif(trim(p_auth_email), ''), public.technicians.email),
    status = 'off_duty'
  where id = inv.technician_id
    and owner_id = inv.owner_id
    and user_id is null;

  get diagnostics n = row_count;
  if n = 0 then
    return;
  end if;

  update public.technician_invites
  set consumed_at = now()
  where id = inv.id;

  update public.profiles
  set
    owner_id = inv.owner_id,
    full_name = case
      when trim(coalesce(p_full_name, '')) = '' then public.profiles.full_name
      else trim(p_full_name)
    end
  where id = p_user_id;
end;
$$;

-- Link invite after sign-in (mobile / web)
create or replace function public.claim_technician_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_full text;
  v_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Unauthorized');
  end if;

  if exists (select 1 from public.technicians where user_id = v_uid) then
    return jsonb_build_object('ok', true, 'already_linked', true);
  end if;

  select
    coalesce(u.raw_user_meta_data->>'full_name', ''),
    u.email
  into v_full, v_email
  from auth.users u
  where u.id = v_uid;

  perform public.finish_technician_invite(v_uid, p_token, v_full, v_email);

  if not exists (select 1 from public.technicians where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'Invalid or expired invite code');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.claim_technician_invite(text) to authenticated;

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
  signup_role := nullif(trim(coalesce(new.raw_user_meta_data->>'signup_role', '')), '');
  tok := nullif(trim(coalesce(new.raw_user_meta_data->>'technician_invite_token', '')), '');

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

  -- Technician app signup: optional invite link only; no pre-existing technician row required
  if signup_role = 'technician' then
    if tok is not null then
      perform public.finish_technician_invite(
        new.id,
        tok,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        new.email
      );
    end if;
    return new;
  end if;

  if tok is not null then
    perform public.finish_technician_invite(
      new.id,
      tok,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email
    );
    return new;
  end if;

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

commit;
