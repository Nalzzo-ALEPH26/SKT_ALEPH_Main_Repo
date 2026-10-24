begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'community-member@keychats.test'),
  ('22222222-2222-2222-2222-222222222222', 'community-member2@keychats.test'),
  ('55555555-5555-5555-5555-555555555555', 'community-admin@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('11111111-1111-1111-1111-111111111111', 'community_member', 'Community Member', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'community_member2', 'Community Member 2', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'cxu1344', 'Admin', 'active');

select has_table('public', 'communities', 'communities table exists');
select has_table('public', 'community_posts', 'community posts table exists');
select has_table('public', 'community_comments', 'community comments table exists');
select has_table('public', 'community_pins', 'community pins table exists');
select has_table('public', 'community_post_pins', 'community post pins table exists');
select has_table('public', 'community_comment_pins', 'community comment pins table exists');

select ok(coalesce((select relrowsecurity from pg_class where oid = 'public.community_comments'::regclass), false), 'community comments have RLS enabled');
select ok(coalesce((select relrowsecurity from pg_class where oid = 'public.community_pins'::regclass), false), 'community pins have RLS enabled');
select ok(coalesce((select relrowsecurity from pg_class where oid = 'public.community_post_pins'::regclass), false), 'community post pins have RLS enabled');
select ok(coalesce((select relrowsecurity from pg_class where oid = 'public.community_comment_pins'::regclass), false), 'community comment pins have RLS enabled');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","app_metadata":{"role":"member"}}', true);

select results_eq($$insert into public.communities (id, name, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '자유게시판', '11111111-1111-1111-1111-111111111111') returning name$$, $$values ('자유게시판'::text)$$, 'active member can create a community');
select results_eq($$update public.communities set name='수정된 게시판', updated_at=now() where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning name$$, $$values ('수정된 게시판'::text)$$, 'community creator can rename the community');
select results_eq($$insert into public.community_posts (id,community_id,author_id,body) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','첫 글') returning body$$, $$values ('첫 글'::text)$$, 'active member can write in a community');
select results_eq($$insert into public.community_posts (id,community_id,author_id,body) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','둘째 글') returning body$$, $$values ('둘째 글'::text)$$, 'creator can create another post');
select results_eq($$insert into public.community_comments (id,post_id,author_id,body) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','첫 댓글') returning body$$, $$values ('첫 댓글'::text)$$, 'active member can comment');

select throws_ok($$insert into public.community_pins (community_id,pinned_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111')$$, '42501', 'new row violates row-level security policy for table "community_pins"', 'regular member cannot pin a community');
select results_eq($$insert into public.community_post_pins (post_id,pinned_by) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111') returning post_id$$, $$values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$, 'community creator can pin a post in their board');
select results_eq($$insert into public.community_comment_pins (comment_id,pinned_by) values ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111') returning comment_id$$, $$values ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid)$$, 'community creator can pin a comment in their board');

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","app_metadata":{"role":"member"}}', true);

select results_eq($$update public.communities set name='가로챈 제목', updated_at=now() where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id$$, $$select null::uuid where false$$, 'non-creator cannot rename the community');
select results_eq($$insert into public.community_comments (id,post_id,author_id,body) values ('dddddddd-dddd-dddd-dddd-dddddddddddd','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','두 번째 댓글') returning body$$, $$values ('두 번째 댓글'::text)$$, 'another active member can comment');
select results_eq($$delete from public.community_comments where id='cccccccc-cccc-cccc-cccc-cccccccccccc' returning id$$, $$select null::uuid where false$$, 'member cannot delete another author comment');
select throws_ok($$insert into public.community_post_pins (post_id,pinned_by) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','22222222-2222-2222-2222-222222222222')$$, '42501', 'new row violates row-level security policy for table "community_post_pins"', 'non-creator cannot pin another board post');

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated","app_metadata":{"role":"admin"}}', true);

select results_eq($$insert into public.community_pins (community_id,pinned_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555') returning community_id$$, $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$, 'admin can pin a community');
select results_eq($$insert into public.community_post_pins (post_id,pinned_by) values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','55555555-5555-5555-5555-555555555555') returning post_id$$, $$values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid)$$, 'admin can pin a community post');
select results_eq($$delete from public.community_comments where id='dddddddd-dddd-dddd-dddd-dddddddddddd' returning id$$, $$values ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$, 'admin can delete another author comment');
select results_eq($$delete from public.communities where id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' returning id$$, $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$, 'admin can delete a community');

select * from finish();
rollback;
