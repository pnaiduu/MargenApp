-- ai_receptionist_settings: surrogate id PK, owner-scoped RLS.
-- Idempotent: upgrades legacy tables (owner_id PK) and creates the table when missing.

begin;

-- Legacy installs (016/022): primary key was owner_id only — add id and switch PK.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'ai_receptionist_settings'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_receptionist_settings'
      and column_name = 'id'
  ) then
    alter table public.ai_receptionist_settings
      add column id uuid not null default gen_random_uuid();

    alter table public.ai_receptionist_settings drop constraint if exists ai_receptionist_settings_pkey;

    alter table public.ai_receptionist_settings
      add constraint ai_receptionist_settings_pkey primary key (id);

    create unique index if not exists ai_receptionist_settings_owner_id_uidx
      on public.ai_receptionist_settings (owner_id);
  end if;
end;
$$;

create table if not exists public.ai_receptionist_settings (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  company_name text,
  greeting_message text,
  sign_off_message text,
  flow_steps jsonb not null default '[]'::jsonb,
  voice_id text,
  business_hours jsonb not null default '{}'::jsonb,
  after_hours_message text,
  escalation_rules jsonb not null default '{}'::jsonb,
  retell_llm_id text,
  retell_agent_id text,
  retell_phone_number text,
  created_at timestamptz not null default now(),
  constraint ai_receptionist_settings_pkey primary key (id),
  constraint ai_receptionist_settings_owner_id_key unique (owner_id)
);

alter table public.ai_receptionist_settings enable row level security;

drop policy if exists ai_receptionist_settings_owner_all on public.ai_receptionist_settings;

create policy ai_receptionist_settings_owner_all
  on public.ai_receptionist_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

commit;
