begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'member1@keychats.test'),
  ('22222222-2222-2222-2222-222222222222', 'member2@keychats.test'),
  ('33333333-3333-3333-3333-333333333333', 'member3@keychats.test'),
  ('44444444-4444-4444-4444-444444444444', 'disabled@keychats.test'),
  ('55555555-5555-5555-5555-555555555555', 'admin@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'member1', 'Member One', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'member2', 'Member Two', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'member3', 'Member Three', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'disabled', 'Disabled User', 'disabled'),
  ('55555555-5555-5555-5555-555555555555', 'cxu1344', 'Admin', 'active');

insert into public.channels (id, name, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'private-a', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-delete-target', '22222222-2222-2222-2222-222222222222'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'general', '55555555-5555-5555-5555-555555555555');

insert into public.channel_members (channel_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '55555555-5555-5555-5555-555555555555', 'owner');

insert into public.dm_threads (id, user_low, user_high) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.messages (channel_id, sender_id, body) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'private channel message');

insert into public.messages (dm_thread_id, sender_id, body) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'private dm message');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select is(
  (select count(*) from public.channels where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'channel member can see their private channel'
);

select is(
  (select count(*) from public.profiles),
  4::bigint,
  'active member sees active teammates but not disabled users'
);

select results_eq(
  $$
    insert into public.channel_members (channel_id, user_id, role)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member')
    returning user_id
  $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'channel creator can add an active member'
);

select results_eq(
  $$
    delete from public.channel_members
    where channel_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      and user_id = '22222222-2222-2222-2222-222222222222'
    returning user_id
  $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid) $$,
  'channel creator can remove a member'
);

select results_eq(
  $$
    delete from public.channels
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'regular member cannot delete a channel'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select is(
  (select count(*) from public.channels where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'non-member cannot discover private channel metadata by known UUID'
);

select is(
  (select count(*) from public.messages where channel_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'non-member cannot read private channel messages'
);

select is(
  (select count(*) from public.dm_threads where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0::bigint,
  'third party cannot discover a one-to-one DM'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select is(
  (select count(*) from public.channels where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'disabled user cannot access a channel even with existing membership'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

select is(
  (select count(*) from public.messages where channel_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'admin can read a channel message for moderation even when not a channel member'
);

select is(
  (select count(*) from public.messages where dm_thread_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0::bigint,
  'admin gets no implicit access to a one-to-one DM'
);

select results_eq(
  $$
    update public.messages
    set body = null, deleted_at = now()
    where channel_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    returning channel_id
  $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) $$,
  'admin can soft delete a channel message for moderation'
);

select results_eq(
  $$
    update public.messages
    set body = null, deleted_at = now()
    where dm_thread_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    returning dm_thread_id
  $$,
  $$ select null::uuid where false $$,
  'admin cannot modify a DM they do not participate in'
);

select results_eq(
  $$
    delete from public.channels
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    returning id
  $$,
  $$ values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid) $$,
  'admin can delete any ordinary channel'
);

select results_eq(
  $$
    delete from public.channels
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'admin cannot delete the default general channel'
);

select * from finish();
rollback;