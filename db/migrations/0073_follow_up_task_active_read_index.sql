begin;

create index tasks_active_follow_up_read_idx
  on public.tasks (lead_id, due_at, id)
  where task_kind = 'follow_up'
    and status in ('pending', 'in_progress')
    and lead_id is not null;

-- Rollback through a later additive migration must drop only tasks_active_follow_up_read_idx.

commit;
