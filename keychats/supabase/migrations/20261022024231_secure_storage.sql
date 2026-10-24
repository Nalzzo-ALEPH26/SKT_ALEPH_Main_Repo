insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_active_team on storage.objects;
create policy avatars_select_active_team
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.is_active_user())
);

drop policy if exists avatars_insert_self on storage.objects;
create policy avatars_insert_self
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_update_self on storage.objects;
create policy avatars_update_self
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists avatars_delete_self on storage.objects;
create policy avatars_delete_self
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists chat_attachments_select_room_members on storage.objects;
create policy chat_attachments_select_room_members
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and (select private.is_active_user())
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = name
      and (select private.can_access_live_message(a.message_id))
  )
);

drop policy if exists chat_attachments_insert_self on storage.objects;
create policy chat_attachments_insert_self
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists chat_attachments_delete_self on storage.objects;
create policy chat_attachments_delete_self
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-attachments'
  and (select private.is_active_user())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists attachments_insert_uploader on public.attachments;
create policy attachments_insert_uploader
on public.attachments
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id = (select auth.uid())
      and m.deleted_at is null
      and (select private.can_access_live_message(m.id))
  )
);

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attachments'
  ) then
    execute 'alter publication supabase_realtime add table public.attachments';
  end if;
end
$$;
