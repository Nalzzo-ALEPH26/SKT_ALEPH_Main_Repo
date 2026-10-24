alter table public.channels
  add column is_default boolean not null default false;

update public.channels
set is_default = true
where lower(btrim(name)) = 'general';

alter table public.channels
  add constraint channels_default_name
  check (not is_default or lower(btrim(name)) = 'general');

create unique index channels_normalized_name_uidx
  on public.channels (lower(btrim(name)));

drop policy channels_insert_active_creator on public.channels;
create policy channels_insert_active_creator
on public.channels
for insert
to authenticated
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
  and not is_default
  and lower(btrim(name)) <> 'general'
);

drop policy channels_delete_admin_only on public.channels;
create policy channels_delete_admin_only
on public.channels
for delete
to authenticated
using (
  (select private.is_admin())
  and not is_default
  and lower(btrim(name)) <> 'general'
);
