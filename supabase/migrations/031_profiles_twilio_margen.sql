-- Twilio Margen line + call forwarding onboarding (per owner profile)
alter table public.profiles
  add column if not exists margen_phone_number text,
  add column if not exists margen_phone_sid text,
  add column if not exists twilio_forwarding_code text,
  add column if not exists carrier text,
  add column if not exists call_forwarding_active boolean not null default false;

comment on column public.profiles.margen_phone_number is 'E.164 Twilio DID owned by Margen for this business (voice webhook → Retell)';
comment on column public.profiles.margen_phone_sid is 'Twilio IncomingPhoneNumber SID';
comment on column public.profiles.twilio_forwarding_code is 'Carrier-specific forwarding activation snippet or instructions for SMS/UI';
comment on column public.profiles.carrier is 'Mobile carrier slug for forwarding instructions (att, verizon, tmobile, google_voice, ringcentral, other)';
comment on column public.profiles.call_forwarding_active is 'Owner confirmed missed-call forwarding to Margen number';

create index if not exists profiles_margen_phone_number_idx
  on public.profiles (margen_phone_number)
  where margen_phone_number is not null;

-- Fast Twilio “To” → owner lookup (digits only, unique per assigned DID)
alter table public.profiles
  add column if not exists margen_phone_digits text
  generated always as (
    case
      when margen_phone_number is null or btrim(margen_phone_number) = '' then null
      else regexp_replace(margen_phone_number, '\D', '', 'g')
    end
  ) stored;

create unique index if not exists profiles_margen_phone_digits_uidx
  on public.profiles (margen_phone_digits)
  where margen_phone_digits is not null;
