create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id),
  constraint signup_requests_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint signup_requests_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint signup_requests_review_state check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or
    (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index signup_requests_pending_username_uidx
  on public.signup_requests (username)
  where status = 'pending';

create index signup_requests_pending_requested_idx
  on public.signup_requests (requested_at asc)
  where status = 'pending';

alter table public.signup_requests enable row level security;

revoke all on table public.signup_requests from anon, authenticated;
grant select, insert, update, delete on table public.signup_requests to service_role;

create or replace function public.approve_signup_request_server(
  target_request_id uuid,
  reviewer_user_id uuid,
  at_time timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.signup_requests%rowtype;
  general_channel_id uuid;
begin
  select *
  into target_request
  from public.signup_requests
  where id = target_request_id
  for update;

  if not found
    or target_request.status <> 'pending'
    or target_request.auth_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles
    where user_id = reviewer_user_id
      and status = 'active'
  ) then
    return false;
  end if;

  select id
  into general_channel_id
  from public.channels
  where is_default = true
    and lower(btrim(name)) = 'general'
  limit 1;

  if general_channel_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.profiles
    where user_id = target_request.auth_user_id
       or username = target_request.username
  ) then
    return false;
  end if;

  insert into public.profiles (user_id, username, display_name, status)
  values (
    target_request.auth_user_id,
    target_request.username,
    target_request.display_name,
    'active'
  );

  insert into public.user_settings (user_id, theme, updated_at)
  values (target_request.auth_user_id, 'light', at_time);

  insert into public.channel_members (channel_id, user_id, role)
  values (general_channel_id, target_request.auth_user_id, 'member');

  update public.signup_requests
  set status = 'approved',
      reviewed_at = at_time,
      reviewed_by = reviewer_user_id
  where id = target_request_id;

  return true;
end;
$$;

create or replace function public.reject_signup_request_server(
  target_request_id uuid,
  reviewer_user_id uuid,
  at_time timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where user_id = reviewer_user_id
      and status = 'active'
  ) then
    return null;
  end if;

  update public.signup_requests
  set status = 'rejected',
      reviewed_at = at_time,
      reviewed_by = reviewer_user_id
  where id = target_request_id
    and status = 'pending'
    and auth_user_id is not null
  returning auth_user_id into auth_id;

  if found then
    return auth_id;
  end if;

  select auth_user_id
  into auth_id
  from public.signup_requests
  where id = target_request_id
    and status = 'rejected'
  for update;

  return auth_id;
end;
$$;

revoke all on function public.approve_signup_request_server(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.reject_signup_request_server(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.approve_signup_request_server(uuid, uuid, timestamptz) to service_role;
grant execute on function public.reject_signup_request_server(uuid, uuid, timestamptz) to service_role;
