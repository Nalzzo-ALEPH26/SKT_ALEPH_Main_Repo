drop policy if exists messages_select_room_members on public.messages;
create policy messages_select_room_members
on public.messages
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    (
      channel_id is not null
      and (
        (select private.can_access_channel(channel_id))
        or (select private.is_admin())
      )
    )
    or
    (
      dm_thread_id is not null
      and (select private.can_access_dm(dm_thread_id))
    )
  )
);

drop policy if exists messages_update_own_live on public.messages;
create policy messages_update_own_live
on public.messages
for update
to authenticated
using (
  (select private.is_active_user())
  and deleted_at is null
  and (
    (
      sender_id = (select auth.uid())
      and (
        (channel_id is not null and (select private.can_access_channel(channel_id)))
        or
        (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
      )
    )
    or
    (
      (select private.is_admin())
      and channel_id is not null
      and dm_thread_id is null
    )
  )
)
with check (
  (
    sender_id = (select auth.uid())
    and (
      (channel_id is not null and (select private.can_access_channel(channel_id)))
      or
      (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
    )
    and (select private.reply_matches_room(reply_to_id, channel_id, dm_thread_id))
    and (deleted_at is null or body is null)
  )
  or
  (
    (select private.is_admin())
    and channel_id is not null
    and dm_thread_id is null
    and body is null
    and deleted_at is not null
  )
);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;
