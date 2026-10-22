begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

select has_column('public', 'channels', 'join_code', 'channels have join codes');
select has_table('public', 'feedback_posts', 'feedback board table exists');
select has_column('public', 'feedback_posts', 'author_id', 'feedback posts track authors');
select has_column('public', 'feedback_posts', 'body', 'feedback posts store body text');
select ok(
  coalesce((select relrowsecurity from pg_class where oid = 'public.feedback_posts'::regclass), false),
  'feedback posts have RLS enabled'
);
select is(
  (select join_code from public.channels where is_default = true and lower(btrim(name)) = 'general' limit 1),
  '100000'::text,
  'general uses the documented default join code'
);

select * from finish();
rollback;
