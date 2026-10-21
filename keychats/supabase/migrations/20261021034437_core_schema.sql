create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  avatar_path text,
  status text not null default 'active' check (status in ('active', 'disabled', 'expelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references public.profiles(user_id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(user_id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_lifecycle check (not (used_at is not null and revoked_at is not null))
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint channels_name_length check (char_length(btrim(name)) between 1 and 80)
);

create table public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references public.profiles(user_id),
  user_high uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  constraint dm_threads_distinct_users check (user_low <> user_high),
  constraint dm_threads_ordered_users check (user_low < user_high),
  constraint dm_threads_unique_pair unique (user_low, user_high)
);

create table public.messages (
  id bigint generated always as identity primary key,
  channel_id uuid references public.channels(id) on delete cascade,
  dm_thread_id uuid references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id),
  body text,
  reply_to_id bigint references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_exactly_one_target check (
    ((channel_id is not null)::integer + (dm_thread_id is not null)::integer) = 1
  ),
  constraint messages_body_length check (body is null or char_length(body) <= 20000)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(user_id),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.message_pins (
  message_id bigint primary key references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(user_id),
  pinned_at timestamptz not null default now()
);

create table public.read_states (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  dm_thread_id uuid references public.dm_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  last_read_message_id bigint references public.messages(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint read_states_exactly_one_target check (
    ((channel_id is not null)::integer + (dm_thread_id is not null)::integer) = 1
  )
);

create table public.user_settings (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

create table public.url_previews (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.messages(id) on delete cascade,
  url text not null,
  url_hash text not null,
  title text,
  description text,
  image_url text,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'blocked')),
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  constraint url_previews_message_hash_unique unique (message_id, url_hash)
);

create index profiles_status_idx on public.profiles(status);
create index invites_expires_at_idx on public.invites(expires_at);
create index invites_created_by_idx on public.invites(created_by);
create index channels_created_by_idx on public.channels(created_by);
create index channel_members_user_id_idx on public.channel_members(user_id);
create index dm_threads_user_low_idx on public.dm_threads(user_low);
create index dm_threads_user_high_idx on public.dm_threads(user_high);
create index messages_channel_created_idx on public.messages(channel_id, created_at desc, id desc) where channel_id is not null;
create index messages_dm_created_idx on public.messages(dm_thread_id, created_at desc, id desc) where dm_thread_id is not null;
create index messages_sender_id_idx on public.messages(sender_id);
create index messages_reply_to_id_idx on public.messages(reply_to_id) where reply_to_id is not null;
create index attachments_message_id_idx on public.attachments(message_id);
create index attachments_uploader_id_idx on public.attachments(uploader_id);
create index message_reactions_user_id_idx on public.message_reactions(user_id);
create index message_pins_pinned_by_idx on public.message_pins(pinned_by);
create index read_states_user_id_idx on public.read_states(user_id);
create unique index read_states_channel_user_uidx
  on public.read_states(channel_id, user_id)
  where channel_id is not null;
create unique index read_states_dm_user_uidx
  on public.read_states(dm_thread_id, user_id)
  where dm_thread_id is not null;
create index url_previews_message_id_idx on public.url_previews(message_id);

alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.dm_threads enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_pins enable row level security;
alter table public.read_states enable row level security;
alter table public.user_settings enable row level security;
alter table public.url_previews enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.invites from anon, authenticated;
revoke all on table public.channels from anon, authenticated;
revoke all on table public.channel_members from anon, authenticated;
revoke all on table public.dm_threads from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.attachments from anon, authenticated;
revoke all on table public.message_reactions from anon, authenticated;
revoke all on table public.message_pins from anon, authenticated;
revoke all on table public.read_states from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
revoke all on table public.url_previews from anon, authenticated;

revoke all on sequence public.messages_id_seq from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_path, updated_at) on table public.profiles to authenticated;

grant select, insert, delete on table public.channels to authenticated;
grant update (name, updated_at) on table public.channels to authenticated;
grant select, insert, delete on table public.channel_members to authenticated;
grant select, insert on table public.dm_threads to authenticated;

grant select, insert on table public.messages to authenticated;
grant update (body, edited_at, deleted_at) on table public.messages to authenticated;
grant usage, select on sequence public.messages_id_seq to authenticated;

grant select, insert on table public.attachments to authenticated;
grant select, insert, delete on table public.message_reactions to authenticated;
grant select, insert, delete on table public.message_pins to authenticated;
grant select, insert on table public.read_states to authenticated;
grant update (last_read_message_id, updated_at) on table public.read_states to authenticated;
grant select, insert on table public.user_settings to authenticated;
grant update (theme, updated_at) on table public.user_settings to authenticated;
grant select on table public.url_previews to authenticated;
