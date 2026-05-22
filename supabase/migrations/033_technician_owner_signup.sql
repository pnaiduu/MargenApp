-- Technician signup via owner_id in invite link (/signup?role=technician&owner=...)
-- Restores invite-token linking in handle_new_user (regression from migration 019).

begin;

create or replace function public.lookup_owner_team_invite(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  co_name text;
begin
  if p_owner_id is null then
    return jsonb_build_object('found', false);
  end if;

  select company_name into co_name from public.profiles where id = p_owner_id;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'company_name', coalesce(co_name, '')
  );
end;
$$;

grant execute on function public.lookup_owner_team_invite(uuid) to anon, authenticated;

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
    full_name = case
      when trim(coalesce(excluded.full_name, '')) = '' then public.profiles.full_name
      else excluded.full_name
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

commit;
