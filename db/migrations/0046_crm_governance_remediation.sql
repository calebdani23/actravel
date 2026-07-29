-- Remediation for tombstone reachability, complete governance controls, and
-- least-privilege access to contact-centric operational context.

drop policy if exists "crm contact read" on public.contacts;
create policy "crm contact read" on public.contacts for select to authenticated using (
  (public.is_admin() and (deleted_at is null or deleted_at is not null)) or
  ((public.has_role('operaciones') or public.has_role('finanzas')) and deleted_at is null) or
  (public.has_role('asesor') and deleted_at is null and exists (
    select 1 from public.leads l where l.contact_id = contacts.id and l.assigned_to = auth.uid() and l.deleted_at is null
  ))
);

drop policy if exists "lead read scoped" on public.leads;
create policy "lead read scoped" on public.leads for select to authenticated using (
  (public.is_admin() and (deleted_at is null or deleted_at is not null)) or
  ((public.has_role('operaciones') or public.has_role('finanzas')) and deleted_at is null) or
  (public.has_role('asesor') and deleted_at is null and assigned_to = auth.uid())
);

-- Advisors may only inspect operational rows attached to a visible opportunity.
drop policy if exists "quote versions read scoped" on public.quote_versions;
create policy "quote versions read scoped" on public.quote_versions for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = quote_versions.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "bookings ops read" on public.bookings;
create policy "bookings ops read" on public.bookings for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = bookings.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "payments finance read" on public.payments;
create policy "payments finance read" on public.payments for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = payments.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);
drop policy if exists "documents ops read" on public.documents;
create policy "documents ops read" on public.documents for select to authenticated using (
  public.is_admin() or public.has_role('operaciones') or public.has_role('finanzas') or
  (public.has_role('asesor') and exists (select 1 from public.leads l where l.id = documents.lead_id and l.assigned_to = auth.uid() and l.deleted_at is null))
);

-- The application always authenticates as a user. Do not expose admin mutation
-- RPCs to service_role by default; privileged maintenance must use a separate,
-- explicitly-audited path.
do $$ declare f text; begin foreach f in array array[
  'crm_bulk_mutate(text,uuid[],text,text)','crm_bulk_block_contacts(uuid[])','crm_bulk_unblock_contacts(uuid[])',
  'crm_bulk_update_contact_lifecycle(uuid[],text)','crm_bulk_delete_restore_contacts(uuid[],boolean,text)',
  'crm_bulk_feature_opportunities(uuid[],boolean)','crm_bulk_update_opportunity_status(uuid[],uuid)',
  'crm_bulk_delete_restore_opportunities(uuid[],boolean,text)'] loop
  execute format('revoke all on function public.%s from service_role', f);
end loop; end $$;

create or replace function public.crm_bulk_archive_opportunities(p_opportunity_ids uuid[], p_archived boolean)
returns table(job_id uuid, requested_count integer, success_count integer, failure_count integer)
language sql security definer set search_path=public as $$
  select * from public.crm_bulk_mutate(case when $2 then 'opportunity_archive' else 'opportunity_unarchive' end, $1);
$$;
revoke all on function public.crm_bulk_archive_opportunities(uuid[],boolean) from public, anon, service_role;
grant execute on function public.crm_bulk_archive_opportunities(uuid[],boolean) to authenticated;

-- Explicitly stable pagination metadata for the application. The query layer may
-- request any page; no fixed application-side cap is implied by this contract.
create or replace function public.crm_contact_count(p_include_deleted boolean default false)
returns bigint language sql stable security invoker set search_path=public as $$
  select count(*) from public.contacts c where (p_include_deleted or c.deleted_at is null);
$$;
revoke all on function public.crm_contact_count(boolean) from public, anon;
grant execute on function public.crm_contact_count(boolean) to authenticated;

create or replace function public.crm_contact_aggregate_page(
  p_limit integer default 100, p_offset integer default 0,
  p_include_deleted boolean default false, p_search text default null
) returns table(
  contact_id uuid, total_count bigint, open_opportunity_count bigint,
  total_opportunity_count bigint, request_count bigint, quote_count bigint,
  last_activity_at timestamptz, pipeline_mxn numeric, pipeline_usd numeric
)
language sql stable security invoker set search_path=public as $$
  with visible_contacts as (
    select c.id, c.first_name, c.last_name, c.email, c.phone, c.deleted_at
    from public.contacts c
    where (p_include_deleted or c.deleted_at is null)
      and (p_search is null or concat_ws(' ', c.first_name, c.last_name, c.email, c.phone) ilike '%' || p_search || '%')
  ), lead_rollup as (
    select l.contact_id,
      count(*) filter (where l.deleted_at is null and coalesce(ls.is_terminal,false) = false)::bigint as open_count,
      count(*)::bigint as total_count,
      coalesce(sum(l.budget_mxn) filter (where l.deleted_at is null),0) as mxn,
      coalesce(sum(l.budget_usd) filter (where l.deleted_at is null),0) as usd,
      max(l.updated_at) as last_at
    from public.leads l left join public.lead_statuses ls on ls.id=l.status_id
    group by l.contact_id
  ), request_rollup as (
    select qr.contact_id, count(*)::bigint as count, max(qr.created_at) as last_at from public.quote_requests qr group by qr.contact_id
  ), quote_rollup as (
    select qv.contact_id, count(*)::bigint as count, max(qv.created_at) as last_at from public.quote_versions qv group by qv.contact_id
  )
  select vc.id, count(*) over(), coalesce(lr.open_count,0), coalesce(lr.total_count,0), coalesce(rr.count,0), coalesce(qr.count,0),
    greatest(lr.last_at, rr.last_at, qr.last_at), coalesce(lr.mxn,0), coalesce(lr.usd,0)
  from visible_contacts vc left join lead_rollup lr on lr.contact_id=vc.id left join request_rollup rr on rr.contact_id=vc.id left join quote_rollup qr on qr.contact_id=vc.id
  order by coalesce(greatest(lr.last_at,rr.last_at,qr.last_at), 'epoch'::timestamptz) desc, vc.id
  limit greatest(1,least(coalesce(p_limit,100),1000)) offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.crm_contact_aggregate_page(integer,integer,boolean,text) from public, anon;
grant execute on function public.crm_contact_aggregate_page(integer,integer,boolean,text) to authenticated;
