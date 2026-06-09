update public.notification_logs
set incident_updated_at = coalesce(last_attempt_at, created_at)
where incident_status = 'open'
  and incident_updated_by is null
  and last_attempt_at is null
  and incident_updated_at = updated_at
  and updated_at > created_at;

update public.sheet_sync_logs
set incident_updated_at = coalesce(last_attempt_at, created_at)
where incident_status = 'open'
  and incident_updated_by is null
  and last_attempt_at is null
  and incident_updated_at = updated_at
  and updated_at > created_at;
