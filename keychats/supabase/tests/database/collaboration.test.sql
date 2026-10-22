begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email)
values ('66666666-6666-6666-6666-666666666666', 'general-fixture@keychats.test');

insert into public.profiles (user_id, username, display_name, status)
values ('66666666-6666-6666-6666-666666666666', 'general_fixture', 'General Fixture', 'active');

insert into public.channels (id, name, created_by, is_default)
values (
  '77777777-7777-7777-7777-777777777777',
  'general',
  '66666666-6666-6666-6666-666666666666',
  true
);

select has_column('public', 'channels', 'join_code', 'channels have join codes');
select has_table('public', 'feedback_posts', 'feedback board table exists');
select has_column('public', 'feedback_posts', 'author_id', 'feedback posts track authors');
select has_column('public', 'feedback_posts', 'body', 'feedback posts store body text');
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.feedback_posts'::regclass), false),
  'feedback posts have RLS enabled'
);
select is(
  (select join_code from public.channels where id = '77777777-7777-7777-7777-777777777777'),
  '100000'::text,
  'general uses the documented default join code'
);

select * from finish();
rollback;
