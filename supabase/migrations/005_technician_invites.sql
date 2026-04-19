-- Technician role + pending status
alter table public.technicians
  add column if not exists role text;

alter table public.technicians drop constraint if exists technicians_status_check;

alter table public.technicians
  add constraint technicians_status_check check (
    status in ('pending', 'available', 'busy', 'off_duty', 'on_break')
  );

-- Invites link pending technician rows to signup tokens
create table public.technician_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  invited_name text not null,
  invited_phone text,
  role text not null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index technician_invites_token_idx on public.technician_invites (token);
create index technician_invites_owner_idx on public.technician_invites (owner_id, created_at desc);

alter table public.technician_invites enable row level security;

create policy technician_invites_owner_all on public.technician_invites for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Technicians can read their own row once linked
create policy technicians_select_linked_self on public.technicians for select
  using (user_id is not null and auth.uid() = user_id);

-- Public invite preview (token only)
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
  if p_token is null or length(trim(p_token)) < 8 then
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

grant execute on function public.lookup_technician_invite(text) to anon, authenticated;

-- Link technician after auth user is created (invite token in raw_user_meta_data)
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
  if p_token is null or length(trim(p_token)) < 8 then
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
  set full_name = case
    when trim(coalesce(p_full_name, '')) = '' then public.profiles.full_name
    else trim(p_full_name)
  end
  where id = p_user_id;
end;
$$;

-- Extend new-user trigger to consume technician invites
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tok text;
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '')
  );

  tok := nullif(trim(coalesce(new.raw_user_meta_data->>'technician_invite_token', '')), '');
  if tok is not null then
    perform public.finish_technician_invite(
      new.id,
      tok,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.email
    );
  end if;

  return new;
end;
$$;
