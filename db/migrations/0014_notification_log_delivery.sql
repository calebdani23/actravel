alter table public.notification_logs
  add column provider_message_id text,
  add column sent_at timestamptz,
  add column updated_at timestamptz not null default now();

create index notification_logs_created_at_idx on public.notification_logs(created_at desc);
create index notification_logs_lead_created_at_idx on public.notification_logs(lead_id, created_at desc);

create unique index notification_logs_email_idempotency_idx
  on public.notification_logs(lead_id, recipient, template_name)
  where channel = 'email' and lead_id is not null and recipient is not null and template_name is not null;

create or replace function public.set_notification_logs_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_notification_logs_updated_at
  before update on public.notification_logs
  for each row
  execute function public.set_notification_logs_updated_at();
