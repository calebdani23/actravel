alter table public.notification_logs
  add column if not exists incident_status text,
  add column if not exists incident_updated_at timestamptz,
  add column if not exists incident_updated_by uuid references auth.users(id) on delete set null;

update public.notification_logs
set
  incident_status = case when status in ('sent', 'skipped') then 'resolved' else 'open' end,
  incident_updated_at = case
    when status in ('sent', 'skipped') then coalesce(last_attempt_at, updated_at, created_at)
    else coalesce(last_attempt_at, created_at)
  end;

alter table public.notification_logs
  alter column incident_status set default 'open',
  alter column incident_status set not null,
  alter column incident_updated_at set default now(),
  alter column incident_updated_at set not null,
  drop constraint if exists notification_logs_incident_status_check,
  add constraint notification_logs_incident_status_check
    check (incident_status in ('open', 'resolved'));

create index if not exists notification_logs_incident_idx
  on public.notification_logs(incident_status, status, created_at desc);

alter table public.sheet_sync_logs
  add column if not exists incident_status text,
  add column if not exists incident_updated_at timestamptz,
  add column if not exists incident_updated_by uuid references auth.users(id) on delete set null;

update public.sheet_sync_logs
set
  incident_status = case when status in ('success', 'skipped') then 'resolved' else 'open' end,
  incident_updated_at = case
    when status in ('success', 'skipped') then coalesce(last_attempt_at, updated_at, created_at)
    else coalesce(last_attempt_at, created_at)
  end;

alter table public.sheet_sync_logs
  alter column incident_status set default 'open',
  alter column incident_status set not null,
  alter column incident_updated_at set default now(),
  alter column incident_updated_at set not null,
  drop constraint if exists sheet_sync_logs_incident_status_check,
  add constraint sheet_sync_logs_incident_status_check
    check (incident_status in ('open', 'resolved'));

create index if not exists sheet_sync_logs_incident_idx
  on public.sheet_sync_logs(incident_status, status, created_at desc);

drop policy if exists "sheet sync logs staff read" on public.sheet_sync_logs;
create policy "sheet sync logs staff read" on public.sheet_sync_logs for select to authenticated using (public.is_admin() or public.has_role('marketing') or public.has_role('asesor'));
