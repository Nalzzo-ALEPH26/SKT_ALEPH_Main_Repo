begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'invites', 'invites table exists');
select has_table('public', 'channels', 'channels table exists');
select has_table('public', 'channel_members', 'channel_members table exists');
select has_table('public', 'dm_threads', 'dm_threads table exists');
select has_table('public', 'messages', 'messages table exists');
select has_table('public', 'attachments', 'attachments table exists');
select has_table('public', 'message_reactions', 'message_reactions table exists');
select has_table('public', 'message_pins', 'message_pins table exists');
select has_table('public', 'read_states', 'read_states table exists');
select has_table('public', 'user_settings', 'user_settings table exists');
select has_table('public', 'url_previews', 'url_previews table exists');

select ok(
  (
    select count(*) = 12 and bool_and(c.relrowsecurity)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname = any(array[
        'profiles', 'invites', 'channels', 'channel_members', 'dm_threads',
        'messages', 'attachments', 'message_reactions', 'message_pins',
        'read_states', 'user_settings', 'url_previews'
      ])
  ),
  'RLS is enabled on every exposed Keychats table'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'channel_members'
      and c.contype = 'p'
      and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (channel_id, user_id)'
  ),
  'channel_members has a composite primary key'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'message_reactions'
      and c.contype = 'p'
      and pg_get_constraintdef(c.oid) = 'PRIMARY KEY (message_id, user_id, emoji)'
  ),
  'message_reactions prevents duplicate user emoji reactions'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'messages'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%channel_id%dm_thread_id%'
  ),
  'messages enforce exactly one conversation target'
);

select ok(
  (
    select count(*) = 2
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'read_states'
      and indexname in ('read_states_channel_user_uidx', 'read_states_dm_user_uidx')
  ),
  'read_states has per-room uniqueness indexes'
);

select * from finish();
rollback;
