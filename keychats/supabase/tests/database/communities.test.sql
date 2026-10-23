begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'community-member@keychats.test'),
  ('55555555-5555-5555-5555-555555555555', 'community-admin@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'community_member', 'Community Member', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'cxu1344', 'Admin', 'active');

select has_table('public', 'communities', 'communities table exists');
select has_table('public', 'community_posts', 'community posts table exists');
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.communities'::regclass), false),
  'communities have RLS enabled'
);
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.community_posts'::regclass), false),
  'community posts have RLS enabled'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select results_eq(
  $$
    insert into public.communities (id, name, created_by)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '자유게시판', '11111111-1111-1111-1111-111111111111')
    returning name
  $$,
  $$ values ('자유게시판'::text) $$,
  'active member can create a community'
);

select results_eq(
  $$
    insert into public.community_posts (community_id, author_id, body)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '첫 글')
    returning body
  $$,
  $$ values ('첫 글'::text) $$,
  'active member can write in a community'
);

select results_eq(
  $$
    delete from public.communities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'regular member cannot delete a community'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

select results_eq(
  $$
    delete from public.communities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    returning id
  $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) $$,
  'admin can delete a community'
);

select * from finish();
rollback;
