-- Optional: allow field technicians to upsert their own `technicians_live` row for the owner dashboard map.
-- Without this, the app still writes GPS to `public.technicians` (RLS already allows technician self-update).

create unique index if not exists technicians_live_technician_id_uidx
  on public.technicians_live (technician_id);

drop policy if exists technicians_live_tech_upsert on public.technicians_live;

create policy technicians_live_tech_upsert on public.technicians_live
  for all
  using (
    exists (
      select 1 from public.technicians t
      where t.id = technicians_live.technician_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.technicians t
      where t.id = technicians_live.technician_id
        and t.user_id = auth.uid()
    )
    and owner_id = (select t2.owner_id from public.technicians t2 where t2.id = technician_id)
  );
