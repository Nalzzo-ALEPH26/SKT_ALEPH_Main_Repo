create index invites_used_by_idx
  on public.invites(used_by)
  where used_by is not null;

create index read_states_last_read_message_id_idx
  on public.read_states(last_read_message_id)
  where last_read_message_id is not null;
