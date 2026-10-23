begin;

create or replace function public.crm_contact_360_summary(p_contact_id uuid)
returns table(
  contact_id uuid, first_name text, last_name text, email text, phone text,
  normalized_email text, normalized_phone text, preferred_locale text, source text,
  consent_marketing boolean, notes text, lifecycle_status text, blocked_at timestamptz,
  blocked_by uuid, blocked_by_name text, blocked_reason text, deleted_at timestamptz,
  deleted_by uuid, deleted_by_name text, deleted_reason text, is_test_data boolean,
  created_at timestamptz, updated_at timestamptz, open_opportunity_count bigint,
  active_opportunity_count bigint, archived_opportunity_count bigint,
  deleted_opportunity_count bigint, total_opportunity_count bigint, request_count bigint,
  unassigned_request_count bigint, quote_version_count bigint, accepted_quote_count bigint,
  booking_count bigint, payment_count bigint, document_count bigint,
  duplicate_email_count bigint, duplicate_phone_count bigint, duplicate_risk boolean,
  overdue_follow_up_count bigint, next_follow_up_at timestamptz, last_activity_at timestamptz,
  pipeline_mxn numeric, pipeline_usd numeric, accepted_quote_value_mxn numeric,
  accepted_quote_value_usd numeric
)
language sql stable security invoker set search_path = '' as $function$
with target_contact as (
  select c.* from public.contacts c where c.id = p_contact_id
), opportunity_rollup as (
  select l.contact_id,
    count(*) filter (where l.deleted_at is null and l.archived_at is null and not coalesce(ls.is_terminal, false))::bigint as open_count,
    count(*) filter (where l.deleted_at is null and l.archived_at is null)::bigint as active_count,
    count(*) filter (where l.deleted_at is null and l.archived_at is not null)::bigint as archived_count,
    count(*) filter (where l.deleted_at is not null)::bigint as deleted_count,
    count(*)::bigint as total_count,
    coalesce(sum(l.budget_mxn) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as pipeline_mxn,
    coalesce(sum(l.budget_usd) filter (where l.deleted_at is null and l.archived_at is null), 0)::numeric as pipeline_usd
  from public.leads l join target_contact tc on tc.id = l.contact_id
  left join public.lead_statuses ls on ls.id = l.status_id group by l.contact_id
), request_rollup as (
  select qr.contact_id, count(*)::bigint as request_count,
    count(*) filter (where qr.lead_id is null)::bigint as unassigned_request_count
  from public.quote_requests qr join target_contact tc on tc.id = qr.contact_id group by qr.contact_id
), quote_rollup as (
  select qv.contact_id, count(*)::bigint as quote_version_count,
    count(*) filter (where qv.status = 'accepted')::bigint as accepted_quote_count,
    coalesce(sum(qv.total_amount) filter (where qv.status = 'accepted' and qv.currency = 'MXN'), 0)::numeric as accepted_mxn,
    coalesce(sum(qv.total_amount) filter (where qv.status = 'accepted' and qv.currency = 'USD'), 0)::numeric as accepted_usd
  from public.quote_versions qv join target_contact tc on tc.id = qv.contact_id group by qv.contact_id
), booking_rollup as (
  select b.contact_id, count(*)::bigint as booking_count
  from public.bookings b join target_contact tc on tc.id = b.contact_id group by b.contact_id
), payment_rollup as (
  select p.contact_id, count(*)::bigint as payment_count
  from public.payments p join target_contact tc on tc.id = p.contact_id group by p.contact_id
), document_rollup as (
  select d.contact_id, count(*)::bigint as document_count
  from public.documents d join target_contact tc on tc.id = d.contact_id group by d.contact_id
), duplicate_rollup as (
  select tc.id as contact_id,
    count(dc.id) filter (where tc.normalized_email is not null and dc.normalized_email = tc.normalized_email)::bigint as duplicate_email_count,
    count(dc.id) filter (where tc.normalized_phone is not null and dc.normalized_phone = tc.normalized_phone)::bigint as duplicate_phone_count
  from target_contact tc left join public.contacts dc on dc.id <> tc.id and (
    (tc.normalized_email is not null and dc.normalized_email = tc.normalized_email)
    or (tc.normalized_phone is not null and dc.normalized_phone = tc.normalized_phone)
  ) group by tc.id
), follow_up_rollup as (
  select l.contact_id,
    count(*) filter (where t.due_at < now())::bigint as overdue_count,
    min(t.due_at) as next_follow_up_at
  from public.tasks t join public.leads l on l.id = t.lead_id
  join target_contact tc on tc.id = l.contact_id
  where t.task_kind = 'follow_up' and t.status in ('pending', 'in_progress')
    and t.lead_id is not null and l.deleted_at is null and l.archived_at is null
  group by l.contact_id
), activity_candidates as (
  select tc.id as contact_id, tc.updated_at as activity_at from target_contact tc
  union all select l.contact_id, l.updated_at from public.leads l join target_contact tc on tc.id = l.contact_id
  union all select l.contact_id, e.created_at from public.lead_events e join public.leads l on l.id = e.lead_id join target_contact tc on tc.id = l.contact_id
  union all select qr.contact_id, qr.updated_at from public.quote_requests qr join target_contact tc on tc.id = qr.contact_id
  union all select qv.contact_id, qv.updated_at from public.quote_versions qv join target_contact tc on tc.id = qv.contact_id
  union all select b.contact_id, b.updated_at from public.bookings b join target_contact tc on tc.id = b.contact_id
  union all select p.contact_id, p.updated_at from public.payments p join target_contact tc on tc.id = p.contact_id
  union all select d.contact_id, d.updated_at from public.documents d join target_contact tc on tc.id = d.contact_id
), activity_rollup as (
  select ac.contact_id, max(ac.activity_at) as last_activity_at
  from activity_candidates ac group by ac.contact_id
)
select tc.id, tc.first_name, tc.last_name, tc.email, tc.phone,
  tc.normalized_email, tc.normalized_phone, tc.preferred_locale, tc.source,
  tc.consent_marketing, tc.notes, tc.lifecycle_status, tc.blocked_at, tc.blocked_by,
  blocker.full_name, tc.blocked_reason, tc.deleted_at, tc.deleted_by, deleter.full_name,
  tc.deleted_reason, tc.is_test_data, tc.created_at, tc.updated_at,
  coalesce(op.open_count, 0), coalesce(op.active_count, 0), coalesce(op.archived_count, 0),
  coalesce(op.deleted_count, 0), coalesce(op.total_count, 0), coalesce(rr.request_count, 0),
  coalesce(rr.unassigned_request_count, 0), coalesce(qr.quote_version_count, 0),
  coalesce(qr.accepted_quote_count, 0), coalesce(br.booking_count, 0),
  coalesce(pr.payment_count, 0), coalesce(dr.document_count, 0),
  coalesce(du.duplicate_email_count, 0), coalesce(du.duplicate_phone_count, 0),
  coalesce(du.duplicate_email_count, 0) > 0 or coalesce(du.duplicate_phone_count, 0) > 0,
  coalesce(fr.overdue_count, 0), fr.next_follow_up_at, ar.last_activity_at,
  coalesce(op.pipeline_mxn, 0), coalesce(op.pipeline_usd, 0),
  coalesce(qr.accepted_mxn, 0), coalesce(qr.accepted_usd, 0)
from target_contact tc
left join public.profiles blocker on blocker.id = tc.blocked_by
left join public.profiles deleter on deleter.id = tc.deleted_by
left join opportunity_rollup op on op.contact_id = tc.id
left join request_rollup rr on rr.contact_id = tc.id
left join quote_rollup qr on qr.contact_id = tc.id
left join booking_rollup br on br.contact_id = tc.id
left join payment_rollup pr on pr.contact_id = tc.id
left join document_rollup dr on dr.contact_id = tc.id
left join duplicate_rollup du on du.contact_id = tc.id
left join follow_up_rollup fr on fr.contact_id = tc.id
left join activity_rollup ar on ar.contact_id = tc.id;
$function$;

revoke all on function public.crm_contact_360_summary(uuid) from public, anon, service_role;
grant execute on function public.crm_contact_360_summary(uuid) to authenticated;

-- Rollback through a later additive migration must restore the exact 0052 summary definition.

commit;
