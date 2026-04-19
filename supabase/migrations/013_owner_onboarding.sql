-- First-time owner setup + onboarding checklist state

alter table public.profiles
  add column if not exists logo_url text,
  add column if not exists business_phone text,
  add column if not exists service_area_center_lat double precision,
  add column if not exists service_area_center_lng double precision,
  add column if not exists service_area_radius_miles double precision,
  add column if not exists onboarding_welcome_dismissed boolean not null default false,
  add column if not exists onboarding_checklist jsonb not null default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_checklist is 'Derived checklist completion flags (auto-updated by client)';

