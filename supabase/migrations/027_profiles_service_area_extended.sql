-- Extended service area fields for Settings map (business pin + radius + covered cities)
alter table public.profiles
  add column if not exists business_address text,
  add column if not exists business_lat double precision,
  add column if not exists business_lng double precision,
  add column if not exists service_radius_miles double precision,
  add column if not exists covered_cities jsonb not null default '[]'::jsonb;

comment on column public.profiles.business_address is 'Formatted business address from Places / owner';
comment on column public.profiles.business_lat is 'Business location latitude (WGS84)';
comment on column public.profiles.business_lng is 'Business location longitude (WGS84)';
comment on column public.profiles.service_radius_miles is 'Service coverage radius in statute miles';
comment on column public.profiles.covered_cities is 'JSON array of locality names within service radius';
