-- AI receptionist premium settings (Retell)

create table if not exists public.ai_receptionist_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  company_name text,
  greeting_message text,
  sign_off_message text,
  flow_steps jsonb not null default '[]'::jsonb,
  voice_id text,
  retell_agent_id text,
  retell_llm_id text,
  retell_phone_number text,
  business_hours jsonb not null default '{}'::jsonb,
  after_hours_message text,
  escalation_rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ai_receptionist_settings_updated_idx
  on public.ai_receptionist_settings (updated_at desc);

alter table public.ai_receptionist_settings enable row level security;

create policy ai_receptionist_settings_owner_all
  on public.ai_receptionist_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- updated_at trigger (re-use if exists elsewhere)
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  ) then
    create or replace function public.set_updated_at()
    returns trigger
    language plpgsql
    as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$;
  end if;
end;
$$;

drop trigger if exists trg_ai_receptionist_settings_updated_at on public.ai_receptionist_settings;
create trigger trg_ai_receptionist_settings_updated_at
  before update on public.ai_receptionist_settings
  for each row execute function public.set_updated_at();

