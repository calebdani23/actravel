-- Mandatory initial-PDF application cutover and removal of compatibility writers.

-- These functions exist whether production did or did not receive 0057. No active
-- application caller remains, and retaining either path would bypass registration.
revoke all on function public.crm_create_quote(uuid, text, text, text, numeric, numeric, date, text, uuid, text)
  from public, anon, authenticated, service_role;
drop function public.crm_create_quote(uuid, text, text, text, numeric, numeric, date, text, uuid, text);

revoke all on function public.crm_link_legacy_quote_document(uuid, uuid, text)
  from public, anon, authenticated, service_role;
drop function public.crm_link_legacy_quote_document(uuid, uuid, text);

revoke all on function public.crm_accept_quote_version(uuid, uuid)
  from public, anon, authenticated, service_role;
drop function public.crm_accept_quote_version(uuid, uuid);

-- Repeat the 0057 table cutover so this migration is independently safe after
-- production 0053-0056 + 0058 + 0059. SECURITY DEFINER RPC owners retain access.
drop policy if exists "quote versions insert scoped" on public.quote_versions;
drop policy if exists "quote versions update scoped" on public.quote_versions;
revoke all on table public.quote_versions from public, anon, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.quote_versions from authenticated;
grant select on table public.quote_versions to authenticated;
alter table public.quote_versions alter column quote_id drop default;

-- Remove the pre-header compatibility branch that used to materialize a quote
-- when a direct quote_versions insert omitted quote_id.
create or replace function public.crm_enforce_quote_version_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  lead_row record;
  quote_row record;
  request_row record;
  actor_profile_id uuid;
  previous_sent_at timestamptz := case when tg_op = 'UPDATE' then old.sent_at else null end;
  previous_accepted_at timestamptz := case when tg_op = 'UPDATE' then old.accepted_at else null end;
  previous_rejected_at timestamptz := case when tg_op = 'UPDATE' then old.rejected_at else null end;
  previous_expired_at timestamptz := case when tg_op = 'UPDATE' then old.expired_at else null end;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.quote_id is distinct from old.quote_id
    or new.lead_id is distinct from old.lead_id
    or new.contact_id is distinct from old.contact_id
    or new.quote_request_id is distinct from old.quote_request_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Quote version identity, provenance, and relationships are immutable after creation';
  end if;

  if tg_op = 'UPDATE' and old.finalized_at is not null and (
    new.status = 'draft'
    or new.version_number is distinct from old.version_number
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.currency is distinct from old.currency
    or new.total_amount is distinct from old.total_amount
    or new.deposit_amount is distinct from old.deposit_amount
    or new.notes is distinct from old.notes
    or new.valid_until is distinct from old.valid_until
    or new.idempotency_key is distinct from old.idempotency_key
    or new.finalized_at is distinct from old.finalized_at
    or new.finalized_by is distinct from old.finalized_by
    or new.content_sha256 is distinct from old.content_sha256
  ) then
    raise exception 'Finalized quote version commercial content is immutable';
  end if;

  select l.id, l.contact_id, l.assigned_to
  into lead_row
  from public.leads l
  where l.id = new.lead_id;

  if lead_row.id is null then
    raise exception 'Quote version opportunity was not found';
  end if;
  if new.contact_id is distinct from lead_row.contact_id then
    raise exception 'Quote version contact must match the opportunity contact';
  end if;
  if new.quote_id is null then
    raise exception 'Quote versions require an existing quote header and may only be created through canonical RPCs';
  end if;

  select q.id, q.contact_id, q.lead_id
  into quote_row
  from public.quotes q
  where q.id = new.quote_id;

  if quote_row.id is null
    or quote_row.lead_id is distinct from new.lead_id
    or quote_row.contact_id is distinct from new.contact_id
  then
    raise exception 'Quote version must belong to the same quote, opportunity, and contact';
  end if;

  if new.quote_request_id is not null then
    select qr.lead_id, qr.contact_id
    into request_row
    from public.quote_requests qr
    where qr.id = new.quote_request_id;

    if request_row.lead_id is null
      or request_row.contact_id is null
      or request_row.lead_id is distinct from new.lead_id
      or request_row.contact_id is distinct from new.contact_id
    then
      raise exception 'Quote version intake request must belong to the same opportunity and contact';
    end if;
  end if;

  if new.status = 'draft' then
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.finalized_at := null;
    new.finalized_by := null;
    new.content_sha256 := null;
  elsif new.status = 'sent' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at, now());
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status = 'accepted' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := coalesce(new.accepted_at, previous_accepted_at, now());
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status = 'rejected' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := coalesce(new.rejected_at, previous_rejected_at, now());
    new.expired_at := null;
  elsif new.status = 'expired' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := coalesce(new.expired_at, previous_expired_at, now());
  elsif new.status = 'ready' then
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status in ('cancelled', 'superseded') then
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  end if;

  if new.status <> 'draft' and new.finalized_at is null then
    select p.id into actor_profile_id
    from public.profiles p
    where p.id = auth.uid();

    new.finalized_at := now();
    new.finalized_by := coalesce(new.finalized_by, actor_profile_id,
      case when exists (select 1 from public.profiles p where p.id = new.created_by) then new.created_by end);
    new.content_sha256 := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'quoteId', new.quote_id,
            'versionNumber', new.version_number,
            'title', new.title,
            'summary', new.summary,
            'currency', new.currency,
            'totalAmount', new.total_amount,
            'depositAmount', new.deposit_amount,
            'notes', new.notes,
            'validUntil', new.valid_until,
            'quoteRequestId', new.quote_request_id
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_version_integrity()
  from public, anon, authenticated, service_role;

-- Existing quotes are intentionally untouched. This deferred trigger runs only
-- for headers inserted after 0060 and observes the final transaction state.
create or replace function public.crm_enforce_new_quote_registration_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.quotes q
    join public.quote_registration_intents qri
      on qri.id = q.registration_intent_id
      and qri.target_quote_id = q.id
    join public.quote_versions qv
      on qv.id = qri.target_quote_version_id
      and qv.quote_id = q.id
    join public.documents d
      on d.id = qri.target_document_id
      and d.quote_version_id = qv.id
    join storage.objects so
      on so.bucket_id = d.bucket
      and so.name = d.path
    where q.id = new.id
      and qri.status = 'finalized'
      and qri.finalized_at is not null
      and qri.trusted_verified_size_bytes is not null
      and qri.trusted_verified_sha256 is not null
      and q.status = 'ready'
      and q.current_version_id = qv.id
      and qv.version_number = 1
      and qv.status = 'ready'
      and qv.finalized_at is not null
      and d.document_type = 'quote'
      and d.quote_link_source = 'native'
      and d.status = 'active'
      and d.storage_state = 'ready'
      and d.deleted_at is null
      and d.bucket = 'quote-pdfs'
      and d.path = qri.path
      and d.mime_type = 'application/pdf'
      and d.byte_size = qri.trusted_verified_size_bytes
      and d.sha256 = qri.trusted_verified_sha256
      and lower(storage.extension(so.name)) = 'pdf'
      and lower(coalesce(nullif(so.metadata ->> 'mimetype', ''), nullif(so.metadata ->> 'contentType', ''))) = 'application/pdf'
      and coalesce(nullif(so.metadata ->> 'size', ''), nullif(so.metadata ->> 'contentLength', '')) ~ '^[0-9]+$'
      and coalesce(nullif(so.metadata ->> 'size', ''), nullif(so.metadata ->> 'contentLength', ''))::bigint = qri.trusted_verified_size_bytes
  ) then
    raise exception 'Every new quote must commit with a finalized registration intent and ready native V1 PDF';
  end if;
  return null;
end;
$function$;

revoke all on function public.crm_enforce_new_quote_registration_complete()
  from public, anon, authenticated, service_role;
drop trigger if exists enforce_new_quote_registration_complete on public.quotes;
create constraint trigger enforce_new_quote_registration_complete
  after insert on public.quotes
  deferrable initially deferred
  for each row execute function public.crm_enforce_new_quote_registration_complete();

-- Retain all prior portfolio issues, replace new legacy-link candidates with
-- durable registration recovery and object-cleanup work.
create or replace function public.crm_quote_data_quality_page(
  p_limit integer default 100,
  p_issue_type text default null,
  p_after_issue_key text default null
)
returns table(
  issue_key text,
  issue_type text,
  severity text,
  quote_id uuid,
  quote_version_id uuid,
  document_id uuid,
  booking_id uuid,
  payment_id uuid,
  intent_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  summary text,
  detected_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_admin() then
    raise insufficient_privilege using message = 'Quote data quality requires an administrator';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 200';
  end if;
  if p_issue_type is not null and p_issue_type not in (
    'missing_ready_pdf',
    'scope_mismatch',
    'stale_upload_intent',
    'registration_intent_expired',
    'registration_intent_failed',
    'registration_object_cleanup'
  ) then
    raise invalid_parameter_value using message = 'Unknown quote data-quality issue type';
  end if;

  return query
  with issue_rows as (
    select
      'missing-ready-pdf:' || qv.id::text as issue_key,
      'missing_ready_pdf'::text as issue_type,
      'high'::text as severity,
      q.id as quote_id,
      qv.id as quote_version_id,
      d.id as document_id,
      null::uuid as booking_id,
      null::uuid as payment_id,
      null::uuid as intent_id,
      q.contact_id,
      q.lead_id as opportunity_id,
      'Sent or accepted quote version does not have a finalized ready PDF'::text as summary,
      greatest(qv.updated_at, q.updated_at) as detected_at
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    left join public.documents d on d.quote_version_id = qv.id
    where qv.status in ('sent', 'accepted')
      and (
        qv.finalized_at is null
        or d.id is null
        or d.storage_state <> 'ready'
        or d.status <> 'active'
        or d.mime_type <> 'application/pdf'
        or d.deleted_at is not null
      )

    union all

    select
      'quote-version-scope:' || qv.id::text,
      'scope_mismatch',
      'high',
      q.id,
      qv.id,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Quote version contact or opportunity does not match its quote header',
      qv.updated_at
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    where qv.contact_id is distinct from q.contact_id
      or qv.lead_id is distinct from q.lead_id

    union all

    select
      'quote-pointer-scope:' || q.id::text,
      'scope_mismatch',
      'high',
      q.id,
      coalesce(q.accepted_version_id, q.current_version_id),
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Quote header current or accepted version pointer is missing or belongs to another quote',
      q.updated_at
    from public.quotes q
    left join public.quote_versions current_version on current_version.id = q.current_version_id
    left join public.quote_versions accepted_version on accepted_version.id = q.accepted_version_id
    where (
        q.current_version_id is not null
        and (current_version.id is null or current_version.quote_id is distinct from q.id)
      )
      or (
        q.accepted_version_id is not null
        and (
          accepted_version.id is null
          or accepted_version.quote_id is distinct from q.id
          or accepted_version.status <> 'accepted'
        )
      )
      or (
        q.status = 'accepted'
        and (q.accepted_version_id is null or accepted_version.status <> 'accepted')
      )

    union all

    select
      'quote-document-scope:' || d.id::text,
      'scope_mismatch',
      'high',
      q.id,
      qv.id,
      d.id,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Canonical quote document does not match its quote version scope or PDF contract',
      d.updated_at
    from public.documents d
    join public.quote_versions qv on qv.id = d.quote_version_id
    join public.quotes q on q.id = qv.quote_id
    where d.contact_id is distinct from q.contact_id
      or d.lead_id is distinct from q.lead_id
      or d.document_type <> 'quote'
      or d.booking_id is not null
      or d.mime_type is distinct from 'application/pdf'

    union all

    select
      'quote-request-scope:' || qv.id::text || ':' || qr.id::text,
      'scope_mismatch',
      'medium',
      q.id,
      qv.id,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Quote version request provenance does not match quote contact and opportunity',
      qv.updated_at
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    join public.quote_requests qr on qr.id = qv.quote_request_id
    where qr.contact_id is distinct from q.contact_id
      or qr.lead_id is distinct from q.lead_id

    union all

    select
      'quote-request-link-scope:' || qrl.id::text,
      'scope_mismatch',
      'medium',
      q.id,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Quote request link does not match quote contact and opportunity',
      qrl.created_at
    from public.quote_request_quote_links qrl
    join public.quotes q on q.id = qrl.quote_id
    join public.quote_requests qr on qr.id = qrl.quote_request_id
    where qr.contact_id is distinct from q.contact_id
      or qr.lead_id is distinct from q.lead_id

    union all

    select
      'booking-quote-scope:' || b.id::text,
      'scope_mismatch',
      'high',
      q.id,
      qv.id,
      d.id,
      b.id,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Booking accepted quote linkage is no longer canonical',
      b.updated_at
    from public.bookings b
    join public.quote_versions qv on qv.id = b.accepted_quote_version_id
    join public.quotes q on q.id = qv.quote_id
    left join public.documents d on d.quote_version_id = qv.id
    where b.contact_id is distinct from q.contact_id
      or b.lead_id is distinct from q.lead_id
      or qv.status <> 'accepted'
      or qv.finalized_at is null
      or q.accepted_version_id is distinct from qv.id
      or d.id is null
      or d.storage_state <> 'ready'

    union all

    select
      'payment-quote-scope:' || p.id::text,
      'scope_mismatch',
      'high',
      q.id,
      qv.id,
      d.id,
      p.booking_id,
      p.id,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Payment accepted quote linkage is no longer canonical',
      p.updated_at
    from public.payments p
    join public.quote_versions qv on qv.id = p.accepted_quote_version_id
    join public.quotes q on q.id = qv.quote_id
    left join public.documents d on d.quote_version_id = qv.id
    left join public.bookings b on b.id = p.booking_id
    where p.contact_id is distinct from q.contact_id
      or p.lead_id is distinct from q.lead_id
      or qv.status <> 'accepted'
      or qv.finalized_at is null
      or q.accepted_version_id is distinct from qv.id
      or d.id is null
      or d.storage_state <> 'ready'
      or (
        b.id is not null
        and (
          p.contact_id is distinct from b.contact_id
          or p.lead_id is distinct from b.lead_id
          or (
            b.accepted_quote_version_id is not null
            and b.accepted_quote_version_id is distinct from p.accepted_quote_version_id
          )
        )
      )

    union all

    select
      'stale-upload-intent:' || qui.id::text,
      'stale_upload_intent',
      'medium',
      qui.quote_id,
      qui.quote_version_id,
      qui.document_id,
      null::uuid,
      null::uuid,
      qui.id,
      q.contact_id,
      q.lead_id,
      'Pending quote PDF upload intent has expired',
      qui.expires_at
    from public.quote_upload_intents qui
    join public.quotes q on q.id = qui.quote_id
    where qui.status = 'pending' and qui.expires_at <= now()

    union all

    select
      'registration-intent-expired:' || qri.id::text,
      'registration_intent_expired',
      'high',
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      qri.id,
      qri.contact_id,
      qri.opportunity_id,
      'Pending initial-PDF registration intent has expired and requires recovery',
      qri.expires_at
    from public.quote_registration_intents qri
    where qri.status = 'pending' and qri.expires_at <= now()

    union all

    select
      'registration-intent-failed:' || qri.id::text,
      'registration_intent_failed',
      case when qri.recovery_deadline <= now() then 'high' else 'medium' end,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      qri.id,
      qri.contact_id,
      qri.opportunity_id,
      'Failed initial-PDF registration intent remains available for bounded recovery',
      coalesce(qri.failed_at, qri.updated_at)
    from public.quote_registration_intents qri
    where qri.status = 'failed'

    union all

    select
      'registration-object-cleanup:' || qri.id::text,
      'registration_object_cleanup',
      'medium',
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      qri.id,
      qri.contact_id,
      qri.opportunity_id,
      'Failed or abandoned registration still has a reserved Storage object eligible for scoped cleanup',
      greatest(qri.updated_at, so.created_at)
    from public.quote_registration_intents qri
    join storage.objects so on so.bucket_id = qri.bucket and so.name = qri.path
    where qri.status in ('failed', 'abandoned')
  ), candidate_rows as (
    select issues.*
    from issue_rows issues
    where (p_issue_type is null or issues.issue_type = p_issue_type)
      and (p_after_issue_key is null or issues.issue_key > p_after_issue_key)
    order by issues.issue_key
    limit p_limit + 1
  ), page_rows as (
    select candidates.* from candidate_rows candidates
    order by candidates.issue_key
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  )
  select
    page.issue_key,
    page.issue_type,
    page.severity,
    page.quote_id,
    page.quote_version_id,
    page.document_id,
    page.booking_id,
    page.payment_id,
    page.intent_id,
    page.contact_id,
    page.opportunity_id,
    page.summary,
    page.detected_at,
    metadata.has_more
  from page_rows page
  cross join page_metadata metadata
  order by page.issue_key;
end;
$function$;

revoke all on function public.crm_quote_data_quality_page(integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.crm_quote_data_quality_page(integer, text, text)
  to authenticated;
