create table public.community_comment_pins (
  comment_id uuid primary key references public.community_comments(id) on delete cascade,
  pinned_by uuid not null references public.profiles(user_id),
  pinned_at timestamptz not null default now()
);

create index community_comment_pins_pinned_at_idx
on public.community_comment_pins(pinned_at desc);

alter table public.community_comment_pins enable row level security;

revoke all on table public.community_comment_pins from anon, authenticated;
grant select, insert, delete on table public.community_comment_pins to authenticated;

create policy community_comment_pins_select_active
on public.community_comment_pins
for select
to authenticated
using ((select private.is_active_user()));

create policy community_comment_pins_insert_admin_or_creator
on public.community_comment_pins
for insert
to authenticated
with check (
  (select private.is_active_user())
  and pinned_by = (select auth.uid())
  and (
    (select private.is_admin())
    or exists (
      select 1
      from public.community_comments comment_row
      join public.community_posts post_row on post_row.id = comment_row.post_id
      join public.communities community_row on community_row.id = post_row.community_id
      where comment_row.id = community_comment_pins.comment_id
        and community_row.created_by = (select auth.uid())
    )
  )
);

create policy community_comment_pins_delete_admin_or_creator
on public.community_comment_pins
for delete
to authenticated
using (
  (select private.is_active_user())
  and (
    (select private.is_admin())
    or exists (
      select 1
      from public.community_comments comment_row
      join public.community_posts post_row on post_row.id = comment_row.post_id
      join public.communities community_row on community_row.id = post_row.community_id
      where comment_row.id = community_comment_pins.comment_id
        and community_row.created_by = (select auth.uid())
    )
  )
);
