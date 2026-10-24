begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'comment-pin-creator@keychats.test'),
  ('32222222-2222-2222-2222-222222222222', 'comment-pin-member@keychats.test'),
  ('35555555-5555-5555-5555-555555555555', 'comment-pin-admin@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('31111111-1111-1111-1111-111111111111', 'pin_creator', 'Pin Creator', 'active'),
  ('32222222-2222-2222-2222-222222222222', 'pin_member', 'Pin Member', 'active'),
  ('35555555-5555-5555-5555-555555555555', 'pin_admin', 'Pin Admin', 'active');

select has_table('public', 'community_comment_pins', 'community comment pins table exists');
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.community_comment_pins'::regclass), false),
  'community comment pins have RLS enabled'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

insert into public.communities (id, name, created_by)
values ('3aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '댓글 고정 게시판', '31111111-1111-1111-1111-111111111111');

insert into public.community_posts (id, community_id, author_id, body)
values (
  '3bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '3aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '31111111-1111-1111-1111-111111111111',
  '댓글 고정 테스트 글'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"32222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

insert into public.community_comments (id, post_id, author_id, body)
values (
  '3ccccccc-cccc-cccc-cccc-cccccccccccc',
  '3bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '32222222-2222-2222-2222-222222222222',
  '다른 사람이 쓴 댓글'
);

select throws_ok(
  $$
    insert into public.community_comment_pins (comment_id, pinned_by)
    values ('3ccccccc-cccc-cccc-cccc-cccccccccccc', '32222222-2222-2222-2222-222222222222')
  $$,
  '42501',
  'new row violates row-level security policy for table "community_comment_pins"',
  'regular non-creator cannot pin a comment'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"31111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}',
  true
);

select results_eq(
  $$
    insert into public.community_comment_pins (comment_id, pinned_by)
    values ('3ccccccc-cccc-cccc-cccc-cccccccccccc', '31111111-1111-1111-1111-111111111111')
    returning comment_id
  $$,
  $$ values ('3ccccccc-cccc-cccc-cccc-cccccccccccc'::uuid) $$,
  'community creator can pin another authors comment'
);

select results_eq(
  $$
    delete from public.community_comment_pins
    where comment_id = '3ccccccc-cccc-cccc-cccc-cccccccccccc'
    returning comment_id
  $$,
  $$ values ('3ccccccc-cccc-cccc-cccc-cccccccccccc'::uuid) $$,
  'community creator can unpin a comment'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"35555555-5555-5555-5555-555555555555","role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

select results_eq(
  $$
    insert into public.community_comment_pins (comment_id, pinned_by)
    values ('3ccccccc-cccc-cccc-cccc-cccccccccccc', '35555555-5555-5555-5555-555555555555')
    returning comment_id
  $$,
  $$ values ('3ccccccc-cccc-cccc-cccc-cccccccccccc'::uuid) $$,
  'admin can pin a comment'
);

select results_eq(
  $$
    delete from public.community_comment_pins
    where comment_id = '3ccccccc-cccc-cccc-cccc-cccccccccccc'
    returning comment_id
  $$,
  $$ values ('3ccccccc-cccc-cccc-cccc-cccccccccccc'::uuid) $$,
  'admin can unpin a comment'
);

select * from finish();
rollback;
