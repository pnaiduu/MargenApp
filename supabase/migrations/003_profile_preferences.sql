-- Theme and accent preferences (per owner account)
alter table public.profiles
  add column if not exists theme_mode text not null default 'system'
    check (theme_mode in ('light', 'dark', 'system')),
  add column if not exists accent_hex text not null default '#111827';

comment on column public.profiles.theme_mode is 'UI theme: light, dark, or follow system';
comment on column public.profiles.accent_hex is 'Brand accent color as #RRGGBB';
