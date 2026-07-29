-- Allow guarded admin lead deletion to optionally remove the canonical contact only when it becomes a safe orphan.

drop policy if exists "crm contact write" on public.contacts;

drop policy if exists "crm contact insert" on public.contacts;
create policy "crm contact insert"
  on public.contacts
  for insert
  to authenticated
  with check (public.is_admin() or public.has_role('asesor'));

drop policy if exists "crm contact update" on public.contacts;
create policy "crm contact update"
  on public.contacts
  for update
  to authenticated
  using (public.is_admin() or public.has_role('asesor'))
  with check (public.is_admin() or public.has_role('asesor'));

alter table public.admin_lead_deletion_audit
  add column if not exists contact_deleted boolean not null default false;

alter table public.admin_lead_deletion_audit
  add column if not exists contact_blocker_counts jsonb not null default '{}'::jsonb;

alter table public.admin_lead_deletion_audit
  add column if not exists contact_blocked_reasons jsonb not null default '[]'::jsonb;

create unique index if not exists admin_lead_deletion_audit_deleted_lead_id_uidx
  on public.admin_lead_deletion_audit(deleted_lead_id);

drop function if exists public.crm_delete_lead_guarded(uuid, boolean);
drop function if exists public.crm_delete_lead_guarded(uuid);

create or replace function public.crm_delete_lead_guarded(
  p_lead_id uuid,
  p_delete_orphan_contact boolean default false
)
returns table(
  lead_id uuid,
  contact_id uuid,
  deleted boolean,
  blocked boolean,
  blocker_counts jsonb,
  blocked_reasons jsonb,
  deleted_at timestamptz,
  contact_deleted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  lead_row record;
  contact_row record;
  lead_counts jsonb;
  contact_counts jsonb;
  counts jsonb;
  lead_reasons jsonb := '[]'::jsonb;
  contact_reasons jsonb := '[]'::jsonb;
  reasons jsonb;
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
  other_lead_count integer := 0;
  contact_quote_version_count integer := 0;
  contact_quote_request_count integer := 0;
  contact_booking_count integer := 0;
  contact_payment_count integer := 0;
  contact_document_count integer := 0;
  contact_notification_count integer := 0;
  contact_whatsapp_click_count integer := 0;
  contact_whatsapp_inbound_count integer := 0;
  deleted_timestamp timestamptz;
  did_delete_contact boolean := false;
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

  select c.id, c.first_name, c.last_name, c.email, c.phone, c.preferred_locale, c.source, c.created_at, c.updated_at
  into contact_row
  from public.contacts c
  where c.id = lead_row.contact_id
  for update;

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

  if lead_row.contact_id is not null then
    perform 1 from public.leads where contact_id = lead_row.contact_id and id <> p_lead_id for update;
    perform 1 from public.quote_versions where contact_id = lead_row.contact_id for update;
    perform 1 from public.quote_requests where contact_id = lead_row.contact_id for update;
    perform 1 from public.bookings where contact_id = lead_row.contact_id for update;
    perform 1 from public.payments where contact_id = lead_row.contact_id for update;
    perform 1 from public.documents where contact_id = lead_row.contact_id for update;
    perform 1 from public.notification_logs where contact_id = lead_row.contact_id for update;
    perform 1 from public.whatsapp_clicks where contact_id = lead_row.contact_id for update;
    perform 1 from public.whatsapp_inbound_messages where contact_id = lead_row.contact_id for update;
  end if;

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

  lead_counts := jsonb_build_object(
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

  if quote_version_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('quote_versions'); end if;
  if quote_request_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('quote_requests'); end if;
  if payment_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('payments'); end if;
  if booking_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('bookings'); end if;
  if document_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('documents'); end if;
  if note_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('lead_notes'); end if;
  if notification_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('notification_logs'); end if;
  if whatsapp_click_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('whatsapp_clicks'); end if;
  if whatsapp_inbound_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('whatsapp_inbound_messages'); end if;
  if sheet_sync_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('sheet_sync_logs'); end if;
  if event_count > 0 then lead_reasons := lead_reasons || jsonb_build_array('lead_events'); end if;

  if lead_row.contact_id is not null then
    select count(*)::integer into other_lead_count from public.leads where contact_id = lead_row.contact_id and id <> p_lead_id;
    select count(*)::integer into contact_quote_version_count from public.quote_versions where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_quote_request_count from public.quote_requests where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_booking_count from public.bookings where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_payment_count from public.payments where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_document_count from public.documents where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_notification_count from public.notification_logs where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_whatsapp_click_count from public.whatsapp_clicks where contact_id = lead_row.contact_id;
    select count(*)::integer into contact_whatsapp_inbound_count from public.whatsapp_inbound_messages where contact_id = lead_row.contact_id;
  end if;

  contact_counts := jsonb_build_object(
    'otherLeads', other_lead_count,
    'quoteVersions', contact_quote_version_count,
    'quoteRequests', contact_quote_request_count,
    'bookings', contact_booking_count,
    'payments', contact_payment_count,
    'documents', contact_document_count,
    'notificationLogs', contact_notification_count,
    'whatsappClicks', contact_whatsapp_click_count,
    'whatsappInboundMessages', contact_whatsapp_inbound_count
  );

  if other_lead_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('other_leads'); end if;
  if contact_quote_version_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('quote_versions'); end if;
  if contact_quote_request_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('quote_requests'); end if;
  if contact_booking_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('bookings'); end if;
  if contact_payment_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('payments'); end if;
  if contact_document_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('documents'); end if;
  if contact_notification_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('notification_logs'); end if;
  if contact_whatsapp_click_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('whatsapp_clicks'); end if;
  if contact_whatsapp_inbound_count > 0 then contact_reasons := contact_reasons || jsonb_build_array('whatsapp_inbound_messages'); end if;

  counts := jsonb_build_object('lead', lead_counts, 'contact', contact_counts);
  reasons := jsonb_build_object('lead', lead_reasons, 'contact', contact_reasons);

  if lead_reasons <> '[]'::jsonb then
    return query
      select lead_row.id, lead_row.contact_id, false, true, counts, reasons, null::timestamptz, false;
    return;
  end if;

  if p_delete_orphan_contact and contact_reasons <> '[]'::jsonb then
    return query
      select lead_row.id, lead_row.contact_id, false, true, counts, reasons, null::timestamptz, false;
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
    contact_blocker_counts,
    contact_blocked_reasons,
    contact_deleted,
    metadata
  )
  values (
    lead_row.id,
    lead_row.contact_id,
    actor_id,
    deleted_timestamp,
    lead_counts,
    lead_reasons,
    contact_counts,
    contact_reasons,
    false,
    jsonb_build_object(
      'deleteOrphanContactRequested', p_delete_orphan_contact,
      'leadSnapshot', jsonb_build_object(
        'source', lead_row.source,
        'summary', lead_row.summary,
        'assignedTo', lead_row.assigned_to,
        'createdAt', lead_row.created_at
      ),
      'contactSnapshot', jsonb_build_object(
        'firstName', contact_row.first_name,
        'lastName', contact_row.last_name,
        'email', contact_row.email,
        'phone', contact_row.phone,
        'preferredLocale', contact_row.preferred_locale,
        'source', contact_row.source,
        'createdAt', contact_row.created_at,
        'updatedAt', contact_row.updated_at
      ),
      'actorRole', actor_role
    )
  )
  on conflict (deleted_lead_id) do update
    set deleted_contact_id = excluded.deleted_contact_id,
        actor_id = excluded.actor_id,
        deleted_at = excluded.deleted_at,
        blocker_counts = excluded.blocker_counts,
        blocked_reasons = excluded.blocked_reasons,
        contact_blocker_counts = excluded.contact_blocker_counts,
        contact_blocked_reasons = excluded.contact_blocked_reasons,
        contact_deleted = excluded.contact_deleted,
        metadata = excluded.metadata;

  delete from public.leads where id = lead_row.id;

  if p_delete_orphan_contact and contact_reasons = '[]'::jsonb and lead_row.contact_id is not null then
    delete from public.contacts where id = lead_row.contact_id;
    did_delete_contact := true;
  end if;

  update public.admin_lead_deletion_audit
  set contact_deleted = did_delete_contact,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('contactDeleted', did_delete_contact)
  where deleted_lead_id = lead_row.id;

  return query
    select lead_row.id, lead_row.contact_id, true, false, counts, reasons, deleted_timestamp, did_delete_contact;
end;
$$;

revoke all on function public.crm_delete_lead_guarded(uuid, boolean) from public;
revoke all on function public.crm_delete_lead_guarded(uuid, boolean) from anon;
grant execute on function public.crm_delete_lead_guarded(uuid, boolean) to authenticated;
grant execute on function public.crm_delete_lead_guarded(uuid, boolean) to service_role;
