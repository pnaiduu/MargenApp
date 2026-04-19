-- Catch-all migration: ensure all app-critical tables/columns exist.
-- Safe/idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS and drops/recreates policies.
-- Intended for environments that only applied a subset of historical migrations.

begin;

-- =========
-- PROFILES extras (legacy + onboarding + Stripe + phone settings)
-- =========
alter table public.profiles
  add column if not exists theme_mode text,
  add column if not exists accent_hex text,
  add column if not exists logo_url text,
  add column if not exists business_phone text,
  add column if not exists rings_before_ai integer,
  add column if not exists business_hours jsonb,
  add column if not exists after_hours_message text,
  add column if not exists service_area_center_lat double precision,
  add column if not exists service_area_center_lng double precision,
  add column if not exists service_area_radius_miles double precision,
  add column if not exists vip_threshold_cents integer,
  add column if not exists onboarding_welcome_dismissed boolean,
  add column if not exists onboarding_checklist jsonb,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean,
  add column if not exists stripe_details_submitted boolean;

-- =========
-- TECHNICIANS extras (roles, skills, map)
-- =========
alter table public.technicians
  add column if not exists role text,
  add column if not exists skills text[] default '{}'::text[],
  add column if not exists map_color text default '#6b7280',
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz,
  add column if not exists email text;

-- =========
-- CUSTOMERS extras (notes, normalized phone, lat/lng)
-- =========
alter table public.customers
  add column if not exists owner_notes text,
  add column if not exists phone_normalized text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create index if not exists customers_owner_phone_norm_idx on public.customers (owner_id, phone_normalized);

-- =========
-- JOBS extras (job_type, cancellations, field workflow, AI assignment)
-- =========
alter table public.jobs
  add column if not exists job_type text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancel_reason_details text,
  add column if not exists cancelled_by uuid,
  add column if not exists assignment_note text,
  add column if not exists needs_approval boolean,
  add column if not exists source text,
  add column if not exists source_phone_call_id uuid,
  add column if not exists emergency_created_at timestamptz,
  add column if not exists emergency_assigned_at timestamptz,
  add column if not exists emergency_ack_deadline_at timestamptz,
  add column if not exists emergency_ack_at timestamptz,
  add column if not exists emergency_ack_by uuid,
  add column if not exists emergency_assignment_attempt integer,
  add column if not exists emergency_tried_technician_ids uuid[],
  add column if not exists paid_at timestamptz,
  add column if not exists is_paid boolean,
  add column if not exists tech_notes text,
  add column if not exists before_photo_url text,
  add column if not exists after_photo_url text,
  add column if not exists field_status text;

create index if not exists jobs_owner_cancelled_idx on public.jobs (owner_id, cancelled_at desc);
create index if not exists jobs_owner_status_sched_idx on public.jobs (owner_id, status, scheduled_at);
create index if not exists jobs_owner_needs_approval_idx on public.jobs (owner_id, needs_approval, created_at desc);
create index if not exists jobs_owner_emergency_idx on public.jobs (owner_id, urgency, emergency_created_at desc);

-- =========
-- PHONE_CALLS (owner call log + AI receptionist fields)
-- =========
create table if not exists public.phone_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  caller_phone text,
  occurred_at timestamptz not null default now(),
  status text not null default 'missed',
  estimated_value_cents integer not null default 0 check (estimated_value_cents >= 0),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.phone_calls
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists caller_phone_normalized text,
  add column if not exists duration_seconds integer,
  add column if not exists ended_at timestamptz,
  add column if not exists twilio_call_sid text,
  add column if not exists twilio_from text,
  add column if not exists twilio_to text,
  add column if not exists ai_handled boolean not null default false,
  add column if not exists bland_call_id text,
  add column if not exists transcript text,
  add column if not exists transcript_summary text,
  add column if not exists recording_url text,
  add column if not exists collected jsonb not null default '{}'::jsonb,
  add column if not exists converted_job_id uuid references public.jobs (id) on delete set null,
  add column if not exists converted_at timestamptz;

create index if not exists phone_calls_owner_occurred_idx on public.phone_calls (owner_id, occurred_at desc);
create index if not exists phone_calls_owner_status_idx on public.phone_calls (owner_id, status);
create index if not exists phone_calls_owner_phone_norm_idx on public.phone_calls (owner_id, caller_phone_normalized);
create index if not exists phone_calls_owner_customer_idx on public.phone_calls (owner_id, customer_id, occurred_at desc);
create index if not exists phone_calls_owner_twilio_sid_idx on public.phone_calls (owner_id, twilio_call_sid);
create index if not exists phone_calls_owner_status_occurred_idx on public.phone_calls (owner_id, status, occurred_at desc);

alter table public.phone_calls enable row level security;
drop policy if exists phone_calls_owner_all on public.phone_calls;
create policy phone_calls_owner_all on public.phone_calls for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- TECHNICIAN INVITES
-- =========
create table if not exists public.technician_invites (
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

create index if not exists technician_invites_token_idx on public.technician_invites (token);
create index if not exists technician_invites_owner_idx on public.technician_invites (owner_id, created_at desc);

alter table public.technician_invites enable row level security;
drop policy if exists technician_invites_owner_all on public.technician_invites;
create policy technician_invites_owner_all on public.technician_invites for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- TECHNICIAN CLOCK SESSIONS (if missing)
-- =========
create table if not exists public.technician_clock_sessions (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists technician_clock_sessions_technician_idx
  on public.technician_clock_sessions (technician_id, clock_in_at desc);

alter table public.technician_clock_sessions enable row level security;
drop policy if exists technician_clock_sessions_owner_all on public.technician_clock_sessions;
drop policy if exists technician_clock_sessions_self on public.technician_clock_sessions;
create policy technician_clock_sessions_owner_all on public.technician_clock_sessions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy technician_clock_sessions_self on public.technician_clock_sessions for all
  using (
    exists (
      select 1 from public.technicians t
      where t.id = technician_clock_sessions.technician_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.technicians t
      where t.id = technician_clock_sessions.technician_id
        and t.user_id = auth.uid()
    )
  );

-- =========
-- JOB CUSTOMER RATINGS
-- =========
create table if not exists public.job_customer_ratings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  rating_token text not null unique,
  rating smallint,
  comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists job_customer_ratings_one_open_per_job
  on public.job_customer_ratings (job_id)
  where submitted_at is null;
create index if not exists job_customer_ratings_token_idx on public.job_customer_ratings (rating_token);

alter table public.job_customer_ratings enable row level security;
drop policy if exists job_customer_ratings_owner_all on public.job_customer_ratings;
drop policy if exists job_customer_ratings_tech_select on public.job_customer_ratings;
drop policy if exists job_customer_ratings_tech_insert on public.job_customer_ratings;
create policy job_customer_ratings_owner_all on public.job_customer_ratings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy job_customer_ratings_tech_select on public.job_customer_ratings for select
  using (
    exists (
      select 1 from public.jobs j
      join public.technicians t on t.id = j.technician_id
      where j.id = job_customer_ratings.job_id
        and t.user_id = auth.uid()
    )
  );

-- =========
-- JOB ASSIGNMENT DECISIONS
-- =========
create table if not exists public.job_assignment_decisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null,
  chosen_technician_id uuid references public.technicians (id) on delete set null,
  emergency boolean not null default false,
  job_type text,
  reason text not null,
  distance_meters integer,
  distance_text text,
  duration_seconds integer,
  candidate_count integer not null default 0,
  candidates jsonb not null default '[]'::jsonb,
  raw_distance_matrix jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_assignment_decisions_owner_created_idx
  on public.job_assignment_decisions (owner_id, created_at desc);
create index if not exists job_assignment_decisions_job_idx
  on public.job_assignment_decisions (job_id, created_at desc);

alter table public.job_assignment_decisions enable row level security;
drop policy if exists job_assignment_decisions_owner_all on public.job_assignment_decisions;
create policy job_assignment_decisions_owner_all on public.job_assignment_decisions for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- EXPO PUSH TOKENS
-- =========
create table if not exists public.expo_push_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists expo_push_tokens_user_idx on public.expo_push_tokens (user_id, updated_at desc);
create index if not exists expo_push_tokens_owner_idx on public.expo_push_tokens (owner_id, updated_at desc);

alter table public.expo_push_tokens enable row level security;
drop policy if exists expo_push_tokens_self_all on public.expo_push_tokens;
create policy expo_push_tokens_self_all on public.expo_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========
-- TECHNICIAN LOCATION EVENTS (history table)
-- =========
create table if not exists public.technician_location_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  technician_id uuid not null references public.technicians (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null
);

create index if not exists technician_location_events_tech_time_idx
  on public.technician_location_events (technician_id, recorded_at desc);

alter table public.technician_location_events enable row level security;
drop policy if exists technician_location_events_self_select on public.technician_location_events;
drop policy if exists technician_location_events_self_insert on public.technician_location_events;
create policy technician_location_events_self_select on public.technician_location_events for select
  using (
    exists (
      select 1 from public.technicians t
      where t.id = technician_location_events.technician_id
        and t.user_id = auth.uid()
    )
  );
create policy technician_location_events_self_insert on public.technician_location_events for insert
  with check (
    exists (
      select 1 from public.technicians t
      where t.id = technician_location_events.technician_id
        and t.user_id = auth.uid()
        and t.owner_id = technician_location_events.owner_id
    )
  );

-- =========
-- INVOICES (if missing)
-- =========
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  technician_id uuid references public.technicians (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  invoice_number bigint generated always as identity,
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  stripe_payment_intent_id text,
  sms_to text,
  sent_at timestamptz,
  last_reminder_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_owner_created_idx on public.invoices (owner_id, created_at desc);
create index if not exists invoices_owner_status_idx on public.invoices (owner_id, status);
create index if not exists invoices_owner_paid_idx on public.invoices (owner_id, paid_at desc);
create index if not exists invoices_job_id_idx on public.invoices (job_id);

alter table public.invoices enable row level security;
drop policy if exists invoices_owner_all on public.invoices;
drop policy if exists "invoices_owner_all" on public.invoices;
create policy invoices_owner_all on public.invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========
-- AI RECEPTIONIST SETTINGS
-- =========
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

create index if not exists ai_receptionist_settings_updated_idx on public.ai_receptionist_settings (updated_at desc);

alter table public.ai_receptionist_settings enable row level security;
drop policy if exists ai_receptionist_settings_owner_all on public.ai_receptionist_settings;
create policy ai_receptionist_settings_owner_all on public.ai_receptionist_settings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

commit;

