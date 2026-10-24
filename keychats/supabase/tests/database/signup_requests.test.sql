begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'signup_requests', 'signup_requests table exists');
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'signup_requests'
      and column_name = 'auth_user_id'
      and is_nullable = 'YES'
  ),
  'auth_user_id is nullable for rejected audit rows'
);
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'signup_requests'
      and c.contype = 'f'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'n'
  ),
  'auth user foreign key uses ON DELETE SET NULL'
);
select ok(
  not has_table_privilege('anon', 'public.signup_requests', 'SELECT')
  and not has_table_privilege('anon', 'public.signup_requests', 'INSERT')
  and not has_table_privilege('anon', 'public.signup_requests', 'UPDATE')
  and not has_table_privilege('anon', 'public.signup_requests', 'DELETE'),
  'anon has no direct signup_requests privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public.signup_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.signup_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.signup_requests', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.signup_requests', 'DELETE'),
  'authenticated has no direct signup_requests privileges'
);
select has_function(
  'public',
  'approve_signup_request_server',
  array['uuid', 'uuid', 'timestamp with time zone'],
  'approval RPC exists'
);
select has_function(
  'public',
  'reject_signup_request_server',
  array['uuid', 'uuid', 'timestamp with time zone'],
  'rejection RPC exists'
);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'signup-admin@keychats.test'),
  ('10000000-0000-0000-0000-000000000002', 'first@keychats.test'),
  ('10000000-0000-0000-0000-000000000003', 'second@keychats.test'),
  ('10000000-0000-0000-0000-000000000004', 'approve@keychats.test'),
  ('10000000-0000-0000-0000-000000000005', 'missing-general@keychats.test'),
  ('10000000-0000-0000-0000-000000000006', 'reject@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('10000000-0000-0000-0000-000000000001', 'signup_admin', 'Signup Admin', 'active');

insert into public.channels (id, name, created_by, is_default) values
  ('20000000-0000-0000-0000-000000000001', 'general', '10000000-0000-0000-0000-000000000001', true);

insert into public.signup_requests (id, auth_user_id, username, display_name) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'reuse_me', 'First Request');

select throws_ok(
  $$
    insert into public.signup_requests (auth_user_id, username, display_name)
    values ('10000000-0000-0000-0000-000000000003', 'reuse_me', 'Duplicate Pending')
  $$,
  '23505',
  null,
  'only one pending request can reserve a username'
);

update public.signup_requests
set status = 'rejected', reviewed_at = '2026-10-22T07:00:00Z', reviewed_by = '10000000-0000-0000-0000-000000000001'
where id = '30000000-0000-0000-0000-000000000001';

select lives_ok(
  $$
    insert into public.signup_requests (auth_user_id, username, display_name)
    values ('10000000-0000-0000-0000-000000000003', 'reuse_me', 'Retry Request')
  $$,
  'a rejected username can be requested again'
);

insert into public.signup_requests (id, auth_user_id, username, display_name) values
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'approve_me', 'Approve Me');

select ok(
  public.approve_signup_request_server(
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-22T07:05:00Z'
  ),
  'approval succeeds for a pending request'
);

select results_eq(
  $$
    select p.username, p.display_name, p.status, s.theme, cm.role, r.status, r.reviewed_by
    from public.signup_requests r
    join public.profiles p on p.user_id = r.auth_user_id
    join public.user_settings s on s.user_id = p.user_id
    join public.channel_members cm on cm.user_id = p.user_id
    where r.id = '30000000-0000-0000-0000-000000000004'
      and cm.channel_id = '20000000-0000-0000-0000-000000000001'
  $$,
  $$
    values (
      'approve_me'::text,
      'Approve Me'::text,
      'active'::text,
      'light'::text,
      'member'::text,
      'approved'::text,
      '10000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'approval atomically provisions the active workspace member'
);

select ok(
  not public.approve_signup_request_server(
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-22T07:06:00Z'
  ),
  'an approved request cannot be approved twice'
);

insert into public.signup_requests (id, auth_user_id, username, display_name) values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'no_general', 'No General');

delete from public.channels where id = '20000000-0000-0000-0000-000000000001';

select ok(
  not public.approve_signup_request_server(
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-22T07:10:00Z'
  ),
  'approval fails safely when general channel is missing'
);

select results_eq(
  $$
    select r.status, exists(select 1 from public.profiles p where p.user_id = r.auth_user_id)
    from public.signup_requests r
    where r.id = '30000000-0000-0000-0000-000000000005'
  $$,
  $$ values ('pending'::text, false) $$,
  'failed approval leaves request pending with no partial profile'
);

insert into public.signup_requests (id, auth_user_id, username, display_name) values
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'reject_me', 'Reject Me');

select is(
  public.reject_signup_request_server(
    '30000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    '2026-10-22T07:15:00Z'
  ),
  '10000000-0000-0000-0000-000000000006'::uuid,
  'rejection returns the Auth user id for server-side deletion'
);

select results_eq(
  $$
    select status, auth_user_id, reviewed_by
    from public.signup_requests
    where id = '30000000-0000-0000-0000-000000000006'
  $$,
  $$
    values (
      'rejected'::text,
      '10000000-0000-0000-0000-000000000006'::uuid,
      '10000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'rejection keeps the Auth id until deletion so cleanup can be retried'
);

delete from auth.users where id = '10000000-0000-0000-0000-000000000006';

select results_eq(
  $$
    select username, display_name, status, auth_user_id
    from public.signup_requests
    where id = '30000000-0000-0000-0000-000000000006'
  $$,
  $$ values ('reject_me'::text, 'Reject Me'::text, 'rejected'::text, null::uuid) $$,
  'Auth deletion preserves the rejected audit row and clears auth_user_id'
);

select * from finish();
rollback;
