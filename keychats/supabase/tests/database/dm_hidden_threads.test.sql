begin;

create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'hide1@keychats.test'),
  ('22222222-2222-2222-2222-222222222222', 'hide2@keychats.test'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'hide1', 'Hide One', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'hide2', 'Hide Two', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'outsider', 'Outsider', 'active');

insert into public.dm_threads (id, user_low, user_high) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select lives_ok(
  $$
    insert into public.dm_hidden_threads (dm_thread_id, user_id)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111')
  $$,
  'DM participant can hide a thread for self'
);

select is(
  (select count(*) from public.dm_hidden_threads),
  1::bigint,
  'user sees their own hidden DM row'
);

select throws_ok(
  $$
    insert into public.dm_hidden_threads (dm_thread_id, user_id)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222')
  $$,
  '42501',
  null,
  'user cannot hide a thread on behalf of the other participant'
);

select results_eq(
  $$
    delete from public.dm_hidden_threads
    where dm_thread_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and user_id = '11111111-1111-1111-1111-111111111111'
    returning user_id
  $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'user can restore their own hidden DM row'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select throws_ok(
  $$
    insert into public.dm_hidden_threads (dm_thread_id, user_id)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333')
  $$,
  '42501',
  null,
  'non-participant cannot create hidden state for a DM'
);

select * from finish();
rollback;