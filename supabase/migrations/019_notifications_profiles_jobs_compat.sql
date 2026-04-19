-- Align triggers + extra columns with app expectations after migration 017.
-- Idempotent: safe to run multiple times.

begin;

-- ========= Profiles: ensure owner_id on signup =========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, owner_id, full_name, company_name)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'company_name', '')), '')
  );
  return new;
end;
$$;

-- ========= Notifications: notify() uses 017 column names =========
create or replace function public.notify(
  p_owner_id uuid,
  p_recipient_user_id uuid,
  p_recipient_role text,
  p_type text,
  p_title text,
  p_body text,
  p_link_path text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    owner_id,
    title,
    message,
    type,
    link,
    read
  )
  values (
    p_owner_id,
    left(coalesce(p_title, ''), 120),
    nullif(left(coalesce(p_body, ''), 600), ''),
    p_type,
    nullif(left(coalesce(p_link_path, ''), 200), ''),
    false
  );
end;
$$;

-- ========= Profiles: columns beyond 017 base (017 has theme, accent_color, service_area_radius) =========
alter table public.profiles
  add column if not exists logo_url text,
  add column if not exists business_phone text,
  add column if not exists rings_before_ai integer default 3,
  add column if not exists business_hours jsonb default '{}'::jsonb,
  add column if not exists after_hours_message text,
  add column if not exists service_area_center_lat double precision,
  add column if not exists service_area_center_lng double precision,
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean default false,
  add column if not exists stripe_details_submitted boolean default false,
  add column if not exists vip_threshold_cents integer default 200000,
  add column if not exists onboarding_welcome_dismissed boolean default false,
  add column if not exists onboarding_checklist jsonb default '{}'::jsonb,
  add column if not exists onboarding_completed_at timestamptz;

-- ========= Jobs: columns used by app beyond 017 core =========
alter table public.jobs
  add column if not exists job_type text default 'general',
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancel_reason_details text,
  add column if not exists cancelled_by uuid,
  add column if not exists assignment_note text,
  add column if not exists needs_approval boolean default false,
  add column if not exists source text,
  add column if not exists source_phone_call_id uuid,
  add column if not exists emergency_created_at timestamptz,
  add column if not exists emergency_assigned_at timestamptz,
  add column if not exists emergency_ack_deadline_at timestamptz,
  add column if not exists emergency_ack_at timestamptz,
  add column if not exists emergency_ack_by uuid,
  add column if not exists emergency_assignment_attempt integer default 0,
  add column if not exists emergency_tried_technician_ids uuid[] default '{}'::uuid[],
  add column if not exists paid_at timestamptz,
  add column if not exists is_paid boolean default false;

-- ========= Phone calls: optional fields used by webhooks / UI =========
alter table public.phone_calls
  add column if not exists estimated_value_cents integer default 0,
  add column if not exists duration_seconds integer,
  add column if not exists ai_handled boolean default false,
  add column if not exists collected jsonb default '{}'::jsonb,
  add column if not exists converted_job_id uuid,
  add column if not exists bland_call_id text,
  add column if not exists occurred_at timestamptz;

update public.phone_calls set occurred_at = coalesce(occurred_at, created_at) where occurred_at is null;

-- ========= Customers: lat/lng for routing =========
alter table public.customers
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists owner_notes text,
  add column if not exists phone_normalized text;

-- ========= Technicians: GPS + skills =========
alter table public.technicians
  add column if not exists skills text[] default '{}'::text[],
  add column if not exists map_color text default '#6b7280',
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz,
  add column if not exists email text;

update public.technicians
set last_lat = coalesce(last_lat, latitude), last_lng = coalesce(last_lng, longitude)
where (last_lat is null or last_lng is null)
  and (latitude is not null or longitude is not null);

-- ========= technicians_live: dashboard map fields =========
alter table public.technicians_live
  add column if not exists name text,
  add column if not exists map_color text,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision;

update public.technicians_live
set last_lat = coalesce(last_lat, latitude), last_lng = coalesce(last_lng, longitude)
where (last_lat is null or last_lng is null)
  and (latitude is not null or longitude is not null);

commit;
