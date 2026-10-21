begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'invite-admin@keychats.test'),
  ('77777777-7777-7777-7777-777777777777', 'invite-user@keychats.test');

insert into public.profiles (user_id, username, display_name, status) values
  ('66666666-6666-6666-6666-666666666666', 'invite_admin', 'Invite Admin', 'active'),
  ('77777777-7777-7777-7777-777777777777', 'invite_user', 'Invite User', 'active');

insert into public.invites (
  id, token_hash, created_by, created_at, expires_at
) values (
  '88888888-8888-8888-8888-888888888888',
  repeat('a', 64),
  '66666666-6666-6666-6666-666666666666',
  '2026-10-21T05:30:00Z',
  '2026-10-21T06:30:00Z'
);

select has_column('public', 'invites', 'claim_id', 'invites tracks the active claim id');
select has_column('public', 'invites', 'claimed_at', 'invites tracks when the claim started');

select ok(
  private.claim_invite(
    repeat('a', 64),
    'aaaaaaaa-1111-1111-1111-111111111111',
    '2026-10-21T05:35:00Z'
  ),
  'first claim succeeds'
);

select ok(
  not private.claim_invite(
    repeat('a', 64),
    'bbbbbbbb-2222-2222-2222-222222222222',
    '2026-10-21T05:39:59Z'
  ),
  'another claim cannot steal a live claim'
);

select ok(
  private.claim_invite(
    repeat('a', 64),
    'bbbbbbbb-2222-2222-2222-222222222222',
    '2026-10-21T05:40:00Z'
  ),
  'a claim can be recovered after the five-minute stale timeout'
);

select ok(
  not private.finalize_invite(
    repeat('a', 64),
    'aaaaaaaa-1111-1111-1111-111111111111',
    '77777777-7777-7777-7777-777777777777',
    '2026-10-21T05:41:00Z'
  ),
  'an obsolete claimant cannot finalize the invite'
);

select ok(
  private.finalize_invite(
    repeat('a', 64),
    'bbbbbbbb-2222-2222-2222-222222222222',
    '77777777-7777-7777-7777-777777777777',
    '2026-10-21T05:41:00Z'
  ),
  'the current claimant can finalize exactly once'
);

select ok(
  not private.claim_invite(
    repeat('a', 64),
    'cccccccc-3333-3333-3333-333333333333',
    '2026-10-21T05:42:00Z'
  ),
  'a finalized invite cannot be claimed again'
);

select results_eq(
  $$
    select used_by, used_at
    from public.invites
    where id = '88888888-8888-8888-8888-888888888888'
  $$,
  $$
    values (
      '77777777-7777-7777-7777-777777777777'::uuid,
      '2026-10-21T05:41:00Z'::timestamptz
    )
  $$,
  'finalization records the user and use timestamp'
);

select * from finish();
rollback;
