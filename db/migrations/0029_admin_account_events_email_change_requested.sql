alter table public.admin_account_events
  drop constraint if exists admin_account_events_action_check;

alter table public.admin_account_events
  add constraint admin_account_events_action_check check (
    action in (
      'staff_created',
      'staff_create_failed',
      'staff_updated',
      'staff_deactivated',
      'staff_reactivated',
      'staff_role_changed',
      'staff_deleted',
      'staff_password_changed',
      'staff_email_change_requested'
    )
  );
