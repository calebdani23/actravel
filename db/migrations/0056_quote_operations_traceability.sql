-- Accepted quote traceability for operations, deletion safety, and data quality.

alter table public.bookings
  add column if not exists accepted_quote_version_id uuid;
alter table public.payments
  add column if not exists accepted_quote_version_id uuid;

alter table public.bookings
  drop constraint if exists bookings_accepted_quote_version_id_fkey,
  add constraint bookings_accepted_quote_version_id_fkey
    foreign key (accepted_quote_version_id)
    references public.quote_versions(id)
    on delete restrict
    not valid;
alter table public.payments
  drop constraint if exists payments_accepted_quote_version_id_fkey,
  add constraint payments_accepted_quote_version_id_fkey
    foreign key (accepted_quote_version_id)
    references public.quote_versions(id)
    on delete restrict
    not valid;

alter table public.bookings
  validate constraint bookings_accepted_quote_version_id_fkey;
alter table public.payments
  validate constraint payments_accepted_quote_version_id_fkey;

create index if not exists bookings_accepted_quote_version_idx
  on public.bookings(accepted_quote_version_id, created_at desc, id desc)
  where accepted_quote_version_id is not null;
create index if not exists payments_accepted_quote_version_idx
  on public.payments(accepted_quote_version_id, created_at desc, id desc)
  where accepted_quote_version_id is not null;

create or replace function public.crm_is_valid_accepted_quote_scope(
  p_quote_version_id uuid,
  p_contact_id uuid,
  p_lead_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.quote_versions qv
    join public.quotes q on q.id = qv.quote_id
    join public.contacts c on c.id = q.contact_id
    join public.leads l on l.id = q.lead_id
    join public.documents d on d.quote_version_id = qv.id
    where qv.id = p_quote_version_id
      and qv.status = 'accepted'
      and qv.finalized_at is not null
      and q.accepted_version_id = qv.id
      and q.status = 'accepted'
      and q.contact_id = p_contact_id
      and q.lead_id = p_lead_id
      and qv.contact_id = p_contact_id
      and qv.lead_id = p_lead_id
      and d.document_type = 'quote'
      and d.storage_state = 'ready'
      and d.status = 'active'
      and d.mime_type = 'application/pdf'
      and d.deleted_at is null
      and q.deleted_at is null
      and c.deleted_at is null
      and l.deleted_at is null
  );
$function$;

revoke all on function public.crm_is_valid_accepted_quote_scope(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.crm_enforce_booking_quote_traceability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE'
    and new.accepted_quote_version_id is not distinct from old.accepted_quote_version_id
    and new.contact_id is not distinct from old.contact_id
    and new.lead_id is not distinct from old.lead_id
  then
    return new;
  end if;

  if new.accepted_quote_version_id is not null then
    if new.contact_id is null or new.lead_id is null or not public.crm_is_valid_accepted_quote_scope(
      new.accepted_quote_version_id,
      new.contact_id,
      new.lead_id
    ) then
      raise exception 'Booking accepted quote version must be accepted, finalized, PDF-ready, and in the same contact and opportunity scope';
    end if;

    if exists (
      select 1
      from public.payments p
      where p.booking_id = new.id
        and (
          p.contact_id is distinct from new.contact_id
          or p.lead_id is distinct from new.lead_id
          or (
            p.accepted_quote_version_id is not null
            and p.accepted_quote_version_id is distinct from new.accepted_quote_version_id
          )
        )
    ) then
      raise exception 'Booking quote linkage conflicts with an attached payment scope';
    end if;

    if exists (
      select 1
      from public.documents d
      where d.booking_id = new.id
        and (
          d.contact_id is distinct from new.contact_id
          or d.lead_id is distinct from new.lead_id
        )
    ) then
      raise exception 'Booking quote linkage conflicts with an attached document scope';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.crm_enforce_payment_quote_traceability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  booking_row record;
begin
  if tg_op = 'UPDATE'
    and new.accepted_quote_version_id is not distinct from old.accepted_quote_version_id
    and new.booking_id is not distinct from old.booking_id
    and new.contact_id is not distinct from old.contact_id
    and new.lead_id is not distinct from old.lead_id
  then
    return new;
  end if;

  if new.booking_id is not null then
    select b.contact_id, b.lead_id, b.accepted_quote_version_id
    into booking_row
    from public.bookings b
    where b.id = new.booking_id;

    if booking_row.contact_id is null then
      raise exception 'Payment booking was not found';
    end if;
    if (new.accepted_quote_version_id is not null or booking_row.accepted_quote_version_id is not null)
      and (
        new.contact_id is distinct from booking_row.contact_id
        or new.lead_id is distinct from booking_row.lead_id
      )
    then
      raise exception 'Quote-linked payment must match its booking contact and opportunity';
    end if;
    if new.accepted_quote_version_id is not null
      and booking_row.accepted_quote_version_id is not null
      and new.accepted_quote_version_id is distinct from booking_row.accepted_quote_version_id
    then
      raise exception 'Payment and booking must reference the same accepted quote version';
    end if;
  end if;

  if new.accepted_quote_version_id is not null then
    if new.contact_id is null or new.lead_id is null or not public.crm_is_valid_accepted_quote_scope(
      new.accepted_quote_version_id,
      new.contact_id,
      new.lead_id
    ) then
      raise exception 'Payment accepted quote version must be accepted, finalized, PDF-ready, and in the same contact and opportunity scope';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.crm_enforce_document_booking_quote_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  booking_row record;
begin
  if new.booking_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
    and new.booking_id is not distinct from old.booking_id
    and new.contact_id is not distinct from old.contact_id
    and new.lead_id is not distinct from old.lead_id
  then
    return new;
  end if;

  select b.contact_id, b.lead_id, b.accepted_quote_version_id
  into booking_row
  from public.bookings b
  where b.id = new.booking_id;

  if booking_row.contact_id is null then
    raise exception 'Document booking was not found';
  end if;
  if booking_row.accepted_quote_version_id is not null and (
    new.quote_version_id is not null
    or new.contact_id is distinct from booking_row.contact_id
    or new.lead_id is distinct from booking_row.lead_id
  ) then
    raise exception 'Documents for quote-linked bookings must retain the booking contact and opportunity scope';
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_booking_quote_traceability()
  from public, anon, authenticated, service_role;
revoke all on function public.crm_enforce_payment_quote_traceability()
  from public, anon, authenticated, service_role;
revoke all on function public.crm_enforce_document_booking_quote_scope()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_booking_quote_traceability on public.bookings;
create trigger enforce_booking_quote_traceability
  before insert or update on public.bookings
  for each row execute function public.crm_enforce_booking_quote_traceability();
drop trigger if exists enforce_payment_quote_traceability on public.payments;
create trigger enforce_payment_quote_traceability
  before insert or update on public.payments
  for each row execute function public.crm_enforce_payment_quote_traceability();
drop trigger if exists enforce_document_booking_quote_scope on public.documents;
create trigger enforce_document_booking_quote_scope
  before insert or update on public.documents
  for each row execute function public.crm_enforce_document_booking_quote_scope();

create or replace function public.crm_protect_quote_traceability_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_name in ('quotes', 'quote_versions') then
    raise exception 'Quote headers and versions are permanent commercial history and cannot be hard-deleted';
  end if;
  if tg_table_name in ('bookings', 'payments')
    and to_jsonb(old) ->> 'accepted_quote_version_id' is not null
  then
    raise exception 'Quote-linked operation records cannot be hard-deleted';
  end if;
  if tg_table_name = 'documents' and (
    to_jsonb(old) ->> 'quote_version_id' is not null
    or exists (
      select 1 from public.bookings b
      where b.id = nullif(to_jsonb(old) ->> 'booking_id', '')::uuid
        and b.accepted_quote_version_id is not null
    )
  ) then
    raise exception 'Quote-linked operation documents cannot be hard-deleted';
  end if;
  return old;
end;
$function$;

create or replace function public.crm_protect_accepted_version_operation_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'accepted'
    and new.status is distinct from 'accepted'
    and (
      exists (
        select 1 from public.bookings b
        where b.accepted_quote_version_id = old.id
      )
      or exists (
        select 1 from public.payments p
        where p.accepted_quote_version_id = old.id
      )
    )
  then
    raise exception 'Accepted quote version with operational links cannot be superseded';
  end if;
  return new;
end;
$function$;

revoke all on function public.crm_protect_quote_traceability_delete()
  from public, anon, authenticated, service_role;
revoke all on function public.crm_protect_accepted_version_operation_links()
  from public, anon, authenticated, service_role;

drop trigger if exists protect_quote_header_hard_delete on public.quotes;
create trigger protect_quote_header_hard_delete
  before delete on public.quotes
  for each row execute function public.crm_protect_quote_traceability_delete();
drop trigger if exists protect_quote_version_hard_delete on public.quote_versions;
create trigger protect_quote_version_hard_delete
  before delete on public.quote_versions
  for each row execute function public.crm_protect_quote_traceability_delete();
drop trigger if exists protect_quote_linked_booking_hard_delete on public.bookings;
create trigger protect_quote_linked_booking_hard_delete
  before delete on public.bookings
  for each row execute function public.crm_protect_quote_traceability_delete();
drop trigger if exists protect_quote_linked_payment_hard_delete on public.payments;
create trigger protect_quote_linked_payment_hard_delete
  before delete on public.payments
  for each row execute function public.crm_protect_quote_traceability_delete();
drop trigger if exists protect_quote_linked_document_hard_delete on public.documents;
create trigger protect_quote_linked_document_hard_delete
  before delete on public.documents
  for each row execute function public.crm_protect_quote_traceability_delete();
drop trigger if exists protect_accepted_version_operation_links on public.quote_versions;
create trigger protect_accepted_version_operation_links
  before update of status on public.quote_versions
  for each row execute function public.crm_protect_accepted_version_operation_links();

-- Extend the final purge boundary instead of relying only on foreign keys. This
-- keeps the rejection explicit even if a future maintenance migration changes a
-- relationship action.
create or replace function public.crm_require_test_data_purge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.is_test_data is not true then
    raise exception 'Permanent purge is restricted to explicitly marked test data';
  end if;

  if tg_table_name = 'leads' and (
    exists (select 1 from public.quotes q where q.lead_id = old.id)
    or exists (select 1 from public.quote_versions qv where qv.lead_id = old.id)
    or exists (select 1 from public.quote_events qe where qe.lead_id = old.id)
    or exists (
      select 1 from public.quote_upload_intents qui
      join public.quotes q on q.id = qui.quote_id
      where q.lead_id = old.id
    )
    or exists (select 1 from public.quote_requests qr where qr.lead_id = old.id)
    or exists (select 1 from public.payments p where p.lead_id = old.id)
    or exists (select 1 from public.bookings b where b.lead_id = old.id)
    or exists (select 1 from public.documents d where d.lead_id = old.id)
    or exists (
      select 1 from public.bookings b
      join public.quote_versions qv on qv.id = b.accepted_quote_version_id
      where qv.lead_id = old.id
    )
    or exists (
      select 1 from public.payments p
      join public.quote_versions qv on qv.id = p.accepted_quote_version_id
      where qv.lead_id = old.id
    )
    or exists (select 1 from public.lead_notes ln where ln.lead_id = old.id and nullif(trim(ln.body), '') is not null)
    or exists (select 1 from public.lead_events le where le.lead_id = old.id and le.event_type <> 'manual_lead_created')
    or exists (select 1 from public.notification_logs nl where nl.lead_id = old.id)
    or exists (select 1 from public.whatsapp_clicks wc where wc.lead_id = old.id)
    or exists (select 1 from public.whatsapp_inbound_messages wi where wi.lead_id = old.id)
    or exists (select 1 from public.sheet_sync_logs sl where sl.lead_id = old.id)
  ) then
    raise exception 'Permanent purge requires a dependency-free test opportunity';
  end if;

  if tg_table_name = 'contacts' and (
    exists (select 1 from public.leads l where l.contact_id = old.id)
    or exists (select 1 from public.quotes q where q.contact_id = old.id)
    or exists (select 1 from public.quote_versions qv where qv.contact_id = old.id)
    or exists (select 1 from public.quote_events qe where qe.contact_id = old.id)
    or exists (
      select 1 from public.quote_upload_intents qui
      join public.quotes q on q.id = qui.quote_id
      where q.contact_id = old.id
    )
    or exists (select 1 from public.quote_requests qr where qr.contact_id = old.id)
    or exists (select 1 from public.payments p where p.contact_id = old.id)
    or exists (select 1 from public.bookings b where b.contact_id = old.id)
    or exists (select 1 from public.documents d where d.contact_id = old.id)
    or exists (
      select 1 from public.bookings b
      join public.quote_versions qv on qv.id = b.accepted_quote_version_id
      where qv.contact_id = old.id
    )
    or exists (
      select 1 from public.payments p
      join public.quote_versions qv on qv.id = p.accepted_quote_version_id
      where qv.contact_id = old.id
    )
    or exists (select 1 from public.notification_logs nl where nl.contact_id = old.id)
    or exists (select 1 from public.whatsapp_clicks wc where wc.contact_id = old.id)
    or exists (select 1 from public.whatsapp_inbound_messages wi where wi.contact_id = old.id)
  ) then
    raise exception 'Permanent purge requires a dependency-free test contact';
  end if;

  return old;
end;
$function$;

revoke all on function public.crm_require_test_data_purge()
  from public, anon, authenticated, service_role;

create or replace function public.crm_accepted_quote_handoff(p_quote_id uuid)
returns table(
  quote_id uuid,
  quote_number text,
  quote_status text,
  lock_version integer,
  accepted_quote_version_id uuid,
  accepted_version_number integer,
  accepted_title text,
  accepted_currency text,
  accepted_total_amount numeric,
  accepted_deposit_amount numeric,
  accepted_balance_amount numeric,
  accepted_valid_until date,
  accepted_at timestamptz,
  contact_id uuid,
  contact_name text,
  opportunity_id uuid,
  opportunity_label text,
  owner_id uuid,
  destination_id uuid,
  service_id uuid,
  travel_start_date date,
  travel_end_date date,
  travelers_count integer,
  document_id uuid,
  pdf_bucket text,
  pdf_path text,
  pdf_byte_size bigint,
  pdf_sha256 text,
  linked_booking_count bigint,
  latest_booking_id uuid,
  linked_payment_count bigint,
  latest_payment_id uuid,
  can_manage_booking boolean,
  can_manage_payment boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or p_quote_id is null or not public.crm_can_read_quote(p_quote_id) then
    raise insufficient_privilege using message = 'Accepted quote handoff requires authorized quote access';
  end if;

  if not exists (
    select 1
    from public.quotes q
    join public.quote_versions qv on qv.id = q.accepted_version_id
    join public.documents d on d.quote_version_id = qv.id
    join public.contacts c on c.id = q.contact_id
    join public.leads l on l.id = q.lead_id
    where q.id = p_quote_id
      and q.status = 'accepted'
      and q.deleted_at is null
      and qv.status = 'accepted'
      and qv.finalized_at is not null
      and d.storage_state = 'ready'
      and d.status = 'active'
      and d.mime_type = 'application/pdf'
      and d.deleted_at is null
      and c.deleted_at is null
      and l.deleted_at is null
  ) then
    raise exception 'Accepted quote handoff requires a live accepted version with a finalized ready PDF';
  end if;

  return query
  select
    q.id,
    q.quote_number,
    q.status,
    q.lock_version,
    qv.id,
    qv.version_number,
    qv.title,
    qv.currency,
    qv.total_amount,
    qv.deposit_amount,
    case
      when qv.total_amount is null then null
      else greatest(qv.total_amount - coalesce(qv.deposit_amount, 0), 0)
    end,
    qv.valid_until,
    qv.accepted_at,
    q.contact_id,
    nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
    q.lead_id,
    coalesce(nullif(trim(l.summary), ''), 'Oportunidad ' || left(l.id::text, 8)),
    q.owner_id,
    l.destination_id,
    l.service_id,
    l.travel_start_date,
    l.travel_end_date,
    l.travelers_count,
    d.id,
    d.bucket,
    d.path,
    d.byte_size,
    d.sha256,
    booking_rollup.linked_count,
    booking_rollup.latest_id,
    payment_rollup.linked_count,
    payment_rollup.latest_id,
    public.is_admin() or public.has_role('operaciones'),
    public.is_admin() or public.has_role('finanzas')
  from public.quotes q
  join public.quote_versions qv on qv.id = q.accepted_version_id
  join public.documents d on d.quote_version_id = qv.id
  join public.contacts c on c.id = q.contact_id
  join public.leads l on l.id = q.lead_id
  left join lateral (
    select count(*)::bigint as linked_count,
      (array_agg(b.id order by b.created_at desc, b.id desc))[1] as latest_id
    from public.bookings b
    where b.accepted_quote_version_id = qv.id
  ) booking_rollup on true
  left join lateral (
    select count(*)::bigint as linked_count,
      (array_agg(p.id order by p.created_at desc, p.id desc))[1] as latest_id
    from public.payments p
    where p.accepted_quote_version_id = qv.id
  ) payment_rollup on true
  where q.id = p_quote_id;
end;
$function$;

revoke all on function public.crm_accepted_quote_handoff(uuid)
  from public, anon, service_role;
grant execute on function public.crm_accepted_quote_handoff(uuid)
  to authenticated;

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
    'legacy_pdf_candidate'
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
      'legacy-pdf-candidate:' || legacy.id::text || ':' || qv.id::text,
      'legacy_pdf_candidate',
      'medium',
      q.id,
      qv.id,
      legacy.id,
      null::uuid,
      null::uuid,
      null::uuid,
      q.contact_id,
      q.lead_id,
      'Unlinked ready Other PDF shares the quote version contact and opportunity scope',
      legacy.updated_at
    from public.documents legacy
    join public.quote_versions qv
      on qv.contact_id = legacy.contact_id and qv.lead_id = legacy.lead_id
    join public.quotes q on q.id = qv.quote_id
    where legacy.quote_version_id is null
      and legacy.document_type = 'other'
      and legacy.status = 'active'
      and legacy.storage_state = 'ready'
      and legacy.deleted_at is null
      and legacy.bucket = 'documents'
      and lower(legacy.path) ~ '\.pdf$'
      and (legacy.mime_type is null or legacy.mime_type = 'application/pdf')
      and q.deleted_at is null
      and not exists (
        select 1 from public.documents canonical
        where canonical.quote_version_id = qv.id
      )
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
  from public, anon, service_role;
grant execute on function public.crm_quote_data_quality_page(integer, text, text)
  to authenticated;

-- No 0057 cutover is included in this phase. The embedded opportunity actions
-- still write quote_versions directly, so revoking those policies must ship in
-- the same deployment as their RPC-only UI replacement.
