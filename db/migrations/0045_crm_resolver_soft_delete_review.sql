-- Resolver compatibility: tombstones are never reused; blocked contacts remain
-- intake-available but always produce an explicit review event/status.
create or replace function public.crm_resolve_opportunity_lead(
  p_contact_id uuid, p_status_id uuid, p_assigned_to uuid default null,
  p_source text default 'website_quote', p_priority text default 'normal',
  p_summary text default null, p_destination_id uuid default null,
  p_service_id uuid default null, p_travel_start_date date default null,
  p_travel_end_date date default null, p_travelers_count integer default 1,
  p_budget_mxn numeric default null, p_budget_usd numeric default null,
  p_opportunity_signature text default null, p_opportunity_signature_version smallint default 1,
  p_opportunity_basis jsonb default '{}'::jsonb
) returns table(lead_id uuid,resolution_status text,created_new boolean,review_required boolean,reliable_purpose boolean,signature text,signature_version smallint,basis jsonb)
language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); actor_admin boolean:=coalesce(public.is_admin(),false); actor_advisor boolean:=coalesce(public.has_role('asesor'),false); assigned uuid:=p_assigned_to; candidate record; created uuid; blocked_contact boolean;
begin
  if p_contact_id is null or p_status_id is null or nullif(trim(p_source),'') is null or nullif(trim(p_opportunity_signature),'') is null then raise exception 'crm_resolve_opportunity_lead requires contact, status, source, and reliable signature'; end if;
  select c.lifecycle_status='blocked' into blocked_contact from public.contacts c where c.id=p_contact_id and c.deleted_at is null;
  if not found then raise exception 'CRM contact is not available'; end if;
  if actor_id is not null and not actor_admin and not actor_advisor then raise insufficient_privilege using message='Not authorized to resolve CRM opportunities'; end if;
  if actor_id is not null and actor_advisor and not actor_admin then
    if not exists (select 1 from public.leads l where l.contact_id=p_contact_id and l.assigned_to=actor_id and l.deleted_at is null) then
      raise insufficient_privilege using message='Advisors may only resolve visible contacts';
    end if;
    if p_assigned_to is not null and p_assigned_to <> actor_id then raise insufficient_privilege using message='Advisors may only create self-assigned manual opportunities'; end if;
    assigned:=actor_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('crm_opportunity|'||p_contact_id::text||'|'||p_opportunity_signature||'|'||p_opportunity_signature_version::text,0));
  select l.id,l.assigned_to,coalesce(ls.is_terminal,false) is_terminal into candidate
  from public.leads l left join public.lead_statuses ls on ls.id=l.status_id
  where l.contact_id=p_contact_id and l.deleted_at is null and l.opportunity_signature=p_opportunity_signature and l.opportunity_signature_version=p_opportunity_signature_version
  order by case when coalesce(ls.is_terminal,false) then 1 else 0 end,l.updated_at desc,l.created_at desc,l.id limit 1;
  if candidate.id is not null and (actor_id is null or actor_admin or candidate.assigned_to=actor_id) then
    update public.leads set destination_id=p_destination_id,service_id=p_service_id,travel_start_date=p_travel_start_date,travel_end_date=p_travel_end_date,travelers_count=coalesce(p_travelers_count,1),budget_mxn=p_budget_mxn,budget_usd=p_budget_usd,summary=p_summary,updated_at=now() where id=candidate.id;
    return query select candidate.id,'reused_existing',false,blocked_contact,true,p_opportunity_signature,p_opportunity_signature_version,coalesce(p_opportunity_basis,'{}'::jsonb); return;
  end if;
  insert into public.leads(contact_id,status_id,assigned_to,destination_id,service_id,travel_start_date,travel_end_date,travelers_count,budget_mxn,budget_usd,source,priority,summary,opportunity_signature,opportunity_signature_version,opportunity_basis)
  values(p_contact_id,p_status_id,assigned,p_destination_id,p_service_id,p_travel_start_date,p_travel_end_date,coalesce(p_travelers_count,1),p_budget_mxn,p_budget_usd,p_source,coalesce(nullif(trim(p_priority),''),'normal'),p_summary,p_opportunity_signature,p_opportunity_signature_version,coalesce(p_opportunity_basis,'{}'::jsonb)) returning id into created;
  return query select created,case when candidate.id is not null then 'created_duplicate_review' else 'created_new' end,true,(candidate.id is not null or blocked_contact),true,p_opportunity_signature,p_opportunity_signature_version,coalesce(p_opportunity_basis,'{}'::jsonb);
end; $$;
revoke all on function public.crm_resolve_opportunity_lead(uuid,uuid,uuid,text,text,text,uuid,uuid,date,date,integer,numeric,numeric,text,smallint,jsonb) from public,anon;
grant execute on function public.crm_resolve_opportunity_lead(uuid,uuid,uuid,text,text,text,uuid,uuid,date,date,integer,numeric,numeric,text,smallint,jsonb) to authenticated,service_role;
