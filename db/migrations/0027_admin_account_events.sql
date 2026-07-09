create table public.admin_account_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_profile_id uuid references public.profiles(id) on delete set null,
  target_email text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint admin_account_events_action_check check (
    action in (
      'staff_created',
      'staff_create_failed',
      'staff_updated',
      'staff_deactivated',
      'staff_reactivated',
      'staff_role_changed',
      'staff_password_changed'
    )
  )
);

create index admin_account_events_created_at_idx on public.admin_account_events(created_at desc);
create index admin_account_events_actor_id_idx on public.admin_account_events(actor_id);
create index admin_account_events_target_profile_id_idx on public.admin_account_events(target_profile_id);
create index admin_account_events_action_idx on public.admin_account_events(action);

alter table public.admin_account_events enable row level security;

create policy "admin account events admin read"
on public.admin_account_events
for select
to authenticated
using (public.is_admin());

create policy "admin account events admin insert"
on public.admin_account_events
for insert
to authenticated
with check (public.is_admin());
