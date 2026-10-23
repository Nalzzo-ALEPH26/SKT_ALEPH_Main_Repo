alter table public.communities
  add column if not exists updated_at timestamptz not null default now();

grant update (name, updated_at) on table public.communities to authenticated;

create policy communities_update_creator
on public.communities
for update
to authenticated
using (
  (select private.is_active_user())
  and created_by = (select auth.uid())
)
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
);

create table public.community_pins (
  community_id uuid primary key references public.communities(id) on delete cascade,
  pinned_by uuid not null references public.profiles(user_id),
  pinned_at timestamptz not null default now()
);

create table public.community_post_pins (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  pinned_by uuid not null references public.profiles(user_id),
  pinned_at timestamptz not null default now()
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_comments_body_length check (char_length(btrim(body)) between 1 and 1000)
);

create index community_pins_pinned_at_idx
on public.community_pins(pinned_at desc);

create index community_post_pins_pinned_at_idx
on public.community_post_pins(pinned_at desc);

create index community_comments_post_created_idx
on public.community_comments(post_id, created_at asc);

create index community_comments_author_id_idx
on public.community_comments(author_id);

alter table public.community_pins enable row level security;
alter table public.community_post_pins enable row level security;
alter table public.community_comments enable row level security;

revoke all on table public.community_pins from anon, authenticated;
revoke all on table public.community_post_pins from anon, authenticated;
revoke all on table public.community_comments from anon, authenticated;

grant select, insert, delete on table public.community_pins to authenticated;
grant select, insert, delete on table public.community_post_pins to authenticated;
grant select, insert, delete on table public.community_comments to authenticated;

create policy community_pins_select_active
on public.community_pins
for select
to authenticated
using ((select private.is_active_user()));

create policy community_pins_insert_admin
on public.community_pins
for insert
to authenticated
with check (
  (select private.is_active_user())
  and (select private.is_admin())
  and pinned_by = (select auth.uid())
);

create policy community_pins_delete_admin
on public.community_pins
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin())
);

create policy community_post_pins_select_active
on public.community_post_pins
for select
to authenticated
using ((select private.is_active_user()));

create policy community_post_pins_insert_admin
on public.community_post_pins
for insert
to authenticated
with check (
  (select private.is_active_user())
  and (select private.is_admin())
  and pinned_by = (select auth.uid())
);

create policy community_post_pins_delete_admin
on public.community_post_pins
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin())
);

create policy community_comments_select_active
on public.community_comments
for select
to authenticated
using ((select private.is_active_user()));

create policy community_comments_insert_own
on public.community_comments
for insert
to authenticated
with check (
  (select private.is_active_user())
  and author_id = (select auth.uid())
  and exists (
    select 1
    from public.community_posts
    where community_posts.id = community_comments.post_id
  )
);

create policy community_comments_delete_own_or_admin
on public.community_comments
for delete
to authenticated
using (
  (select private.is_active_user())
  and (
    author_id = (select auth.uid())
    or (select private.is_admin())
  )
);
