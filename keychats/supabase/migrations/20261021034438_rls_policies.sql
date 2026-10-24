create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_user_active(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = target_user_id
      and p.status = 'active'
  );
$$;

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.is_user_active((select auth.uid()));
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function private.can_access_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.channel_members cm
      where cm.channel_id = target_channel_id
        and cm.user_id = (select auth.uid())
    );
$$;

create or replace function private.can_manage_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and (
      private.is_admin()
      or exists (
        select 1
        from public.channels c
        where c.id = target_channel_id
          and c.created_by = (select auth.uid())
      )
    );
$$;

create or replace function private.can_access_dm(target_dm_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.dm_threads d
      where d.id = target_dm_thread_id
        and (select auth.uid()) in (d.user_low, d.user_high)
    );
$$;

create or replace function private.can_access_message(target_message_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_user()
    and exists (
      select 1
      from public.messages m
      where m.id = target_message_id
        and (
          (m.channel_id is not null and private.can_access_channel(m.channel_id))
          or
          (m.dm_thread_id is not null and private.can_access_dm(m.dm_thread_id))
        )
    );
$$;

create or replace function private.can_access_live_message(target_message_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_message(target_message_id)
    and exists (
      select 1
      from public.messages m
      where m.id = target_message_id
        and m.deleted_at is null
    );
$$;

create or replace function private.reply_matches_room(
  target_reply_id bigint,
  target_channel_id uuid,
  target_dm_thread_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_reply_id is null
    or exists (
      select 1
      from public.messages parent
      where parent.id = target_reply_id
        and parent.deleted_at is null
        and parent.channel_id is not distinct from target_channel_id
        and parent.dm_thread_id is not distinct from target_dm_thread_id
    );
$$;

create or replace function private.read_marker_matches_room(
  target_message_id bigint,
  target_channel_id uuid,
  target_dm_thread_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_message_id is null
    or exists (
      select 1
      from public.messages m
      where m.id = target_message_id
        and m.channel_id is not distinct from target_channel_id
        and m.dm_thread_id is not distinct from target_dm_thread_id
    );
$$;

revoke all on function private.is_user_active(uuid) from public, anon, authenticated;
revoke all on function private.is_active_user() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.can_access_channel(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_channel(uuid) from public, anon, authenticated;
revoke all on function private.can_access_dm(uuid) from public, anon, authenticated;
revoke all on function private.can_access_message(bigint) from public, anon, authenticated;
revoke all on function private.can_access_live_message(bigint) from public, anon, authenticated;
revoke all on function private.reply_matches_room(bigint, uuid, uuid) from public, anon, authenticated;
revoke all on function private.read_marker_matches_room(bigint, uuid, uuid) from public, anon, authenticated;

grant execute on function private.is_user_active(uuid) to authenticated;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_access_channel(uuid) to authenticated;
grant execute on function private.can_manage_channel(uuid) to authenticated;
grant execute on function private.can_access_dm(uuid) to authenticated;
grant execute on function private.can_access_message(bigint) to authenticated;
grant execute on function private.can_access_live_message(bigint) to authenticated;
grant execute on function private.reply_matches_room(bigint, uuid, uuid) to authenticated;
grant execute on function private.read_marker_matches_room(bigint, uuid, uuid) to authenticated;

create policy profiles_select_active_team
on public.profiles
for select
to authenticated
using (
  (select private.is_active_user())
  and (status = 'active' or (select private.is_admin()))
);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (
  (select private.is_active_user())
  and user_id = (select auth.uid())
)
with check (
  (select private.is_active_user())
  and user_id = (select auth.uid())
  and status = 'active'
);

create policy channels_select_members
on public.channels
for select
to authenticated
using (
  (select private.can_access_channel(id))
  or (select private.is_admin())
);

create policy channels_insert_active_creator
on public.channels
for insert
to authenticated
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
);

create policy channels_update_creator_or_admin
on public.channels
for update
to authenticated
using ((select private.can_manage_channel(id)))
with check ((select private.can_manage_channel(id)));

create policy channels_delete_admin_only
on public.channels
for delete
to authenticated
using ((select private.is_admin()));

create policy channel_members_select_room_members
on public.channel_members
for select
to authenticated
using (
  (select private.can_access_channel(channel_id))
  or (select private.is_admin())
);

create policy channel_members_insert_manager
on public.channel_members
for insert
to authenticated
with check (
  (select private.can_manage_channel(channel_id))
  and (select private.is_user_active(user_id))
);

create policy channel_members_delete_manager
on public.channel_members
for delete
to authenticated
using ((select private.can_manage_channel(channel_id)));

create policy dm_threads_select_participants
on public.dm_threads
for select
to authenticated
using ((select private.can_access_dm(id)));

create policy dm_threads_insert_participant_pair
on public.dm_threads
for insert
to authenticated
with check (
  (select private.is_active_user())
  and (select auth.uid()) in (user_low, user_high)
  and (select private.is_user_active(user_low))
  and (select private.is_user_active(user_high))
);

create policy messages_select_room_members
on public.messages
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
);

create policy messages_insert_sender
on public.messages
for insert
to authenticated
with check (
  (select private.is_active_user())
  and sender_id = (select auth.uid())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
  and (select private.reply_matches_room(reply_to_id, channel_id, dm_thread_id))
);

create policy messages_update_own_live
on public.messages
for update
to authenticated
using (
  (select private.is_active_user())
  and sender_id = (select auth.uid())
  and deleted_at is null
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
)
with check (
  sender_id = (select auth.uid())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
  and (select private.reply_matches_room(reply_to_id, channel_id, dm_thread_id))
  and (deleted_at is null or body is null)
);

create policy attachments_select_live_message_members
on public.attachments
for select
to authenticated
using ((select private.can_access_live_message(message_id)));

create policy attachments_insert_uploader
on public.attachments
for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and (select private.can_access_live_message(message_id))
);

create policy reactions_select_room_members
on public.message_reactions
for select
to authenticated
using ((select private.can_access_live_message(message_id)));

create policy reactions_insert_self
on public.message_reactions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_access_live_message(message_id))
);

create policy reactions_delete_self
on public.message_reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_live_message(message_id))
);

create policy pins_select_room_members
on public.message_pins
for select
to authenticated
using ((select private.can_access_live_message(message_id)));

create policy pins_insert_room_member
on public.message_pins
for insert
to authenticated
with check (
  pinned_by = (select auth.uid())
  and (select private.can_access_live_message(message_id))
);

create policy pins_delete_room_member
on public.message_pins
for delete
to authenticated
using ((select private.can_access_live_message(message_id)));

create policy read_states_select_room_members
on public.read_states
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
);

create policy read_states_insert_self
on public.read_states
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_active_user())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
  and (select private.read_marker_matches_room(last_read_message_id, channel_id, dm_thread_id))
);

create policy read_states_update_self
on public.read_states
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_user())
)
with check (
  user_id = (select auth.uid())
  and (select private.is_active_user())
  and (
    (channel_id is not null and (select private.can_access_channel(channel_id)))
    or
    (dm_thread_id is not null and (select private.can_access_dm(dm_thread_id)))
  )
  and (select private.read_marker_matches_room(last_read_message_id, channel_id, dm_thread_id))
);

create policy user_settings_select_self
on public.user_settings
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_user())
);

create policy user_settings_insert_self
on public.user_settings
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_active_user())
);

create policy user_settings_update_self
on public.user_settings
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_user())
)
with check (
  user_id = (select auth.uid())
  and (select private.is_active_user())
);

create policy url_previews_select_room_members
on public.url_previews
for select
to authenticated
using ((select private.can_access_live_message(message_id)));
