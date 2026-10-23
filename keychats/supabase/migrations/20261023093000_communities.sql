create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(user_id),
  created_at timestamptz not null default now(),
  constraint communities_name_length check (char_length(btrim(name)) between 1 and 40)
);

create unique index communities_name_ci_uidx
on public.communities ((lower(btrim(name))));

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(user_id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_posts_body_length check (char_length(btrim(body)) between 1 and 4000)
);

create index community_posts_community_created_idx
on public.community_posts(community_id, created_at desc);

create index community_posts_author_id_idx
on public.community_posts(author_id);

alter table public.communities enable row level security;
alter table public.community_posts enable row level security;

revoke all on table public.communities from anon, authenticated;
revoke all on table public.community_posts from anon, authenticated;

grant select, insert, delete on table public.communities to authenticated;
grant select, insert, delete on table public.community_posts to authenticated;

create policy communities_select_active
on public.communities
for select
to authenticated
using ((select private.is_active_user()));

create policy communities_insert_active
on public.communities
for insert
to authenticated
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
);

create policy communities_delete_admin
on public.communities
for delete
to authenticated
using (
  (select private.is_active_user())
  and (select private.is_admin())
);

create policy community_posts_select_active
on public.community_posts
for select
to authenticated
using ((select private.is_active_user()));

create policy community_posts_insert_own
on public.community_posts
for insert
to authenticated
with check (
  (select private.is_active_user())
  and author_id = (select auth.uid())
  and exists (
    select 1
    from public.communities
    where communities.id = community_posts.community_id
  )
);

create policy community_posts_delete_own_or_admin
on public.community_posts
for delete
to authenticated
using (
  (select private.is_active_user())
  and (
    author_id = (select auth.uid())
    or (select private.is_admin())
  )
);
