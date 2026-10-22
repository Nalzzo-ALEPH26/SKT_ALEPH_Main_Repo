alter table public.channels
  add column join_code text;

update public.channels
set join_code = '100000'
where is_default = true
  and lower(btrim(name)) = 'general';

with ranked as (
  select id, row_number() over (order by created_at, id) as rn
  from public.channels
  where join_code is null
)
update public.channels as channel
set join_code = lpad((100000 + ranked.rn)::text, 6, '0')
from ranked
where channel.id = ranked.id;

create or replace function private.assign_channel_join_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  if new.join_code is not null then
    return new;
  end if;

  if new.is_default = true and lower(btrim(new.name)) = 'general' then
    new.join_code := '100000';
    return new;
  end if;

  loop
    candidate := lpad((100001 + floor(random() * 899999))::integer::text, 6, '0');
    exit when not exists (
      select 1 from public.channels where join_code = candidate
    );
  end loop;

  new.join_code := candidate;
  return new;
end;
$$;

create trigger channels_assign_join_code
before insert on public.channels
for each row execute function private.assign_channel_join_code();

alter table public.channels
  alter column join_code set not null,
  add constraint channels_join_code_format check (join_code ~ '^[0-9]{6}$');

create unique index channels_join_code_uidx on public.channels(join_code);

create table public.feedback_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(user_id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint feedback_posts_body_length check (char_length(btrim(body)) between 1 and 4000)
);

create index feedback_posts_created_at_idx on public.feedback_posts(created_at desc);
create index feedback_posts_author_id_idx on public.feedback_posts(author_id);

alter table public.feedback_posts enable row level security;
revoke all on table public.feedback_posts from anon, authenticated;
grant select, insert, delete on table public.feedback_posts to authenticated;

create policy feedback_posts_select_active
on public.feedback_posts
for select
to authenticated
using ((select private.is_active_user()));

create policy feedback_posts_insert_own
on public.feedback_posts
for insert
to authenticated
with check (
  (select private.is_active_user())
  and author_id = (select auth.uid())
);

create policy feedback_posts_delete_own_or_admin
on public.feedback_posts
for delete
to authenticated
using (
  (select private.is_active_user())
  and (
    author_id = (select auth.uid())
    or (select private.is_admin())
  )
);
