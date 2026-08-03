-- Fix deterministic PL/pgSQL output-variable ambiguity in legacy PDF linking.

create or replace function public.crm_link_legacy_quote_document(
  p_document_id uuid,
  p_quote_version_id uuid,
  p_confirmation text
)
returns table(
  document_id uuid,
  quote_id uuid,
  quote_version_id uuid,
  bucket text,
  path text,
  storage_state text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  document_row record;
  version_row record;
begin
  if actor_id is null or not public.is_admin() then
    raise insufficient_privilege using message = 'Legacy quote PDF linking requires an administrator';
  end if;
  if p_confirmation is distinct from 'VINCULAR PDF LEGADO' then
    raise exception 'Escribe VINCULAR PDF LEGADO para confirmar';
  end if;

  select d.* into document_row
  from public.documents d
  where d.id = p_document_id
  for update;

  select
    qv.id,
    qv.quote_id,
    qv.contact_id,
    qv.lead_id,
    q.deleted_at as quote_deleted_at,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into version_row
  from public.quote_versions qv
  join public.quotes q on q.id = qv.quote_id
  join public.leads l on l.id = qv.lead_id
  join public.contacts c on c.id = qv.contact_id
  where qv.id = p_quote_version_id
  for update of qv, q, l, c;

  if document_row.id is null or version_row.id is null then
    raise exception 'Document or quote version was not found';
  end if;
  if version_row.quote_deleted_at is not null
    or version_row.lead_deleted_at is not null
    or version_row.contact_deleted_at is not null
  then
    raise exception 'Legacy quote PDF linking requires a live quote scope';
  end if;
  if document_row.quote_version_id is not null
    or document_row.document_type <> 'other'
    or document_row.status <> 'active'
    or document_row.storage_state <> 'ready'
    or document_row.deleted_at is not null
  then
    raise exception 'Legacy document must be an active, ready, unlinked Other document';
  end if;
  if document_row.contact_id is null
    or document_row.lead_id is null
    or document_row.contact_id is distinct from version_row.contact_id
    or document_row.lead_id is distinct from version_row.lead_id
  then
    raise exception 'Legacy document must match the quote version contact and opportunity';
  end if;
  if document_row.booking_id is not null
    or document_row.bucket <> 'documents'
    or lower(document_row.path) !~ '\.pdf$'
    or (document_row.mime_type is not null and document_row.mime_type <> 'application/pdf')
    or (document_row.byte_size is not null and (document_row.byte_size < 1 or document_row.byte_size > 20971520))
    or (document_row.sha256 is not null and document_row.sha256 !~ '^[0-9a-f]{64}$')
  then
    raise exception 'Legacy document is not PDF-compatible';
  end if;
  if exists (
    select 1 from public.documents d
    where d.quote_version_id = p_quote_version_id
      and d.id <> p_document_id
  ) then
    raise exception 'Quote version already has a canonical document';
  end if;
  perform 1
  from storage.objects so
  where so.bucket_id = document_row.bucket
    and so.name = document_row.path
  for update;
  if not found then
    raise exception 'Legacy document object was not found';
  end if;

  update public.documents as d
  set
    quote_version_id = p_quote_version_id,
    document_type = 'quote',
    mime_type = 'application/pdf',
    uploaded_at = coalesce(d.uploaded_at, d.created_at),
    quote_link_source = 'legacy_confirmed',
    quote_linked_at = now(),
    quote_linked_by = actor_id
  where d.id = p_document_id;

  insert into public.quote_events (
    quote_id,
    quote_version_id,
    contact_id,
    lead_id,
    actor_id,
    event_type,
    payload,
    idempotency_key
  ) values (
    version_row.quote_id,
    version_row.id,
    version_row.contact_id,
    version_row.lead_id,
    actor_id,
    'legacy_quote_document_linked',
    jsonb_build_object(
      'documentId', p_document_id,
      'sourceBucket', document_row.bucket,
      'objectMoved', false
    ),
    'legacy-document:' || p_document_id::text
  )
  on conflict do nothing;

  insert into public.lead_events (lead_id, actor_id, event_type, payload)
  values (
    version_row.lead_id,
    actor_id,
    'legacy_quote_document_linked',
    jsonb_build_object(
      'documentId', p_document_id,
      'quoteVersionId', p_quote_version_id,
      'objectMoved', false
    )
  );

  return query
  select d.id, version_row.quote_id, d.quote_version_id, d.bucket, d.path, d.storage_state
  from public.documents d
  where d.id = p_document_id;
end;
$function$;

revoke all on function public.crm_link_legacy_quote_document(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.crm_link_legacy_quote_document(uuid, uuid, text)
  to authenticated;
