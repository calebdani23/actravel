alter table public.notification_logs
  drop constraint if exists notification_logs_status_check,
  add constraint notification_logs_status_check
    check (status in ('queued', 'processing', 'sent', 'failed', 'skipped', 'ambiguous')),
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists last_retried_by uuid references auth.users(id) on delete set null;

create index if not exists notification_logs_retry_status_idx
  on public.notification_logs(status, locked_at)
  where status in ('queued', 'processing', 'failed', 'ambiguous');

alter table public.sheet_sync_logs
  drop constraint if exists sheet_sync_logs_status_check,
  add constraint sheet_sync_logs_status_check
    check (status in ('queued', 'processing', 'success', 'failed', 'skipped', 'ambiguous')),
  add column if not exists quote_request_id uuid references public.quote_requests(id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists last_retried_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists sheet_sync_logs_push_idempotency_key_idx
  on public.sheet_sync_logs(idempotency_key)
  where direction = 'push' and idempotency_key is not null;

create index if not exists sheet_sync_logs_retry_status_idx
  on public.sheet_sync_logs(status, locked_at)
  where status in ('queued', 'processing', 'failed', 'ambiguous');

create or replace function public.set_sheet_sync_logs_updated_at()
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

drop trigger if exists set_sheet_sync_logs_updated_at on public.sheet_sync_logs;
create trigger set_sheet_sync_logs_updated_at
  before update on public.sheet_sync_logs
  for each row
  execute function public.set_sheet_sync_logs_updated_at();
