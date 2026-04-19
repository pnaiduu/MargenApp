-- Calls & AI receptionist (Twilio + Bland AI)

-- Extend call statuses to include in_progress + converted
alter table public.phone_calls
  drop constraint if exists phone_calls_status_check;

alter table public.phone_calls
  add constraint phone_calls_status_check
  check (status in ('in_progress', 'answered', 'missed', 'called_back', 'converted'));

alter table public.phone_calls
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

create index if not exists phone_calls_owner_twilio_sid_idx on public.phone_calls (owner_id, twilio_call_sid);
create index if not exists phone_calls_owner_status_occurred_idx on public.phone_calls (owner_id, status, occurred_at desc);

-- Owner phone settings for forwarding + receptionist behavior
alter table public.profiles
  add column if not exists rings_before_ai integer not null default 3 check (rings_before_ai between 1 and 10),
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists after_hours_message text;

-- Draft jobs created by AI receptionist (owner approves with one click)
alter table public.jobs
  add column if not exists needs_approval boolean not null default false,
  add column if not exists source text,
  add column if not exists source_phone_call_id uuid references public.phone_calls (id) on delete set null;

create index if not exists jobs_owner_needs_approval_idx on public.jobs (owner_id, needs_approval, created_at desc);

-- Missed call notifications should fire on UPDATE as well (not just insert)
create or replace function public.notify_missed_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  body text;
  was_missed boolean;
begin
  was_missed := (tg_op = 'INSERT' and new.status = 'missed')
    or (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'missed');

  if not was_missed then
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
  after insert or update of status on public.phone_calls
  for each row execute function public.notify_missed_call();

