-- Appearance preferences: theme_mode and accent_color on profiles (idempotent)

alter table public.profiles
  add column if not exists theme_mode text,
  add column if not exists accent_color text;

-- Backfill theme_mode from legacy theme column when present
update public.profiles
set theme_mode = theme
where theme_mode is null
  and theme in ('light', 'dark', 'system');

update public.profiles
set theme_mode = 'system'
where theme_mode is null;

alter table public.profiles
  alter column theme_mode set default 'system';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_theme_mode_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_theme_mode_check
      check (theme_mode in ('light', 'dark', 'system'));
  end if;
end $$;

comment on column public.profiles.theme_mode is 'UI theme: light, dark, or follow system';
comment on column public.profiles.accent_color is 'Brand accent color as #RRGGBB';
