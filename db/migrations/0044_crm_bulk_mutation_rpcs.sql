-- Admin-only, fixed-search-path bulk mutations. Every mutation is a soft change and
-- writes one durable item audit row; entity ids intentionally have no foreign keys.

create or replace function public.crm_bulk_mutate(
  p_operation text, p_entity_ids uuid[], p_status_value text default null,
  p_confirmation text default null
) returns table(job_id uuid, requested_count integer, success_count integer, failure_count integer)
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid(); item uuid; job uuid; ok integer := 0; failed integer := 0;
  before_row jsonb; after_row jsonb; entity_type text; error_code text;
begin
  if actor is null or not public.is_admin() then raise insufficient_privilege using message = 'CRM bulk mutations require an administrator'; end if;
  if p_operation in ('contact_soft_delete','contact_restore') and p_confirmation is distinct from (case when p_operation = 'contact_soft_delete' then 'DELETE CONTACTS' else 'RESTORE CONTACTS' end) then
    raise exception 'Typed confirmation required';
  end if;
  if p_operation in ('opportunity_soft_delete','opportunity_restore') and p_confirmation is distinct from (case when p_operation = 'opportunity_soft_delete' then 'DELETE OPPORTUNITIES' else 'RESTORE OPPORTUNITIES' end) then
    raise exception 'Typed confirmation required';
  end if;
  if p_operation like 'contact_%' then entity_type := 'contact'; elsif p_operation like 'opportunity_%' then entity_type := 'opportunity'; else raise exception 'Unsupported CRM bulk operation'; end if;
  insert into public.crm_bulk_mutation_jobs(actor_id, operation, requested_count) values (actor, p_operation, coalesce(array_length(p_entity_ids,1),0)) returning id into job;
  foreach item in array coalesce(p_entity_ids, '{}'::uuid[]) loop
    before_row := null; after_row := null; error_code := null;
    begin
      if entity_type = 'contact' then
        select to_jsonb(c) into before_row from public.contacts c where c.id = item for update;
        if before_row is null then error_code := 'not_found';
        elsif p_operation = 'contact_block' then update public.contacts set lifecycle_status='blocked', blocked_at=coalesce(blocked_at,now()), blocked_by=actor, blocked_reason=coalesce(blocked_reason,'Bulk blocked') where id=item returning to_jsonb(contacts) into after_row;
        elsif p_operation = 'contact_unblock' then update public.contacts set lifecycle_status='active', blocked_at=null, blocked_by=null, blocked_reason=null where id=item and lifecycle_status='blocked' returning to_jsonb(contacts) into after_row;
        elsif p_operation = 'contact_lifecycle' and p_status_value in ('active','follow_up','customer','inactive','blocked') then update public.contacts set lifecycle_status=p_status_value where id=item and lifecycle_status <> 'deleted' returning to_jsonb(contacts) into after_row;
        elsif p_operation = 'contact_soft_delete' then update public.contacts set lifecycle_status='deleted', deleted_at=coalesce(deleted_at,now()), deleted_by=actor, deleted_reason='Bulk soft delete' where id=item and deleted_at is null returning to_jsonb(contacts) into after_row;
        elsif p_operation = 'contact_restore' then update public.contacts set lifecycle_status='active', deleted_at=null, deleted_by=null, deleted_reason=null where id=item and deleted_at is not null returning to_jsonb(contacts) into after_row;
        else error_code := 'invalid_operation'; end if;
      else
        select to_jsonb(l) into before_row from public.leads l where l.id = item for update;
        if before_row is null then error_code := 'not_found';
        elsif p_operation = 'opportunity_feature' then update public.leads set is_featured=true where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation = 'opportunity_unfeature' then update public.leads set is_featured=false where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation = 'opportunity_status' and p_status_value is not null and p_status_value::uuid is not null and exists(select 1 from public.lead_statuses where id=p_status_value::uuid) then update public.leads set status_id=p_status_value::uuid where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation = 'opportunity_soft_delete' then update public.leads set deleted_at=coalesce(deleted_at,now()), deleted_by=actor, deleted_reason='Bulk soft delete' where id=item and deleted_at is null returning to_jsonb(leads) into after_row;
        elsif p_operation = 'opportunity_restore' then update public.leads set deleted_at=null, deleted_by=null, deleted_reason=null where id=item and deleted_at is not null returning to_jsonb(leads) into after_row;
        else error_code := 'invalid_operation'; end if;
      end if;
      if before_row is not null and after_row is not null then ok := ok + 1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,before_state,after_state) values(job,entity_type,item,'succeeded',before_row,after_row); else failed := failed + 1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,error_code,error_message,before_state) values(job,entity_type,item,'failed',coalesce(error_code,'not_applicable'),'Entity was not eligible for this operation',before_row); end if;
    exception when others then failed := failed + 1; insert into public.crm_bulk_mutation_items(job_id,entity_type,entity_id,outcome,error_code,error_message,before_state) values(job,entity_type,item,'failed',sqlstate,'Mutation was not applied',before_row);
    end;
  end loop;
  update public.crm_bulk_mutation_jobs set success_count=ok,failure_count=failed,completed_at=now() where id=job;
  return query select job, coalesce(array_length(p_entity_ids,1),0), ok, failed;
end; $$;

create or replace function public.crm_bulk_block_contacts(p_contact_ids uuid[]) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate('contact_block',$1); $$;
create or replace function public.crm_bulk_unblock_contacts(p_contact_ids uuid[]) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate('contact_unblock',$1); $$;
create or replace function public.crm_bulk_update_contact_lifecycle(p_contact_ids uuid[], p_lifecycle_status text) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate('contact_lifecycle',$1,$2); $$;
create or replace function public.crm_bulk_delete_restore_contacts(p_contact_ids uuid[], p_restore boolean, p_confirmation text) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate(case when $2 then 'contact_restore' else 'contact_soft_delete' end,$1,null,$3); $$;
create or replace function public.crm_bulk_feature_opportunities(p_opportunity_ids uuid[], p_featured boolean) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate(case when $2 then 'opportunity_feature' else 'opportunity_unfeature' end,$1); $$;
create or replace function public.crm_bulk_update_opportunity_status(p_opportunity_ids uuid[], p_status_id uuid) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate('opportunity_status',$1,$2::text); $$;
create or replace function public.crm_bulk_delete_restore_opportunities(p_opportunity_ids uuid[], p_restore boolean, p_confirmation text) returns table(job_id uuid,requested_count integer,success_count integer,failure_count integer) language sql security definer set search_path=public as $$ select * from public.crm_bulk_mutate(case when $2 then 'opportunity_restore' else 'opportunity_soft_delete' end,$1,null,$3); $$;

do $$ declare f text; begin foreach f in array array['crm_bulk_mutate(text,uuid[],text,text)','crm_bulk_block_contacts(uuid[])','crm_bulk_unblock_contacts(uuid[])','crm_bulk_update_contact_lifecycle(uuid[],text)','crm_bulk_delete_restore_contacts(uuid[],boolean,text)','crm_bulk_feature_opportunities(uuid[],boolean)','crm_bulk_update_opportunity_status(uuid[],uuid)','crm_bulk_delete_restore_opportunities(uuid[],boolean,text)'] loop execute format('revoke all on function public.%s from public, anon', f); execute format('grant execute on function public.%s to authenticated, service_role', f); end loop; end $$;
