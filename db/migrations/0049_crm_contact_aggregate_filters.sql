-- Authoritative, RLS-scoped contact list aggregate.  The count is computed
-- before pagination so the UI never mistakes a page for the full result set.
-- 0046 left a legacy four-argument overload behind. Remove it explicitly so
-- callers cannot accidentally resolve the pre-contact-centric contract.
drop function if exists public.crm_contact_aggregate_page(integer,integer,boolean,text);

create or replace function public.crm_contact_aggregate_page(
  p_limit integer default 50, p_offset integer default 0,
  p_include_deleted boolean default false, p_deleted_only boolean default false,
  p_search text default null, p_lifecycle text default null,
  p_blocked boolean default null, p_advisor uuid default null,
  p_unassigned boolean default false, p_open_only boolean default false,
  p_overdue boolean default false, p_duplicate boolean default false,
  p_destination uuid default null, p_service uuid default null,
  p_source text default null, p_quick_view text default null,
  p_deleted_opportunity_only boolean default false, p_contact_id uuid default null
) returns table(
  contact_id uuid, total_count bigint, first_name text, last_name text,
  email text, phone text, lifecycle_status text, blocked_at timestamptz,
  blocked_reason text, deleted_at timestamptz, duplicate_risk boolean,
  open_opportunity_count bigint, total_opportunity_count bigint,
  deleted_opportunity_count bigint, featured_opportunity_count bigint,
  request_count bigint, quote_count bigint, overdue_count bigint,
  next_follow_up_at timestamptz, last_activity_at timestamptz,
  owners text[], destinations text[], services text[], pipeline_mxn numeric,
  pipeline_usd numeric
)
language sql stable security invoker set search_path=public as $$
with contact_base as (
  select c.*, count(c.normalized_email) over (partition by c.normalized_email) as email_dupes,
    count(c.normalized_phone) over (partition by c.normalized_phone) as phone_dupes
  from public.contacts c
  where (p_include_deleted or c.deleted_at is null)
    and (not p_deleted_only or c.deleted_at is not null)
    and (p_contact_id is null or c.id = p_contact_id)
    and (p_lifecycle is null or c.lifecycle_status = p_lifecycle)
    and (p_blocked is null or (c.lifecycle_status = 'blocked') = p_blocked)
), lead_base as (
  select l.*, ls.name as status_name, coalesce(ls.is_terminal, false) as terminal,
    p.full_name as owner_name, d.name_es as destination_name, s.name_es as service_name
  from public.leads l
  left join public.lead_statuses ls on ls.id = l.status_id
  left join public.profiles p on p.id = l.assigned_to
  left join public.destinations d on d.id = l.destination_id
  left join public.services s on s.id = l.service_id
), lead_rollup as (
  select l.contact_id,
     count(*) filter (where l.deleted_at is null and l.archived_at is null and not l.terminal)::bigint as open_count,
    count(*)::bigint as total_count,
    count(*) filter (where l.deleted_at is not null)::bigint as deleted_count,
     count(*) filter (where l.deleted_at is null and l.archived_at is null and l.is_featured)::bigint as featured_count,
    array_remove(array_agg(distinct l.owner_name), null)::text[] as owners,
    array_remove(array_agg(distinct l.destination_name), null)::text[] as destinations,
    array_remove(array_agg(distinct l.service_name), null)::text[] as services,
     coalesce(sum(l.budget_mxn) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as mxn,
     coalesce(sum(l.budget_usd) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as usd
  from lead_base l group by l.contact_id
), request_rollup as (
  select q.contact_id, count(*)::bigint as count from public.quote_requests q group by q.contact_id
), quote_rollup as (
  select q.contact_id, count(*)::bigint as count from public.quote_versions q group by q.contact_id
), followup_candidates as (
  select l.contact_id, nullif(e.payload->>'followUpAt', '')::timestamptz as follow_up_at,
    row_number() over (partition by e.lead_id order by e.created_at desc, e.id desc) as rn
  from public.lead_events e join public.leads l on l.id = e.lead_id
    where e.event_type = 'follow_up_registered' and l.deleted_at is null and l.archived_at is null and nullif(e.payload->>'followUpAt', '') is not null
), followup_rollup as (
  select contact_id,
    count(*) filter (where follow_up_at < now())::bigint as overdue,
    min(follow_up_at) filter (where follow_up_at >= now()) as next_at
  from followup_candidates where rn = 1 group by contact_id
), activity_candidates as (
  select c.id as contact_id, c.updated_at as at from public.contacts c
   union all select l.contact_id, l.updated_at from public.leads l where l.deleted_at is null
   union all select l.contact_id, e.created_at from public.lead_events e join public.leads l on l.id=e.lead_id where l.deleted_at is null
   union all select coalesce(q.contact_id,l.contact_id), q.created_at from public.quote_requests q left join public.leads l on l.id=q.lead_id where q.lead_id is null or l.deleted_at is null
   union all select coalesce(q.contact_id,l.contact_id), q.created_at from public.quote_versions q left join public.leads l on l.id=q.lead_id where q.lead_id is null or l.deleted_at is null
   union all select coalesce(p.contact_id,l.contact_id), p.created_at from public.payments p left join public.leads l on l.id=p.lead_id where p.lead_id is null or l.deleted_at is null
   union all select coalesce(b.contact_id,l.contact_id), b.created_at from public.bookings b left join public.leads l on l.id=b.lead_id where b.lead_id is null or l.deleted_at is null
   union all select coalesce(d.contact_id,l.contact_id), d.created_at from public.documents d left join public.leads l on l.id=d.lead_id where d.lead_id is null or l.deleted_at is null
   union all select coalesce(n.contact_id,l.contact_id), n.created_at from public.notification_logs n left join public.leads l on l.id=n.lead_id where n.lead_id is null or l.deleted_at is null
   union all select coalesce(w.contact_id,l.contact_id), w.created_at from public.whatsapp_clicks w left join public.leads l on l.id=w.lead_id where w.lead_id is null or l.deleted_at is null
   union all select coalesce(w.contact_id,l.contact_id), w.created_at from public.whatsapp_inbound_messages w left join public.leads l on l.id=w.lead_id where w.lead_id is null or l.deleted_at is null
), activity_rollup as (
  select contact_id, max(at) as last_at from activity_candidates where contact_id is not null group by contact_id
), filtered as (
  select c.*, coalesce(lr.open_count,0) open_count, coalesce(lr.total_count,0) total_count,
    coalesce(lr.deleted_count,0) deleted_count, coalesce(lr.featured_count,0) featured_count,
    coalesce(rr.count,0) request_count, coalesce(qr.count,0) quote_count,
    coalesce(fr.overdue,0) overdue_count, fr.next_at, ar.last_at,
    coalesce(lr.owners,'{}') owners, coalesce(lr.destinations,'{}') destinations,
    coalesce(lr.services,'{}') services, coalesce(lr.mxn,0) mxn, coalesce(lr.usd,0) usd
  from contact_base c
  left join lead_rollup lr on lr.contact_id=c.id
  left join request_rollup rr on rr.contact_id=c.id
  left join quote_rollup qr on qr.contact_id=c.id
  left join followup_rollup fr on fr.contact_id=c.id
  left join activity_rollup ar on ar.contact_id=c.id
  where (p_advisor is null or exists (select 1 from lead_base l where l.contact_id=c.id and l.assigned_to=p_advisor and l.deleted_at is null))
    and (not p_unassigned or exists (select 1 from lead_base l where l.contact_id=c.id and l.assigned_to is null and l.deleted_at is null))
    and (p_destination is null or exists (select 1 from lead_base l where l.contact_id=c.id and l.destination_id=p_destination and l.deleted_at is null))
    and (p_service is null or exists (select 1 from lead_base l where l.contact_id=c.id and l.service_id=p_service and l.deleted_at is null))
    and (p_source is null or exists (select 1 from lead_base l where l.contact_id=c.id and l.source=p_source and l.deleted_at is null))
    and (not p_deleted_opportunity_only or coalesce(lr.deleted_count,0)>0)
    and (not p_open_only or coalesce(lr.open_count,0)>0)
    and (not p_overdue or coalesce(fr.overdue,0)>0)
    and (not p_duplicate or c.email_dupes>1 or c.phone_dupes>1)
    and (p_search is null or concat_ws(' ',c.first_name,c.last_name,c.email,c.phone,array_to_string(lr.destinations,' '),array_to_string(lr.services,' '),array_to_string(lr.owners,' ')) ilike '%'||trim(p_search)||'%')
), quick as (
  select * from filtered where p_quick_view is null
    or (p_quick_view='follow_up' and (overdue_count>0 or next_at is not null))
    or (p_quick_view='unassigned' and exists(select 1 from lead_base l where l.contact_id=filtered.id and l.assigned_to is null and l.deleted_at is null))
    or (p_quick_view='duplicates' and (email_dupes>1 or phone_dupes>1))
    or (p_quick_view='blocked' and lifecycle_status='blocked')
    or (p_quick_view='recurring' and total_count>1)
    or (p_quick_view='high_value' and (mxn>=100000 or usd>=10000))
    or (p_quick_view='multiple_requests' and request_count>1)
)
select id, count(*) over(), first_name,last_name,email,phone,lifecycle_status,blocked_at,blocked_reason,deleted_at,
  (email_dupes>1 or phone_dupes>1), open_count,total_count,deleted_count,featured_count,request_count,quote_count,
  overdue_count,next_at,last_at,owners,destinations,services,mxn,usd
from quick order by coalesce(last_at,'epoch'::timestamptz) desc,id
limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.crm_contact_aggregate_page(integer,integer,boolean,boolean,text,text,boolean,uuid,boolean,boolean,boolean,boolean,uuid,uuid,text,text,boolean,uuid) from public, anon;
grant execute on function public.crm_contact_aggregate_page(integer,integer,boolean,boolean,text,text,boolean,uuid,boolean,boolean,boolean,boolean,uuid,uuid,text,text,boolean,uuid) to authenticated;
