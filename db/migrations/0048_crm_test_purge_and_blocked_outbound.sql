-- Permanent purge is restricted to explicitly marked test data. Normal CRM
-- deletion remains the audited soft-delete path.
alter table public.contacts add column if not exists is_test_data boolean not null default false;
alter table public.leads add column if not exists is_test_data boolean not null default false;
create index if not exists contacts_test_data_idx on public.contacts(is_test_data) where is_test_data;
create index if not exists leads_test_data_idx on public.leads(is_test_data) where is_test_data;

create or replace function public.crm_require_test_data_purge()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.is_test_data is not true then
    raise exception 'Permanent purge is restricted to explicitly marked test data';
  end if;
  if tg_table_name = 'leads' and (
    exists (select 1 from public.quote_versions where lead_id = old.id) or
    exists (select 1 from public.quote_requests where lead_id = old.id) or
    exists (select 1 from public.payments where lead_id = old.id) or
    exists (select 1 from public.bookings where lead_id = old.id) or
    exists (select 1 from public.documents where lead_id = old.id) or
    exists (select 1 from public.lead_notes where lead_id = old.id and nullif(trim(body), '') is not null) or
    exists (select 1 from public.lead_events where lead_id = old.id and event_type <> 'manual_lead_created') or
    exists (select 1 from public.notification_logs where lead_id = old.id) or
    exists (select 1 from public.whatsapp_clicks where lead_id = old.id) or
    exists (select 1 from public.whatsapp_inbound_messages where lead_id = old.id) or
    exists (select 1 from public.sheet_sync_logs where lead_id = old.id)
  ) then
    raise exception 'Permanent purge requires a dependency-free test opportunity';
  end if;
  if tg_table_name = 'contacts' and (
    exists (select 1 from public.leads where contact_id = old.id) or
    exists (select 1 from public.quote_versions where contact_id = old.id) or
    exists (select 1 from public.quote_requests where contact_id = old.id) or
    exists (select 1 from public.payments where contact_id = old.id) or
    exists (select 1 from public.bookings where contact_id = old.id) or
    exists (select 1 from public.documents where contact_id = old.id) or
    exists (select 1 from public.notification_logs where contact_id = old.id) or
    exists (select 1 from public.whatsapp_clicks where contact_id = old.id) or
    exists (select 1 from public.whatsapp_inbound_messages where contact_id = old.id)
  ) then
    raise exception 'Permanent purge requires a dependency-free test contact';
  end if;
  return old;
end;
$$;
drop trigger if exists require_test_data_lead_purge on public.leads;
create trigger require_test_data_lead_purge before delete on public.leads
for each row execute function public.crm_require_test_data_purge();
drop trigger if exists require_test_data_contact_purge on public.contacts;
create trigger require_test_data_contact_purge before delete on public.contacts
for each row execute function public.crm_require_test_data_purge();

-- Keep the historical dependency preflight, but put the test marker at the
-- public RPC boundary as well. The old implementation is retained under an
-- unreachable internal name only so this migration does not duplicate it.
revoke all on function public.crm_delete_lead_guarded(uuid, boolean) from public, anon, authenticated, service_role;
alter function public.crm_delete_lead_guarded(uuid, boolean) rename to crm_delete_lead_guarded_unchecked;
create or replace function public.crm_delete_lead_guarded(
  p_lead_id uuid,
  p_delete_orphan_contact boolean,
  p_confirmation text
)
returns table(lead_id uuid, contact_id uuid, deleted boolean, blocked boolean,
  blocker_counts jsonb, blocked_reasons jsonb, deleted_at timestamptz,
  contact_deleted boolean)
language plpgsql security definer set search_path=public as $$
declare lead_test boolean; contact_test boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise insufficient_privilege using message='CRM purge requires an administrator';
  end if;
  if p_confirmation is distinct from 'PURGAR DATOS DE PRUEBA' then
    raise exception 'Typed confirmation required';
  end if;
  select l.is_test_data, c.is_test_data into lead_test, contact_test
  from public.leads l left join public.contacts c on c.id = l.contact_id
  where l.id = p_lead_id for update of l;
  if lead_test is null then raise exception 'Lead not found'; end if;
  if lead_test is not true then raise exception 'Permanent purge is restricted to explicitly marked test data'; end if;
  if p_delete_orphan_contact and contact_test is not true then
    raise exception 'Permanent purge of an orphan contact requires an explicitly marked test contact';
  end if;
  return query select * from public.crm_delete_lead_guarded_unchecked(p_lead_id, p_delete_orphan_contact);
end;
$$;
revoke all on function public.crm_delete_lead_guarded(uuid, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.crm_delete_lead_guarded_unchecked(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.crm_delete_lead_guarded(uuid, boolean, text) to authenticated;

-- Bulk mutations are bounded and normalize ids inside the database too. This
-- prevents a service/server caller from inflating requested_count or auditing
-- duplicate work (the client-side Set is only a UX optimization).
create or replace function public.crm_bulk_mutate(
  p_operation text, p_entity_ids uuid[], p_status_value text default null,
  p_confirmation text default null
) returns table(job_id uuid, requested_count integer, success_count integer, failure_count integer)
language plpgsql security definer set search_path=public as $$
declare actor uuid := auth.uid(); item uuid; job uuid; ok integer := 0; failed integer := 0;
  before_row jsonb; after_row jsonb; entity_type text; error_code text; normalized_ids uuid[];
begin
  if actor is null or not public.is_admin() then raise insufficient_privilege using message='CRM bulk mutations require an administrator'; end if;
  select coalesce(array_agg(entity_id order by first_position), '{}'::uuid[]) into normalized_ids
  from (select entity_id, min(position) first_position from unnest(coalesce(p_entity_ids, '{}'::uuid[])) with ordinality as input(entity_id, position) group by entity_id) unique_ids;
  if coalesce(array_length(normalized_ids, 1), 0) > 500 then raise exception 'La selección supera el máximo de 500 registros por operación'; end if;
  if p_operation in ('contact_soft_delete','contact_restore') and p_confirmation is distinct from (case when p_operation='contact_soft_delete' then 'DELETE CONTACTS' else 'RESTORE CONTACTS' end) then raise exception 'Typed confirmation required'; end if;
  if p_operation in ('opportunity_soft_delete','opportunity_restore') and p_confirmation is distinct from (case when p_operation='opportunity_soft_delete' then 'DELETE OPPORTUNITIES' else 'RESTORE OPPORTUNITIES' end) then raise exception 'Typed confirmation required'; end if;
  if p_operation like 'contact_%' then entity_type := 'contact'; elsif p_operation like 'opportunity_%' then entity_type := 'opportunity'; else raise exception 'Unsupported CRM bulk operation'; end if;
  insert into public.crm_bulk_mutation_jobs(actor_id, operation, requested_count) values (actor, p_operation, coalesce(array_length(normalized_ids,1),0)) returning id into job;
  foreach item in array normalized_ids loop
    before_row := null; after_row := null; error_code := null;
    begin
      if entity_type = 'contact' then
        select to_jsonb(c) into before_row from public.contacts c where c.id=item for update;
        if before_row is null then error_code := 'not_found';
        elsif p_operation='contact_block' then update public.contacts set lifecycle_status='blocked', blocked_at=coalesce(blocked_at,now()), blocked_by=actor, blocked_reason=coalesce(blocked_reason,'Bulk blocked') where id=item and deleted_at is null returning to_jsonb(contacts) into after_row;
        elsif p_operation='contact_unblock' then update public.contacts set lifecycle_status='active', blocked_at=null, blocked_by=null, blocked_reason=null where id=item and lifecycle_status='blocked' and deleted_at is null returning to_jsonb(contacts) into after_row;
        elsif p_operation='contact_lifecycle' and p_status_value in ('active','follow_up','customer','inactive','blocked') then update public.contacts set lifecycle_status=p_status_value where id=item and lifecycle_status <> 'deleted' and deleted_at is null returning to_jsonb(contacts) into after_row;
        elsif p_operation='contact_soft_delete' then update public.contacts set lifecycle_status='deleted', deleted_at=coalesce(deleted_at,now()), deleted_by=actor, deleted_reason='Bulk soft delete' where id=item and deleted_at is null returning to_jsonb(contacts) into after_row;
        elsif p_operation='contact_restore' then update public.contacts set lifecycle_status='active', deleted_at=null, deleted_by=null, deleted_reason=null where id=item and deleted_at is not null returning to_jsonb(contacts) into after_row;
        else error_code := 'invalid_operation'; end if;
      else
        select to_jsonb(l) into before_row from public.leads l where l.id=item for update;
        if before_row is null then error_code := 'not_found';
        elsif p_operation='opportunity_feature' then update public.leads set is_featured=true where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_unfeature' then update public.leads set is_featured=false where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_archive' then update public.leads set archived_at=coalesce(archived_at,now()), archived_by=actor where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_unarchive' then update public.leads set archived_at=null, archived_by=null where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_status' and p_status_value is not null and exists(select 1 from public.lead_statuses where id=p_status_value::uuid) then update public.leads set status_id=p_status_value::uuid where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_soft_delete' then update public.leads set deleted_at=coalesce(deleted_at,now()), deleted_by=actor, deleted_reason='Bulk soft delete' where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation='opportunity_restore' then update public.leads set deleted_at=null, deleted_by=null, deleted_reason=null where id=item and deleted_at is not null returning to_jsonb(leads) into after_row;
        else error_code := 'invalid_operation'; end if;
      end if;
      if before_row is not null and after_row is not null then ok:=ok+1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,before_state,after_state) values(job,entity_type,item,'succeeded',before_row,after_row); else failed:=failed+1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,error_code,error_message,before_state) values(job,entity_type,item,'failed',coalesce(error_code,'not_applicable'),'Entity was not eligible for this operation',before_row); end if;
    exception when others then failed:=failed+1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,error_code,error_message,before_state) values(job,entity_type,item,'failed',sqlstate,'Mutation was not applied',before_row);
    end;
  end loop;
  update public.crm_bulk_mutation_jobs set success_count=ok, failure_count=failed, completed_at=now() where id=job;
  return query select job, coalesce(array_length(normalized_ids,1),0), ok, failed;
end; $$;
do $$ declare f text; begin foreach f in array array['crm_bulk_mutate(text,uuid[],text,text)','crm_bulk_block_contacts(uuid[])','crm_bulk_unblock_contacts(uuid[])','crm_bulk_update_contact_lifecycle(uuid[],text)','crm_bulk_delete_restore_contacts(uuid[],boolean,text)','crm_bulk_feature_opportunities(uuid[],boolean)','crm_bulk_update_opportunity_status(uuid[],uuid)','crm_bulk_delete_restore_opportunities(uuid[],boolean,text)','crm_bulk_archive_opportunities(uuid[],boolean)'] loop execute format('revoke all on function public.%s from public, anon, service_role', f); execute format('grant execute on function public.%s to authenticated', f); end loop; end $$;
