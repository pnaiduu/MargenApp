-- Notifications system (owner dashboard + technician app)

-- Extend job status to support cancellations (needed for technician notifications)
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs
  add constraint jobs_status_check check (status in ('pending', 'in_progress', 'completed', 'cancelled'));

-- Notifications table (single feed for owners + technicians)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Owner who owns the business context; also used for RLS scoping
  owner_id uuid not null references auth.users (id) on delete cascade,

  -- Recipient auth user id (owner user id OR technician auth user id)
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_role text not null check (recipient_role in ('owner', 'technician')),

  -- Event type
  type text not null,

  title text not null,
  body text,
  link_path text,
  metadata jsonb not null default '{}'::jsonb,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);

create index if not exists notifications_owner_created_idx
  on public.notifications (owner_id, created_at desc);

alter table public.notifications enable row level security;

-- Recipient can read/update their own notifications
create policy notifications_select_own on public.notifications for select
  using (auth.uid() = recipient_user_id);

create policy notifications_update_own on public.notifications for update
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- Owner can insert notifications for their business (server-side functions use service role)
create policy notifications_owner_insert on public.notifications for insert
  with check (auth.uid() = owner_id and recipient_role = 'owner' and recipient_user_id = owner_id);

-- Expo push tokens (technician app)
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

create policy expo_push_tokens_self_all on public.expo_push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger helper (re-use if exists)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expo_push_tokens_set_updated_at on public.expo_push_tokens;
create trigger expo_push_tokens_set_updated_at
  before update on public.expo_push_tokens
  for each row execute function public.set_updated_at();

-- Helper: create notification
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
    recipient_user_id,
    recipient_role,
    type,
    title,
    body,
    link_path,
    metadata
  )
  values (
    p_owner_id,
    p_recipient_user_id,
    p_recipient_role,
    p_type,
    left(coalesce(p_title, ''), 120),
    nullif(left(coalesce(p_body, ''), 600), ''),
    nullif(left(coalesce(p_link_path, ''), 200), ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.notify(uuid, uuid, text, text, text, text, text, jsonb) from public;

-- Trigger: missed call -> owner notification (phone_calls)
create or replace function public.notify_missed_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  body text;
begin
  if new.status <> 'missed' then
    return new;
  end if;
  body := case
    when new.caller_phone is null or trim(new.caller_phone) = '' then 'A caller missed you.'
    else 'Missed call from ' || new.caller_phone
  end;
  perform public.notify(
    new.owner_id,
    new.owner_id,
    'owner',
    'missed_call',
    'New missed call',
    body,
    '/calls',
    jsonb_build_object('phone_call_id', new.id, 'caller_phone', new.caller_phone)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_missed_call on public.phone_calls;
create trigger trg_notify_missed_call
  after insert on public.phone_calls
  for each row execute function public.notify_missed_call();

-- Trigger: job completed -> owner notification
create or replace function public.notify_job_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust_name text;
  tech_name text;
begin
  if (old.status is distinct from new.status) and new.status = 'completed' then
    select c.name into cust_name from public.customers c where c.id = new.customer_id;
    select t.name into tech_name from public.technicians t where t.id = new.technician_id;
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'job_completed',
      'Job completed',
      coalesce(new.title, 'Job') || coalesce(case when cust_name is null then '' else ' · ' || cust_name end, ''),
      '/jobs',
      jsonb_build_object('job_id', new.id, 'technician_name', tech_name, 'customer_name', cust_name)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_job_completed on public.jobs;
create trigger trg_notify_job_completed
  after update on public.jobs
  for each row execute function public.notify_job_completed();

-- Trigger: job cancelled -> technician + owner notification
create or replace function public.notify_job_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tech_user uuid;
begin
  if (old.status is distinct from new.status) and new.status = 'cancelled' then
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'job_cancelled',
      'Job cancelled',
      coalesce(new.title, 'Job') || ' was cancelled.',
      '/jobs',
      jsonb_build_object('job_id', new.id)
    );

    select t.user_id into tech_user from public.technicians t where t.id = new.technician_id;
    if tech_user is not null then
      perform public.notify(
        new.owner_id,
        tech_user,
        'technician',
        'job_cancelled',
        'Job cancelled',
        coalesce(new.title, 'Job') || ' was cancelled.',
        null,
        jsonb_build_object('job_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_job_cancelled on public.jobs;
create trigger trg_notify_job_cancelled
  after update on public.jobs
  for each row execute function public.notify_job_cancelled();

-- Trigger: job assigned / schedule changed -> technician notification
create or replace function public.notify_job_assignment_or_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tech_user uuid;
begin
  -- New assignment
  if old.technician_id is distinct from new.technician_id and new.technician_id is not null then
    select t.user_id into new_tech_user from public.technicians t where t.id = new.technician_id;
    if new_tech_user is not null then
      perform public.notify(
        new.owner_id,
        new_tech_user,
        'technician',
        'job_assigned',
        'New job assigned',
        coalesce(new.title, 'Job'),
        null,
        jsonb_build_object('job_id', new.id)
      );
    end if;
  end if;

  -- Schedule changed (scheduled_at)
  if old.scheduled_at is distinct from new.scheduled_at and new.technician_id is not null then
    select t.user_id into new_tech_user from public.technicians t where t.id = new.technician_id;
    if new_tech_user is not null then
      perform public.notify(
        new.owner_id,
        new_tech_user,
        'technician',
        'schedule_changed',
        'Schedule changed',
        coalesce(new.title, 'Job'),
        null,
        jsonb_build_object('job_id', new.id, 'scheduled_at', new.scheduled_at)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_job_assignment_or_schedule on public.jobs;
create trigger trg_notify_job_assignment_or_schedule
  after update on public.jobs
  for each row execute function public.notify_job_assignment_or_schedule();

-- Trigger: rating submitted -> owner notification
create or replace function public.notify_rating_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_title text;
begin
  if old.submitted_at is null and new.submitted_at is not null then
    select j.title into job_title from public.jobs j where j.id = new.job_id;
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'customer_rating',
      'New customer rating',
      'Rating: ' || new.rating::text || '/5' || coalesce(case when trim(coalesce(job_title, '')) = '' then '' else ' · ' || job_title end, ''),
      '/rate',
      jsonb_build_object('job_id', new.job_id, 'rating', new.rating, 'comment', new.comment)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_rating_submitted on public.job_customer_ratings;
create trigger trg_notify_rating_submitted
  after update on public.job_customer_ratings
  for each row execute function public.notify_rating_submitted();

-- Trigger: payment received (invoice paid) -> owner + technician notification
create or replace function public.notify_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tech_user uuid;
begin
  if (old.status is distinct from new.status) and new.status = 'paid' then
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'payment_received',
      'Payment received',
      'Invoice #' || new.invoice_number::text || ' paid.',
      '/payments',
      jsonb_build_object('invoice_id', new.id, 'amount_cents', new.amount_cents, 'job_id', new.job_id)
    );
    if new.technician_id is not null then
      select t.user_id into tech_user from public.technicians t where t.id = new.technician_id;
      if tech_user is not null then
        perform public.notify(
          new.owner_id,
          tech_user,
          'technician',
          'payment_processed',
          'Payment processed',
          'A payment was processed for your job.',
          null,
          jsonb_build_object('invoice_id', new.id, 'job_id', new.job_id, 'amount_cents', new.amount_cents)
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_invoice_paid on public.invoices;
create trigger trg_notify_invoice_paid
  after update on public.invoices
  for each row execute function public.notify_invoice_paid();

-- Trigger: technician clock session started/ended -> owner notification
create or replace function public.notify_technician_clock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tech_name text;
begin
  select t.name into tech_name from public.technicians t where t.id = new.technician_id;

  if tg_op = 'INSERT' then
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'technician_clock_in',
      'Technician clocked in',
      coalesce(tech_name, 'Technician') || ' clocked in.',
      '/technicians',
      jsonb_build_object('technician_id', new.technician_id, 'clock_session_id', new.id)
    );
  elsif tg_op = 'UPDATE' and old.clock_out_at is null and new.clock_out_at is not null then
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'technician_clock_out',
      'Technician clocked out',
      coalesce(tech_name, 'Technician') || ' clocked out.',
      '/technicians',
      jsonb_build_object('technician_id', new.technician_id, 'clock_session_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_technician_clock_ins on public.technician_clock_sessions;
create trigger trg_notify_technician_clock_ins
  after insert on public.technician_clock_sessions
  for each row execute function public.notify_technician_clock();

drop trigger if exists trg_notify_technician_clock_upd on public.technician_clock_sessions;
create trigger trg_notify_technician_clock_upd
  after update on public.technician_clock_sessions
  for each row execute function public.notify_technician_clock();

-- Trigger: technician joined (invite consumed) -> owner notification
create or replace function public.notify_technician_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.consumed_at is null and new.consumed_at is not null then
    perform public.notify(
      new.owner_id,
      new.owner_id,
      'owner',
      'technician_joined',
      'New technician joined',
      coalesce(new.invited_name, 'Technician') || ' joined your team.',
      '/technicians',
      jsonb_build_object('technician_id', new.technician_id, 'invite_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_technician_joined on public.technician_invites;
create trigger trg_notify_technician_joined
  after update on public.technician_invites
  for each row execute function public.notify_technician_joined();

