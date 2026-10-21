alter table public.invites
  add column claim_id uuid,
  add column claimed_at timestamptz,
  add constraint invites_claim_pair check (
    (claim_id is null and claimed_at is null)
    or (claim_id is not null and claimed_at is not null)
  );

create index invites_claimed_at_idx on public.invites (claimed_at)
where claim_id is not null and used_at is null and revoked_at is null;

create or replace function private.claim_invite(
  target_token_hash text,
  requested_claim_id uuid,
  at_time timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites
  set
    claim_id = requested_claim_id,
    claimed_at = at_time
  where token_hash = target_token_hash
    and revoked_at is null
    and used_at is null
    and expires_at > at_time
    and (
      claim_id is null
      or claim_id = requested_claim_id
      or claimed_at <= at_time - interval '5 minutes'
    );

  return found;
end;
$$;

create or replace function private.finalize_invite(
  target_token_hash text,
  requested_claim_id uuid,
  target_user_id uuid,
  at_time timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites
  set
    used_at = at_time,
    used_by = target_user_id,
    claim_id = null,
    claimed_at = null
  where token_hash = target_token_hash
    and claim_id = requested_claim_id
    and revoked_at is null
    and used_at is null
    and expires_at > at_time;

  return found;
end;
$$;

create or replace function private.release_invite_claim(
  target_token_hash text,
  requested_claim_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites
  set
    claim_id = null,
    claimed_at = null
  where token_hash = target_token_hash
    and claim_id = requested_claim_id
    and used_at is null;

  return found;
end;
$$;

revoke all on function private.claim_invite(text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.finalize_invite(text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.release_invite_claim(text, uuid) from public, anon, authenticated;

create or replace function public.claim_invite_server(
  target_token_hash text,
  requested_claim_id uuid,
  at_time timestamptz default now()
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.claim_invite(target_token_hash, requested_claim_id, at_time);
$$;

create or replace function public.finalize_invite_server(
  target_token_hash text,
  requested_claim_id uuid,
  target_user_id uuid,
  at_time timestamptz default now()
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.finalize_invite(target_token_hash, requested_claim_id, target_user_id, at_time);
$$;

create or replace function public.release_invite_claim_server(
  target_token_hash text,
  requested_claim_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.release_invite_claim(target_token_hash, requested_claim_id);
$$;

revoke all on function public.claim_invite_server(text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.finalize_invite_server(text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_invite_claim_server(text, uuid) from public, anon, authenticated;

grant execute on function public.claim_invite_server(text, uuid, timestamptz) to service_role;
grant execute on function public.finalize_invite_server(text, uuid, uuid, timestamptz) to service_role;
grant execute on function public.release_invite_claim_server(text, uuid) to service_role;

grant select, insert, update on public.invites to service_role;
