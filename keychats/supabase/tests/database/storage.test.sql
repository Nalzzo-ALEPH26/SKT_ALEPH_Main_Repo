begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'avatars'
      and public = false
      and file_size_limit = 10485760
  ),
  'avatars bucket is private with a 10 MiB limit'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'chat-attachments'
      and public = false
      and file_size_limit = 10485760
  ),
  'chat attachments bucket is private with a 10 MiB limit'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_select_active_team'
  ),
  'avatars require an authenticated team read policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_insert_self'
  ),
  'avatar uploads are restricted to the owner path'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_attachments_select_room_members'
  ),
  'chat attachment reads require message access'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'chat_attachments_insert_self'
  ),
  'chat attachment uploads are restricted to the owner path'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'attachments'
      and policyname = 'attachments_insert_uploader'
  ),
  'attachment metadata insert policy exists'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attachments'
  ),
  'attachment metadata is published to realtime'
);

select * from finish();
rollback;
