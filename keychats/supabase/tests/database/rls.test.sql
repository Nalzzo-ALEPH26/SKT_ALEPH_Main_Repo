begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-delete-target', '22222222-2222-2222-2222-222222222222');

insert into public.channel_members (channel_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member');

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

select is(
  (
    with deleted as (
      delete from public.channels
      where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      returning 1
    )
    select count(*) from deleted
  ),
  0::bigint,
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
  (
    with deleted as (
      delete from public.channels
      where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      returning 1
    )
    select count(*) from deleted
  ),
  1::bigint,
  'admin can delete any channel'
);

select * from finish();
rollback;
