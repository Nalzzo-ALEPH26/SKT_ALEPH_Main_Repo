create table public.dm_hidden_threads (
  dm_thread_id uuid not null references public.dm_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (dm_thread_id, user_id)
);

create index dm_hidden_threads_user_id_idx
  on public.dm_hidden_threads(user_id);

alter table public.dm_hidden_threads enable row level security;

revoke all on table public.dm_hidden_threads from anon, authenticated;
grant select, insert, delete on table public.dm_hidden_threads to authenticated;

drop policy if exists dm_hidden_threads_select_self on public.dm_hidden_threads;
create policy dm_hidden_threads_select_self
on public.dm_hidden_threads
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_dm(dm_thread_id))
);

drop policy if exists dm_hidden_threads_insert_self on public.dm_hidden_threads;
create policy dm_hidden_threads_insert_self
on public.dm_hidden_threads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.can_access_dm(dm_thread_id))
);

drop policy if exists dm_hidden_threads_delete_self on public.dm_hidden_threads;
create policy dm_hidden_threads_delete_self
on public.dm_hidden_threads
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.can_access_dm(dm_thread_id))
);
