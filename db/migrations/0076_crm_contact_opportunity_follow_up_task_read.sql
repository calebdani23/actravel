begin;

create or replace function public.crm_contact_opportunity_page(
  p_contact_id uuid,
  p_state text default 'active',
  p_limit integer default 20,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null
)
returns table(
  opportunity_id uuid, contact_id uuid, opportunity_state text, status_id uuid,
  status_name text, status_label text, status_is_terminal boolean, assigned_to uuid,
  owner_name text, destination_id uuid, destination_name text, service_id uuid,
  service_name text, summary text, source text, priority text, travel_start_date date,
  travel_end_date date, travelers_count integer, budget_mxn numeric, budget_usd numeric,
  is_featured boolean, is_test_data boolean, created_at timestamptz, updated_at timestamptz,
  archived_at timestamptz, archived_by uuid, archived_by_name text, deleted_at timestamptz,
  deleted_by uuid, deleted_by_name text, deleted_reason text, request_count bigint,
  open_request_count bigint, latest_request_id uuid, latest_request_status text,
  latest_request_locale text, latest_request_source text, latest_request_created_at timestamptz,
  quote_version_count bigint, active_quote_version_count bigint, latest_quote_id uuid,
  latest_quote_version_number integer, latest_quote_title text, latest_quote_status text,
  latest_quote_currency text, latest_quote_amount numeric, latest_quote_updated_at timestamptz,
  accepted_quote_id uuid, accepted_quote_version_number integer,
  accepted_quote_currency text, accepted_quote_amount numeric,
  accepted_quote_accepted_at timestamptz, latest_follow_up_at timestamptz,
  latest_follow_up_created_at timestamptz, follow_up_overdue boolean,
  last_activity_at timestamptz, page_has_more boolean
)
language plpgsql stable security invoker set search_path = '' as $function$
begin
  if p_contact_id is null then
    raise invalid_parameter_value using message = 'p_contact_id is required';
  end if;
  if p_state is null or p_state not in ('active', 'archived', 'deleted', 'all') then
    raise invalid_parameter_value using message = 'p_state must be active, archived, deleted, or all';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_updated_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select l.* from public.leads l join public.contacts c on c.id = l.contact_id
    where l.contact_id = p_contact_id
      and (p_state = 'all'
        or (p_state = 'active' and l.deleted_at is null and l.archived_at is null)
        or (p_state = 'archived' and l.deleted_at is null and l.archived_at is not null)
        or (p_state = 'deleted' and l.deleted_at is not null))
      and (p_after_updated_at is null or l.updated_at < p_after_updated_at
        or (l.updated_at = p_after_updated_at and l.id < p_after_id))
    order by l.updated_at desc, l.id desc limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr order by cr.updated_at desc, cr.id desc limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  ), request_ranked as (
    select qr.*, row_number() over (partition by qr.lead_id order by qr.created_at desc, qr.id desc) as request_rank
    from public.quote_requests qr join page_rows pr on pr.id = qr.lead_id
  ), request_rollup as (
    select rr.lead_id, count(*)::bigint as request_count,
      count(*) filter (where rr.status in ('received', 'processing'))::bigint as open_request_count
    from request_ranked rr group by rr.lead_id
  ), latest_request as (
    select rr.* from request_ranked rr where rr.request_rank = 1
  ), quote_ranked as (
    select qv.*, row_number() over (partition by qv.lead_id order by qv.version_number desc, qv.id desc) as quote_rank
    from public.quote_versions qv join page_rows pr on pr.id = qv.lead_id
  ), quote_rollup as (
    select qr.lead_id, count(*)::bigint as quote_version_count,
      count(*) filter (where qr.status in ('draft', 'sent', 'accepted'))::bigint as active_quote_version_count
    from quote_ranked qr group by qr.lead_id
  ), latest_quote as (
    select qr.* from quote_ranked qr where qr.quote_rank = 1
  ), accepted_quote_ranked as (
    select qr.*, row_number() over (partition by qr.lead_id
      order by qr.accepted_at desc nulls last, qr.version_number desc, qr.id desc) as accepted_rank
    from quote_ranked qr where qr.status = 'accepted'
  ), accepted_quote as (
    select aqr.* from accepted_quote_ranked aqr where aqr.accepted_rank = 1
  ), follow_up_task_ranked as (
    select t.lead_id, t.due_at,
      row_number() over (partition by t.lead_id order by t.due_at, t.id) as task_rank,
      bool_or(t.due_at < now()) over (partition by t.lead_id) as follow_up_overdue
    from public.tasks t join page_rows pr on pr.id = t.lead_id
    where t.task_kind = 'follow_up' and t.status in ('pending', 'in_progress')
      and t.lead_id is not null and pr.deleted_at is null and pr.archived_at is null
  ), earliest_follow_up_task as (
    select ftr.lead_id, ftr.due_at, ftr.follow_up_overdue
    from follow_up_task_ranked ftr where ftr.task_rank = 1
  ), follow_up_history_ranked as (
    select e.lead_id, e.created_at,
      row_number() over (partition by e.lead_id order by e.created_at desc, e.id desc) as history_rank
    from public.lead_events e join page_rows pr on pr.id = e.lead_id
    where e.event_type = 'follow_up_registered'
  ), latest_follow_up_history as (
    select fhr.lead_id, fhr.created_at from follow_up_history_ranked fhr where fhr.history_rank = 1
  ), activity_candidates as (
    select pr.id as lead_id, pr.updated_at as activity_at from page_rows pr
    union all select e.lead_id, e.created_at from public.lead_events e join page_rows pr on pr.id = e.lead_id
    union all select qr.lead_id, qr.updated_at from public.quote_requests qr join page_rows pr on pr.id = qr.lead_id
    union all select qv.lead_id, qv.updated_at from public.quote_versions qv join page_rows pr on pr.id = qv.lead_id
    union all select b.lead_id, b.updated_at from public.bookings b join page_rows pr on pr.id = b.lead_id
    union all select p.lead_id, p.updated_at from public.payments p join page_rows pr on pr.id = p.lead_id
    union all select d.lead_id, d.updated_at from public.documents d join page_rows pr on pr.id = d.lead_id
  ), activity_rollup as (
    select ac.lead_id, max(ac.activity_at) as last_activity_at from activity_candidates ac group by ac.lead_id
  )
  select pr.id, pr.contact_id,
    case when pr.deleted_at is not null then 'deleted' when pr.archived_at is not null then 'archived' else 'active' end,
    pr.status_id, ls.name, ls.label_es, coalesce(ls.is_terminal, false), pr.assigned_to,
    owner_profile.full_name, pr.destination_id, d.name_es, pr.service_id, s.name_es,
    pr.summary, pr.source, pr.priority, pr.travel_start_date, pr.travel_end_date,
    pr.travelers_count, pr.budget_mxn, pr.budget_usd, pr.is_featured, pr.is_test_data,
    pr.created_at, pr.updated_at, pr.archived_at, pr.archived_by, archived_profile.full_name,
    pr.deleted_at, pr.deleted_by, deleted_profile.full_name, pr.deleted_reason,
    coalesce(rr.request_count, 0), coalesce(rr.open_request_count, 0), lr.id, lr.status,
    lr.locale, coalesce(nullif(lr.payload ->> 'sourceChannel', ''), nullif(lr.payload ->> 'source', '')),
    lr.created_at, coalesce(qr.quote_version_count, 0), coalesce(qr.active_quote_version_count, 0),
    lq.id, lq.version_number, lq.title, lq.status, lq.currency, lq.total_amount, lq.updated_at,
    aq.id, aq.version_number, aq.currency, aq.total_amount, aq.accepted_at,
    eft.due_at, lfh.created_at, coalesce(eft.follow_up_overdue, false), ar.last_activity_at, pm.has_more
  from page_rows pr cross join page_metadata pm
  left join public.lead_statuses ls on ls.id = pr.status_id
  left join public.profiles owner_profile on owner_profile.id = pr.assigned_to
  left join public.profiles archived_profile on archived_profile.id = pr.archived_by
  left join public.profiles deleted_profile on deleted_profile.id = pr.deleted_by
  left join public.destinations d on d.id = pr.destination_id
  left join public.services s on s.id = pr.service_id
  left join request_rollup rr on rr.lead_id = pr.id
  left join latest_request lr on lr.lead_id = pr.id
  left join quote_rollup qr on qr.lead_id = pr.id
  left join latest_quote lq on lq.lead_id = pr.id
  left join accepted_quote aq on aq.lead_id = pr.id
  left join earliest_follow_up_task eft on eft.lead_id = pr.id
  left join latest_follow_up_history lfh on lfh.lead_id = pr.id
  left join activity_rollup ar on ar.lead_id = pr.id
  order by pr.updated_at desc, pr.id desc;
end;
$function$;

revoke all on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) from public, anon, service_role;
grant execute on function public.crm_contact_opportunity_page(uuid, text, integer, timestamptz, uuid) to authenticated;

-- Rollback through a later additive migration must restore the exact 0052 opportunity definition after application-reader rollback.

commit;
