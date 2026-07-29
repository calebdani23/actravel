-- Guarded admin-only lead deletion with blocker counts and persistent audit.

drop policy if exists "lead write scoped" on public.leads;

drop policy if exists "lead insert scoped" on public.leads;
create policy "lead insert scoped"
  on public.leads
  for insert
  to authenticated
  with check (
    public.is_admin()
    or (public.has_role('asesor') and (assigned_to = auth.uid() or assigned_to is null))
  );

drop policy if exists "lead update scoped" on public.leads;
create policy "lead update scoped"
  on public.leads
  for update
  to authenticated
  using (
    public.is_admin()
    or (public.has_role('asesor') and (assigned_to = auth.uid() or assigned_to is null))
  )
  with check (
    public.is_admin()
    or (public.has_role('asesor') and (assigned_to = auth.uid() or assigned_to is null))
  );

drop policy if exists "lead delete admin only" on public.leads;

create table if not exists public.admin_lead_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  deleted_lead_id uuid not null,
  deleted_contact_id uuid,
  actor_id uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz not null default now(),
  blocker_counts jsonb not null default '{}'::jsonb,
  blocked_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists admin_lead_deletion_audit_deleted_at_idx
  on public.admin_lead_deletion_audit(deleted_at desc);

alter table public.admin_lead_deletion_audit enable row level security;

drop policy if exists "admin lead deletion audit read admin" on public.admin_lead_deletion_audit;
create policy "admin lead deletion audit read admin"
  on public.admin_lead_deletion_audit
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.crm_delete_lead_guarded(
  p_lead_id uuid
)
returns table(
  lead_id uuid,
  contact_id uuid,
  deleted boolean,
  blocked boolean,
  blocker_counts jsonb,
  blocked_reasons jsonb,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  lead_row record;
  counts jsonb;
  reasons jsonb := '[]'::jsonb;
  note_count integer := 0;
  event_count integer := 0;
  quote_version_count integer := 0;
  quote_request_count integer := 0;
  payment_count integer := 0;
  booking_count integer := 0;
  document_count integer := 0;
  notification_count integer := 0;
  whatsapp_click_count integer := 0;
  whatsapp_inbound_count integer := 0;
  sheet_sync_count integer := 0;
  deleted_timestamp timestamptz;
begin
  if p_lead_id is null then
    raise exception 'Lead not found';
  end if;

  if actor_role <> 'service_role' then
    if actor_id is null or not public.is_admin() then
      raise insufficient_privilege using message = 'Not authorized to delete leads';
    end if;
  end if;

  select l.id, l.contact_id, l.assigned_to, l.source, l.summary, l.created_at
  into lead_row
  from public.leads l
  where l.id = p_lead_id
  for update;

  if lead_row.id is null then
    raise exception 'Lead not found';
  end if;

  perform 1 from public.quote_versions where lead_id = p_lead_id for update;
  perform 1 from public.quote_requests where lead_id = p_lead_id for update;
  perform 1 from public.payments where lead_id = p_lead_id for update;
  perform 1 from public.bookings where lead_id = p_lead_id for update;
  perform 1 from public.documents where lead_id = p_lead_id for update;
  perform 1 from public.lead_notes where lead_id = p_lead_id for update;
  perform 1 from public.lead_events where lead_id = p_lead_id for update;
  perform 1 from public.notification_logs where lead_id = p_lead_id for update;
  perform 1 from public.whatsapp_clicks where lead_id = p_lead_id for update;
  perform 1 from public.whatsapp_inbound_messages where lead_id = p_lead_id for update;
  perform 1 from public.sheet_sync_logs where lead_id = p_lead_id for update;

  select count(*)::integer into quote_version_count from public.quote_versions where lead_id = p_lead_id;
  select count(*)::integer into quote_request_count from public.quote_requests where lead_id = p_lead_id;
  select count(*)::integer into payment_count from public.payments where lead_id = p_lead_id;
  select count(*)::integer into booking_count from public.bookings where lead_id = p_lead_id;
  select count(*)::integer into document_count from public.documents where lead_id = p_lead_id;
  select count(*)::integer into note_count from public.lead_notes where lead_id = p_lead_id and nullif(trim(body), '') is not null;
  select count(*)::integer into event_count from public.lead_events where lead_id = p_lead_id and event_type <> 'manual_lead_created';
  select count(*)::integer into notification_count from public.notification_logs where lead_id = p_lead_id;
  select count(*)::integer into whatsapp_click_count from public.whatsapp_clicks where lead_id = p_lead_id;
  select count(*)::integer into whatsapp_inbound_count from public.whatsapp_inbound_messages where lead_id = p_lead_id;
  select count(*)::integer into sheet_sync_count from public.sheet_sync_logs where lead_id = p_lead_id;

  counts := jsonb_build_object(
    'quoteVersions', quote_version_count,
    'quoteRequests', quote_request_count,
    'payments', payment_count,
    'bookings', booking_count,
    'documents', document_count,
    'leadNotes', note_count,
    'notificationLogs', notification_count,
    'whatsappClicks', whatsapp_click_count,
    'whatsappInboundMessages', whatsapp_inbound_count,
    'sheetSyncLogs', sheet_sync_count,
    'leadEvents', event_count
  );

  if quote_version_count > 0 then reasons := reasons || jsonb_build_array('quote_versions'); end if;
  if quote_request_count > 0 then reasons := reasons || jsonb_build_array('quote_requests'); end if;
  if payment_count > 0 then reasons := reasons || jsonb_build_array('payments'); end if;
  if booking_count > 0 then reasons := reasons || jsonb_build_array('bookings'); end if;
  if document_count > 0 then reasons := reasons || jsonb_build_array('documents'); end if;
  if note_count > 0 then reasons := reasons || jsonb_build_array('lead_notes'); end if;
  if notification_count > 0 then reasons := reasons || jsonb_build_array('notification_logs'); end if;
  if whatsapp_click_count > 0 then reasons := reasons || jsonb_build_array('whatsapp_clicks'); end if;
  if whatsapp_inbound_count > 0 then reasons := reasons || jsonb_build_array('whatsapp_inbound_messages'); end if;
  if sheet_sync_count > 0 then reasons := reasons || jsonb_build_array('sheet_sync_logs'); end if;
  if event_count > 0 then reasons := reasons || jsonb_build_array('lead_events'); end if;

  if reasons <> '[]'::jsonb then
    return query
      select lead_row.id, lead_row.contact_id, false, true, counts, reasons, null::timestamptz;
    return;
  end if;

  deleted_timestamp := now();

  insert into public.admin_lead_deletion_audit (
    deleted_lead_id,
    deleted_contact_id,
    actor_id,
    deleted_at,
    blocker_counts,
    blocked_reasons,
    metadata
  )
  values (
    lead_row.id,
    lead_row.contact_id,
    actor_id,
    deleted_timestamp,
    counts,
    reasons,
    jsonb_build_object(
      'source', lead_row.source,
      'summary', lead_row.summary,
      'assignedTo', lead_row.assigned_to,
      'createdAt', lead_row.created_at,
      'actorRole', actor_role
    )
  );

  delete from public.leads where id = lead_row.id;

  return query
    select lead_row.id, lead_row.contact_id, true, false, counts, reasons, deleted_timestamp;
end;
$$;

revoke all on function public.crm_delete_lead_guarded(uuid) from public;
revoke all on function public.crm_delete_lead_guarded(uuid) from anon;
grant execute on function public.crm_delete_lead_guarded(uuid) to authenticated;
grant execute on function public.crm_delete_lead_guarded(uuid) to service_role;
