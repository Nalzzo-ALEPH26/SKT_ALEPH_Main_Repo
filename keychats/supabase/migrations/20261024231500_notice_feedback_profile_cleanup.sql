alter table public.communities
  add column if not exists is_notice boolean not null default false;

create unique index if not exists communities_single_notice_idx
on public.communities ((is_notice))
where is_notice;

update public.communities
set is_notice = true,
    updated_at = now()
where id = (
  select id
  from public.communities
  where btrim(name) = '공지사항'
  order by created_at asc
  limit 1
);

insert into public.communities (name, created_by)
select '피드백', coalesce(
  (select user_id from public.profiles where username = 'cxu1344' limit 1),
  (select author_id from public.feedback_posts order by created_at asc limit 1)
)
where not exists (
  select 1 from public.communities where btrim(name) = '피드백'
)
and coalesce(
  (select user_id from public.profiles where username = 'cxu1344' limit 1),
  (select author_id from public.feedback_posts order by created_at asc limit 1)
) is not null;

insert into public.community_posts (id, community_id, author_id, body, created_at)
select fp.id, feedback_board.id, fp.author_id, fp.body, fp.created_at
from public.feedback_posts fp
cross join lateral (
  select id
  from public.communities
  where btrim(name) = '피드백'
  order by created_at asc
  limit 1
) feedback_board
on conflict (id) do nothing;

alter table public.profiles
  add column if not exists deleted_at timestamptz;

update public.profiles p
set deleted_at = u.deleted_at,
    updated_at = greatest(p.updated_at, u.deleted_at)
from auth.users u
where u.id = p.user_id
  and u.deleted_at is not null
  and p.deleted_at is null;

drop policy if exists community_post_pins_insert_admin on public.community_post_pins;
drop policy if exists community_post_pins_delete_admin on public.community_post_pins;

drop policy if exists community_post_pins_insert_admin_or_creator on public.community_post_pins;
create policy community_post_pins_insert_admin_or_creator
on public.community_post_pins
for insert
to authenticated
with check (
  (select private.is_active_user())
  and pinned_by = (select auth.uid())
  and (
    (select private.is_admin())
    or exists (
      select 1
      from public.community_posts post_row
      join public.communities community_row on community_row.id = post_row.community_id
      where post_row.id = community_post_pins.post_id
        and community_row.created_by = (select auth.uid())
    )
  )
);

drop policy if exists community_post_pins_delete_admin_or_creator on public.community_post_pins;
create policy community_post_pins_delete_admin_or_creator
on public.community_post_pins
for delete
to authenticated
using (
  (select private.is_active_user())
  and (
    (select private.is_admin())
    or exists (
      select 1
      from public.community_posts post_row
      join public.communities community_row on community_row.id = post_row.community_id
      where post_row.id = community_post_pins.post_id
        and community_row.created_by = (select auth.uid())
    )
  )
);
