-- Canonical quote PDF documents, upload intents, private storage, and legacy linking.

alter table public.documents
  add column if not exists quote_version_id uuid,
  add column if not exists storage_state text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists sha256 text,
  add column if not exists uploaded_at timestamptz,
  add column if not exists quote_link_source text,
  add column if not exists quote_linked_at timestamptz,
  add column if not exists quote_linked_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_reason text;

alter table public.documents disable trigger set_documents_updated_at;
update public.documents set storage_state = 'ready' where storage_state is null;
alter table public.documents enable trigger set_documents_updated_at;

alter table public.documents
  alter column storage_state set default 'ready',
  alter column storage_state set not null,
  drop constraint if exists documents_document_type_check,
  drop constraint if exists documents_storage_state_check,
  drop constraint if exists documents_quote_link_source_check,
  drop constraint if exists documents_quote_type_link_check,
  drop constraint if exists documents_quote_version_id_fkey,
  drop constraint if exists documents_quote_version_id_key;

alter table public.documents
  add constraint documents_document_type_check check (
    document_type in ('itinerary', 'voucher', 'invoice', 'identification', 'contract', 'quote', 'other')
  ) not valid,
  add constraint documents_storage_state_check check (
    storage_state in ('pending', 'ready', 'failed', 'quarantined')
  ) not valid,
  add constraint documents_quote_link_source_check check (
    quote_link_source is null or quote_link_source in ('native', 'legacy_confirmed')
  ) not valid,
  add constraint documents_quote_type_link_check check (
    (document_type = 'quote') = (quote_version_id is not null)
  ) not valid,
  add constraint documents_quote_version_id_fkey
    foreign key (quote_version_id) references public.quote_versions(id) on delete restrict not valid,
  add constraint documents_quote_version_id_key unique (quote_version_id);

alter table public.documents validate constraint documents_document_type_check;
alter table public.documents validate constraint documents_storage_state_check;
alter table public.documents validate constraint documents_quote_link_source_check;
alter table public.documents validate constraint documents_quote_type_link_check;
alter table public.documents validate constraint documents_quote_version_id_fkey;

create index if not exists documents_quote_version_ready_idx
  on public.documents(quote_version_id, storage_state)
  where quote_version_id is not null and deleted_at is null;
create index if not exists documents_quote_scope_idx
  on public.documents(contact_id, lead_id, quote_version_id)
  where quote_version_id is not null;
create index if not exists documents_deleted_at_idx
  on public.documents(deleted_at)
  where deleted_at is not null;

create or replace function public.crm_enforce_quote_document_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  version_row record;
  expected_path text;
  actor_profile_id uuid;
  finalizing_object boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.quote_version_id is not null then
      raise exception 'Canonical quote documents cannot be hard-deleted';
    end if;
    return old;
  end if;

  if new.quote_version_id is null then
    if new.document_type = 'quote'
      or new.quote_link_source is not null
      or new.quote_linked_at is not null
      or new.quote_linked_by is not null
    then
      raise exception 'Quote documents require a canonical quote version relationship';
    end if;
    return new;
  end if;

  if new.deleted_at is not null or new.deleted_by is not null or new.deleted_reason is not null then
    raise exception 'Canonical quote documents cannot be soft-deleted';
  end if;

  select
    qv.id as quote_version_id,
    qv.quote_id,
    qv.contact_id,
    qv.lead_id,
    qv.status as version_status,
    qv.finalized_at,
    q.contact_id as quote_contact_id,
    q.lead_id as quote_lead_id
  into version_row
  from public.quote_versions qv
  join public.quotes q on q.id = qv.quote_id
  where qv.id = new.quote_version_id;

  if version_row.quote_version_id is null then
    raise exception 'Quote document version was not found';
  end if;
  if new.document_type <> 'quote' then
    raise exception 'A document linked to a quote version must have quote type';
  end if;
  if new.booking_id is not null then
    raise exception 'Quote PDF documents cannot belong to a booking';
  end if;
  if new.contact_id is null
    or new.lead_id is null
    or new.contact_id is distinct from version_row.contact_id
    or new.contact_id is distinct from version_row.quote_contact_id
    or new.lead_id is distinct from version_row.lead_id
    or new.lead_id is distinct from version_row.quote_lead_id
  then
    raise exception 'Quote document must match the version and quote contact and opportunity';
  end if;

  if new.quote_link_source is null then
    new.quote_link_source := 'native';
  end if;
  select p.id into actor_profile_id from public.profiles p where p.id = auth.uid();
  new.quote_linked_at := coalesce(new.quote_linked_at, now());
  new.quote_linked_by := coalesce(new.quote_linked_by, actor_profile_id);

  if new.quote_link_source = 'native' then
    expected_path := format(
      'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
      new.contact_id,
      new.lead_id,
      version_row.quote_id,
      new.quote_version_id,
      new.id
    );
    if new.bucket <> 'quote-pdfs' or new.path <> expected_path then
      raise exception 'Native quote PDF paths are server-owned and relationship-derived';
    end if;
  elsif new.quote_link_source = 'legacy_confirmed' then
    if tg_op = 'INSERT' or new.bucket <> 'documents' then
      raise exception 'Legacy quote PDFs must retain their existing documents object';
    end if;
    if old.quote_version_id is null and (
      old.document_type <> 'other'
      or old.status <> 'active'
      or old.storage_state <> 'ready'
      or old.deleted_at is not null
      or old.bucket <> 'documents'
      or lower(old.path) !~ '\.pdf$'
    ) then
      raise exception 'Legacy quote PDF candidate is not eligible for controlled linking';
    end if;
  else
    raise exception 'Quote document link source is invalid';
  end if;

  if new.mime_type is distinct from 'application/pdf' then
    raise exception 'Quote documents must use application/pdf';
  end if;
  if new.byte_size is not null and (new.byte_size < 1 or new.byte_size > 20971520) then
    raise exception 'Quote PDF size must be between 1 byte and 20 MB';
  end if;
  if new.sha256 is not null and new.sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Quote PDF SHA-256 must be lowercase hexadecimal';
  end if;
  if new.storage_state = 'ready' then
    if new.status <> 'active' or new.uploaded_at is null then
      raise exception 'Ready quote documents require active status and an upload timestamp';
    end if;
    if new.quote_link_source = 'native' and (new.byte_size is null or new.sha256 is null) then
      raise exception 'Ready native quote PDFs require byte size and SHA-256 metadata';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.quote_version_id is not null then
    if new.id is distinct from old.id
      or new.quote_version_id is distinct from old.quote_version_id
      or new.booking_id is distinct from old.booking_id
      or new.lead_id is distinct from old.lead_id
      or new.contact_id is distinct from old.contact_id
      or new.uploaded_by is distinct from old.uploaded_by
      or new.document_type is distinct from old.document_type
      or new.title is distinct from old.title
      or new.bucket is distinct from old.bucket
      or new.path is distinct from old.path
      or new.quote_link_source is distinct from old.quote_link_source
      or new.quote_linked_at is distinct from old.quote_linked_at
      or new.quote_linked_by is distinct from old.quote_linked_by
      or new.created_at is distinct from old.created_at
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by
      or new.deleted_reason is distinct from old.deleted_reason
    then
      raise exception 'Canonical quote document identity and storage location are immutable';
    end if;

    if old.storage_state = 'ready' then
      raise exception 'Ready quote PDF artifacts are immutable';
    end if;

    finalizing_object := old.storage_state in ('pending', 'failed', 'quarantined')
      and new.storage_state = 'ready'
      and new.status = 'active'
      and new.uploaded_at is not null;

    if version_row.finalized_at is not null and not finalizing_object then
      raise exception 'Documents for finalized quote versions can only complete exact object finalization';
    end if;

    if not (
      (old.storage_state = 'pending' and new.storage_state in ('pending', 'ready', 'failed', 'quarantined'))
      or (old.storage_state = 'failed' and new.storage_state in ('pending', 'ready', 'failed', 'quarantined'))
      or (old.storage_state = 'quarantined' and new.storage_state in ('ready', 'failed', 'quarantined'))
    ) then
      raise exception 'Invalid quote document storage transition';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_document_integrity() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_document_integrity on public.documents;
create trigger enforce_quote_document_integrity
  before insert or update or delete on public.documents
  for each row execute function public.crm_enforce_quote_document_integrity();

create table if not exists public.quote_upload_intents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  quote_version_id uuid not null references public.quote_versions(id) on delete restrict,
  document_id uuid not null references public.documents(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  bucket text not null default 'quote-pdfs',
  path text not null,
  status text not null default 'pending' check (
    status in ('pending', 'uploaded', 'finalized', 'failed', 'abandoned')
  ),
  expected_mime_type text not null default 'application/pdf',
  max_size_bytes bigint not null default 20971520 check (
    max_size_bytes = 20971520
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  expires_at timestamptz not null,
  last_error_code text,
  last_error_message text,
  uploaded_at timestamptz,
  finalized_at timestamptz,
  abandoned_at timestamptz,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_upload_intents_quote_version_key unique (quote_version_id),
  constraint quote_upload_intents_document_key unique (document_id),
  constraint quote_upload_intents_bucket_path_key unique (bucket, path)
);

create unique index if not exists quote_upload_intents_version_idempotency_idx
  on public.quote_upload_intents(quote_version_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists quote_upload_intents_actor_status_expiry_idx
  on public.quote_upload_intents(actor_id, status, expires_at);
create index if not exists quote_upload_intents_quote_created_idx
  on public.quote_upload_intents(quote_id, created_at desc, id desc);

create or replace function public.crm_enforce_quote_upload_intent_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  scope_row record;
  expected_path text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote upload intents are lifecycle audit records and cannot be deleted';
  end if;

  select
    q.id as quote_id,
    q.contact_id,
    q.lead_id,
    q.deleted_at as quote_deleted_at,
    qv.id as quote_version_id,
    qv.quote_id as version_quote_id,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at,
    d.id as document_id,
    d.quote_version_id as document_version_id,
    d.bucket as document_bucket,
    d.path as document_path,
    d.storage_state
  into scope_row
  from public.quotes q
  join public.quote_versions qv on qv.id = new.quote_version_id
  join public.documents d on d.id = new.document_id
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = new.quote_id;

  if scope_row.quote_id is null
    or scope_row.version_quote_id is distinct from new.quote_id
    or scope_row.document_version_id is distinct from new.quote_version_id
  then
    raise exception 'Quote upload intent relationships must belong to one quote version';
  end if;
  if tg_op = 'INSERT' and (
    auth.uid() is null
    or new.actor_id is distinct from auth.uid()
    or scope_row.quote_deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
    or not (
      public.is_admin()
      or (
        public.has_role('asesor')
        and scope_row.assigned_to = auth.uid()
      )
    )
  ) then
    raise insufficient_privilege using message = 'Quote upload intent requires a live assigned quote scope';
  end if;
  if tg_op = 'INSERT' and scope_row.storage_state <> 'pending' then
    raise exception 'Quote upload intents require a pending canonical document';
  end if;

  expected_path := format(
    'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
    scope_row.contact_id,
    scope_row.lead_id,
    new.quote_id,
    new.quote_version_id,
    new.document_id
  );

  if new.bucket <> 'quote-pdfs'
    or new.path <> expected_path
    or scope_row.document_bucket <> new.bucket
    or scope_row.document_path <> new.path
    or new.path !~ '^contacts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/opportunities/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/quotes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/versions/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
  then
    raise exception 'Quote upload intent path must be the server-owned UUID-only path';
  end if;

  if new.expected_mime_type <> 'application/pdf' or new.max_size_bytes <> 20971520 then
    raise exception 'Quote upload intent must require PDF with the 20 MB limit';
  end if;
  if tg_op = 'INSERT' and new.status <> 'pending' then
    raise exception 'Quote upload intents must start pending';
  end if;
  if tg_op = 'INSERT' and new.expires_at <= now() then
    raise exception 'Quote upload intent expiry must be in the future';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.quote_id is distinct from old.quote_id
    or new.quote_version_id is distinct from old.quote_version_id
    or new.document_id is distinct from old.document_id
    or new.actor_id is distinct from old.actor_id
    or new.bucket is distinct from old.bucket
    or new.path is distinct from old.path
    or new.expected_mime_type is distinct from old.expected_mime_type
    or new.max_size_bytes is distinct from old.max_size_bytes
    or new.expires_at is distinct from old.expires_at
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Quote upload intent identity and scope are immutable';
  end if;
  if tg_op = 'UPDATE' and new.attempt_count < old.attempt_count then
    raise exception 'Quote upload attempt count cannot decrease';
  end if;
  if tg_op = 'UPDATE' and not (
    (old.status = 'pending' and new.status in ('pending', 'uploaded', 'failed', 'abandoned'))
    or (old.status = 'uploaded' and new.status in ('uploaded', 'finalized', 'failed', 'abandoned'))
    or (old.status = 'failed' and new.status in ('pending', 'failed', 'abandoned'))
    or (old.status = new.status and old.status in ('finalized', 'abandoned'))
  ) then
    raise exception 'Invalid quote upload intent transition';
  end if;

  if new.status = 'uploaded' then
    new.uploaded_at := coalesce(new.uploaded_at, old.uploaded_at, now());
  elsif new.status = 'finalized' then
    new.uploaded_at := coalesce(new.uploaded_at, old.uploaded_at);
    new.finalized_at := coalesce(new.finalized_at, old.finalized_at, now());
    new.abandoned_at := null;
  elsif new.status = 'abandoned' then
    new.abandoned_at := coalesce(new.abandoned_at, old.abandoned_at, now());
    new.finalized_at := null;
  else
    new.finalized_at := null;
    new.abandoned_at := null;
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_upload_intent_integrity() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_upload_intent_integrity on public.quote_upload_intents;
create trigger enforce_quote_upload_intent_integrity
  before insert or update or delete on public.quote_upload_intents
  for each row execute function public.crm_enforce_quote_upload_intent_integrity();
drop trigger if exists set_quote_upload_intents_updated_at on public.quote_upload_intents;
create trigger set_quote_upload_intents_updated_at
  before update on public.quote_upload_intents
  for each row execute function public.set_updated_at();

alter table public.quote_upload_intents enable row level security;
drop policy if exists "quote upload intents read scoped" on public.quote_upload_intents;
create policy "quote upload intents read scoped"
  on public.quote_upload_intents for select to authenticated
  using (
    public.crm_can_mutate_quote(quote_id)
    and (public.is_admin() or actor_id = auth.uid())
  );

revoke all on table public.quote_upload_intents from public, anon, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.quote_upload_intents from authenticated;
grant select on table public.quote_upload_intents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-pdfs', 'quote-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.crm_can_manage_generic_document_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_bucket = 'documents'
    and (public.is_admin() or public.has_role('operaciones'))
    and not exists (
      select 1
      from public.documents d
      where d.bucket = p_bucket
        and d.path = p_path
        and d.quote_version_id is not null
    );
$function$;

revoke all on function public.crm_can_manage_generic_document_object(text, text) from public, anon, service_role;
grant execute on function public.crm_can_manage_generic_document_object(text, text) to authenticated;

-- Generic Documents remains available for non-quote files only. Explicitly
-- linked legacy quote PDFs keep their object in this bucket but leave its broad
-- mutation surface permanently.
drop policy if exists "documents ops write" on public.documents;
drop policy if exists "documents generic insert" on public.documents;
drop policy if exists "documents generic update" on public.documents;
drop policy if exists "documents generic delete" on public.documents;

create policy "documents generic insert"
  on public.documents for insert to authenticated
  with check (
    quote_version_id is null
    and document_type <> 'quote'
    and (public.is_admin() or public.has_role('operaciones'))
  );
create policy "documents generic update"
  on public.documents for update to authenticated
  using (
    quote_version_id is null
    and (public.is_admin() or public.has_role('operaciones'))
  )
  with check (
    quote_version_id is null
    and document_type <> 'quote'
    and (public.is_admin() or public.has_role('operaciones'))
  );
create policy "documents generic delete"
  on public.documents for delete to authenticated
  using (
    quote_version_id is null
    and (public.is_admin() or public.has_role('operaciones'))
  );

drop policy if exists "documents ops read" on public.documents;
create policy "documents ops read"
  on public.documents for select to authenticated
  using (
    public.is_admin()
    or (
      quote_version_id is not null
      and exists (
        select 1 from public.quote_versions qv
        where qv.id = documents.quote_version_id
          and public.crm_can_read_quote(qv.quote_id)
      )
    )
    or (
      quote_version_id is null
      and (
        public.has_role('operaciones')
        or public.has_role('finanzas')
        or (
          public.has_role('asesor')
          and public.crm_advisor_can_access_live_opportunity(documents.lead_id)
        )
      )
    )
  );

drop policy if exists "operations manage document storage objects" on storage.objects;
drop policy if exists "operations insert generic document objects" on storage.objects;
drop policy if exists "operations update generic document objects" on storage.objects;
drop policy if exists "operations delete generic document objects" on storage.objects;
drop policy if exists "staff read private storage objects" on storage.objects;

create policy "staff read private storage objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'catalog-media'
    or (
      bucket_id = 'documents'
      and public.crm_can_manage_generic_document_object(bucket_id, name)
    )
    or (
      bucket_id = 'payment-proofs'
      and (public.is_admin() or public.has_role('finanzas'))
    )
  );

create policy "operations insert generic document objects"
  on storage.objects for insert to authenticated
  with check (
    public.crm_can_manage_generic_document_object(bucket_id, name)
  );
create policy "operations update generic document objects"
  on storage.objects for update to authenticated
  using (
    public.crm_can_manage_generic_document_object(bucket_id, name)
  )
  with check (
    public.crm_can_manage_generic_document_object(bucket_id, name)
  );
create policy "operations delete generic document objects"
  on storage.objects for delete to authenticated
  using (
    public.crm_can_manage_generic_document_object(bucket_id, name)
  );

drop policy if exists "quote pdf intent upload" on storage.objects;
create policy "quote pdf intent upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quote-pdfs'
    and lower(storage.extension(name)) = 'pdf'
    and exists (
      select 1
      from public.quote_upload_intents qui
      join public.documents d on d.id = qui.document_id
      join public.quote_versions qv on qv.id = qui.quote_version_id
      join public.quotes q on q.id = qui.quote_id
      join public.leads l on l.id = q.lead_id
      join public.contacts c on c.id = q.contact_id
      where qui.bucket = storage.objects.bucket_id
        and qui.path = storage.objects.name
        and qui.actor_id = auth.uid()
        and qui.status = 'pending'
        and qui.expires_at > now()
        and d.quote_version_id = qui.quote_version_id
        and d.storage_state = 'pending'
        and d.deleted_at is null
        and qv.quote_id = q.id
        and q.deleted_at is null
        and l.deleted_at is null
        and c.deleted_at is null
        and (
          public.is_admin()
          or (
            public.has_role('asesor')
            and l.assigned_to = auth.uid()
          )
        )
    )
  );

drop policy if exists "quote pdf scoped read" on storage.objects;
create policy "quote pdf scoped read"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('quote-pdfs', 'documents')
    and exists (
      select 1
      from public.documents d
      join public.quote_versions qv on qv.id = d.quote_version_id
      join public.quotes q on q.id = qv.quote_id
      join public.leads l on l.id = q.lead_id
      join public.contacts c on c.id = q.contact_id
      where d.bucket = storage.objects.bucket_id
        and d.path = storage.objects.name
        and d.document_type = 'quote'
        and d.storage_state = 'ready'
        and d.deleted_at is null
        and q.deleted_at is null
        and l.deleted_at is null
        and c.deleted_at is null
        and public.crm_can_read_quote(q.id)
    )
  );

drop policy if exists "quote pdf pending delete" on storage.objects;
create policy "quote pdf pending delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quote-pdfs'
    and exists (
      select 1
      from public.quote_upload_intents qui
      join public.documents d on d.id = qui.document_id
      join public.quote_versions qv on qv.id = qui.quote_version_id
      join public.quotes q on q.id = qui.quote_id
      join public.leads l on l.id = q.lead_id
      join public.contacts c on c.id = q.contact_id
      where qui.bucket = storage.objects.bucket_id
        and qui.path = storage.objects.name
        and qui.status = 'failed'
        and d.storage_state = 'failed'
        and d.deleted_at is null
        and qv.finalized_at is null
        and qv.status = 'draft'
        and q.deleted_at is null
        and l.deleted_at is null
        and c.deleted_at is null
        and public.crm_can_mutate_quote(q.id)
        and (public.is_admin() or qui.actor_id = auth.uid())
    )
  );

-- No UPDATE policy is created for quote-pdfs, and DELETE requires a durably
-- failed intent, so an uploaded object cannot be replaced before finalization.

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

revoke all on function public.crm_link_legacy_quote_document(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.crm_link_legacy_quote_document(uuid, uuid, text) to authenticated;

-- PostgreSQL cannot change a RETURNS TABLE shape through CREATE OR REPLACE.
-- Input signatures remain stable while the normalized rows gain PDF metadata.
drop function if exists public.crm_quote_page(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean);

create function public.crm_quote_page(
  p_limit integer default 50,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_owner_id uuid default null,
  p_contact_id uuid default null,
  p_opportunity_id uuid default null,
  p_currency text default null,
  p_validity text default 'all',
  p_include_deleted boolean default false
)
returns table(
  quote_id uuid,
  quote_number text,
  title text,
  status text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  opportunity_id uuid,
  opportunity_label text,
  owner_id uuid,
  advisor_name text,
  current_version_id uuid,
  current_version_number integer,
  current_version_title text,
  current_version_status text,
  current_currency text,
  current_total_amount numeric,
  current_deposit_amount numeric,
  current_valid_until date,
  current_finalized_at timestamptz,
  current_updated_at timestamptz,
  current_document_id uuid,
  current_pdf_state text,
  current_pdf_mime_type text,
  current_pdf_byte_size bigint,
  current_pdf_sha256 text,
  current_pdf_uploaded_at timestamptz,
  accepted_version_id uuid,
  accepted_version_number integer,
  accepted_version_title text,
  accepted_version_status text,
  accepted_currency text,
  accepted_total_amount numeric,
  accepted_deposit_amount numeric,
  accepted_valid_until date,
  accepted_accepted_at timestamptz,
  accepted_document_id uuid,
  accepted_pdf_state text,
  accepted_pdf_mime_type text,
  accepted_pdf_byte_size bigint,
  accepted_pdf_sha256 text,
  accepted_pdf_uploaded_at timestamptz,
  version_count bigint,
  request_count bigint,
  next_version_number integer,
  lock_version integer,
  ready_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_updated_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;
  if p_status is not null and p_status not in ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled') then
    raise invalid_parameter_value using message = 'invalid quote status filter';
  end if;
  if p_currency is not null and p_currency not in ('MXN', 'USD') then
    raise invalid_parameter_value using message = 'currency must be MXN or USD';
  end if;
  if p_validity is null or p_validity not in ('all', 'valid', 'expired', 'no_expiry') then
    raise invalid_parameter_value using message = 'validity must be all, valid, expired, or no_expiry';
  end if;

  return query
  with candidate_rows as (
    select q.*
    from public.quotes q
    join public.contacts c on c.id = q.contact_id
    join public.leads l on l.id = q.lead_id
    left join public.quote_versions cv on cv.id = q.current_version_id
    where (p_include_deleted or q.deleted_at is null)
      and (p_status is null or q.status = p_status)
      and (p_owner_id is null or q.owner_id = p_owner_id)
      and (p_contact_id is null or q.contact_id = p_contact_id)
      and (p_opportunity_id is null or q.lead_id = p_opportunity_id)
      and (p_currency is null or cv.currency = p_currency)
      and (
        p_validity = 'all'
        or (p_validity = 'valid' and cv.valid_until >= current_date)
        or (p_validity = 'expired' and cv.valid_until < current_date)
        or (p_validity = 'no_expiry' and cv.valid_until is null)
      )
      and (
        nullif(trim(p_search), '') is null
        or q.quote_number ilike '%' || trim(p_search) || '%'
        or q.title ilike '%' || trim(p_search) || '%'
        or concat_ws(' ', c.first_name, c.last_name, c.email, c.phone) ilike '%' || trim(p_search) || '%'
        or coalesce(l.summary, '') ilike '%' || trim(p_search) || '%'
        or coalesce(public.crm_quote_profile_label(q.id, q.owner_id), '') ilike '%' || trim(p_search) || '%'
      )
      and (
        p_after_updated_at is null
        or q.updated_at < p_after_updated_at
        or (q.updated_at = p_after_updated_at and q.id < p_after_id)
      )
    order by q.updated_at desc, q.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.updated_at desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  ), version_rollup as (
    select qv.quote_id, count(*)::bigint as version_count
    from public.quote_versions qv
    join page_rows pr on pr.id = qv.quote_id
    group by qv.quote_id
  ), request_rollup as (
    select qrl.quote_id, count(*)::bigint as request_count
    from public.quote_request_quote_links qrl
    join page_rows pr on pr.id = qrl.quote_id
    group by qrl.quote_id
  )
  select
    pr.id,
    pr.quote_number,
    pr.title,
    pr.status,
    pr.contact_id,
    nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
    c.email,
    c.phone,
    pr.lead_id,
    coalesce(
      nullif(trim(l.summary), ''),
      nullif(concat_ws(' / ', destination.name_es, service.name_es), ''),
      'Oportunidad ' || left(l.id::text, 8)
    ),
    pr.owner_id,
    public.crm_quote_profile_label(pr.id, pr.owner_id),
    cv.id,
    cv.version_number,
    cv.title,
    cv.status,
    cv.currency,
    cv.total_amount,
    cv.deposit_amount,
    cv.valid_until,
    cv.finalized_at,
    cv.updated_at,
    current_document.id,
    current_document.storage_state,
    current_document.mime_type,
    current_document.byte_size,
    current_document.sha256,
    current_document.uploaded_at,
    av.id,
    av.version_number,
    av.title,
    av.status,
    av.currency,
    av.total_amount,
    av.deposit_amount,
    av.valid_until,
    av.accepted_at,
    accepted_document.id,
    accepted_document.storage_state,
    accepted_document.mime_type,
    accepted_document.byte_size,
    accepted_document.sha256,
    accepted_document.uploaded_at,
    coalesce(vr.version_count, 0),
    coalesce(rr.request_count, 0),
    pr.next_version_number,
    pr.lock_version,
    pr.ready_at,
    pr.sent_at,
    pr.accepted_at,
    pr.rejected_at,
    pr.expired_at,
    pr.cancelled_at,
    pr.created_at,
    pr.updated_at,
    pr.deleted_at,
    pr.deleted_by,
    pr.deleted_reason,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  join public.contacts c on c.id = pr.contact_id
  join public.leads l on l.id = pr.lead_id
  left join public.destinations destination on destination.id = l.destination_id
  left join public.services service on service.id = l.service_id
  left join public.quote_versions cv on cv.id = pr.current_version_id
  left join public.documents current_document
    on current_document.quote_version_id = cv.id and current_document.deleted_at is null
  left join public.quote_versions av on av.id = pr.accepted_version_id
  left join public.documents accepted_document
    on accepted_document.quote_version_id = av.id and accepted_document.deleted_at is null
  left join version_rollup vr on vr.quote_id = pr.id
  left join request_rollup rr on rr.quote_id = pr.id
  order by pr.updated_at desc, pr.id desc;
end;
$function$;

drop function if exists public.crm_quote_detail(uuid);

create function public.crm_quote_detail(p_quote_id uuid)
returns table(
  quote_id uuid,
  quote_number text,
  title text,
  status text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  opportunity_id uuid,
  opportunity_label text,
  owner_id uuid,
  advisor_name text,
  created_by uuid,
  created_by_name text,
  current_version_id uuid,
  current_version_number integer,
  current_version_title text,
  current_version_status text,
  current_currency text,
  current_total_amount numeric,
  current_deposit_amount numeric,
  current_valid_until date,
  current_finalized_at timestamptz,
  current_document_id uuid,
  current_pdf_state text,
  current_pdf_bucket text,
  current_pdf_path text,
  current_pdf_mime_type text,
  current_pdf_byte_size bigint,
  current_pdf_sha256 text,
  current_pdf_uploaded_at timestamptz,
  accepted_version_id uuid,
  accepted_version_number integer,
  accepted_version_title text,
  accepted_version_status text,
  accepted_currency text,
  accepted_total_amount numeric,
  accepted_deposit_amount numeric,
  accepted_valid_until date,
  accepted_accepted_at timestamptz,
  accepted_document_id uuid,
  accepted_pdf_state text,
  accepted_pdf_bucket text,
  accepted_pdf_path text,
  accepted_pdf_mime_type text,
  accepted_pdf_byte_size bigint,
  accepted_pdf_sha256 text,
  accepted_pdf_uploaded_at timestamptz,
  version_count bigint,
  request_count bigint,
  event_count bigint,
  originating_request_id uuid,
  originating_request_status text,
  latest_event_type text,
  latest_event_at timestamptz,
  next_version_number integer,
  lock_version integer,
  ready_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  deleted_reason text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    q.id,
    q.quote_number,
    q.title,
    q.status,
    q.contact_id,
    nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
    c.email,
    c.phone,
    q.lead_id,
    coalesce(
      nullif(trim(l.summary), ''),
      nullif(concat_ws(' / ', destination.name_es, service.name_es), ''),
      'Oportunidad ' || left(l.id::text, 8)
    ),
    q.owner_id,
    public.crm_quote_profile_label(q.id, q.owner_id),
    q.created_by,
    public.crm_quote_profile_label(q.id, q.created_by),
    cv.id,
    cv.version_number,
    cv.title,
    cv.status,
    cv.currency,
    cv.total_amount,
    cv.deposit_amount,
    cv.valid_until,
    cv.finalized_at,
    current_document.id,
    current_document.storage_state,
    current_document.bucket,
    current_document.path,
    current_document.mime_type,
    current_document.byte_size,
    current_document.sha256,
    current_document.uploaded_at,
    av.id,
    av.version_number,
    av.title,
    av.status,
    av.currency,
    av.total_amount,
    av.deposit_amount,
    av.valid_until,
    av.accepted_at,
    accepted_document.id,
    accepted_document.storage_state,
    accepted_document.bucket,
    accepted_document.path,
    accepted_document.mime_type,
    accepted_document.byte_size,
    accepted_document.sha256,
    accepted_document.uploaded_at,
    coalesce(vc.version_count, 0),
    coalesce(rc.request_count, 0),
    coalesce(ec.event_count, 0),
    origin_link.quote_request_id,
    origin_link.request_status,
    latest_event.event_type,
    latest_event.created_at,
    q.next_version_number,
    q.lock_version,
    q.ready_at,
    q.sent_at,
    q.accepted_at,
    q.rejected_at,
    q.expired_at,
    q.cancelled_at,
    q.created_at,
    q.updated_at,
    q.deleted_at,
    q.deleted_by,
    public.crm_quote_profile_label(q.id, q.deleted_by),
    q.deleted_reason
  from public.quotes q
  join public.contacts c on c.id = q.contact_id
  join public.leads l on l.id = q.lead_id
  left join public.destinations destination on destination.id = l.destination_id
  left join public.services service on service.id = l.service_id
  left join public.quote_versions cv on cv.id = q.current_version_id
  left join public.documents current_document
    on current_document.quote_version_id = cv.id and current_document.deleted_at is null
  left join public.quote_versions av on av.id = q.accepted_version_id
  left join public.documents accepted_document
    on accepted_document.quote_version_id = av.id and accepted_document.deleted_at is null
  left join lateral (
    select count(*)::bigint as version_count
    from public.quote_versions qv where qv.quote_id = q.id
  ) vc on true
  left join lateral (
    select count(*)::bigint as request_count
    from public.quote_request_quote_links qrl where qrl.quote_id = q.id
  ) rc on true
  left join lateral (
    select count(*)::bigint as event_count
    from public.quote_events qe where qe.quote_id = q.id
  ) ec on true
  left join lateral (
    select qrl.quote_request_id, qr.status as request_status
    from public.quote_request_quote_links qrl
    join public.quote_requests qr on qr.id = qrl.quote_request_id
    where qrl.quote_id = q.id and qrl.relation = 'originating'
    order by qrl.created_at, qrl.id
    limit 1
  ) origin_link on true
  left join lateral (
    select qe.event_type, qe.created_at
    from public.quote_events qe
    where qe.quote_id = q.id
    order by qe.created_at desc, qe.id desc
    limit 1
  ) latest_event on true
  where q.id = p_quote_id;
$function$;

drop function if exists public.crm_quote_version_page(uuid, integer, integer, uuid);

create function public.crm_quote_version_page(
  p_quote_id uuid,
  p_limit integer default 20,
  p_after_version_number integer default null,
  p_after_id uuid default null
)
returns table(
  quote_version_id uuid,
  quote_id uuid,
  version_number integer,
  title text,
  summary text,
  status text,
  currency text,
  total_amount numeric,
  deposit_amount numeric,
  valid_until date,
  notes text,
  quote_request_id uuid,
  finalized_at timestamptz,
  finalized_by uuid,
  finalized_by_name text,
  content_sha256 text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  created_by uuid,
  created_by_name text,
  document_id uuid,
  pdf_state text,
  pdf_bucket text,
  pdf_path text,
  pdf_mime_type text,
  pdf_byte_size bigint,
  pdf_sha256 text,
  pdf_uploaded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_quote_id is null then
    raise invalid_parameter_value using message = 'p_quote_id is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_version_number is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select qv.*
    from public.quote_versions qv
    where qv.quote_id = p_quote_id
      and (
        p_after_version_number is null
        or qv.version_number < p_after_version_number
        or (qv.version_number = p_after_version_number and qv.id < p_after_id)
      )
    order by qv.version_number desc, qv.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.version_number desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  )
  select
    pr.id,
    pr.quote_id,
    pr.version_number,
    pr.title,
    pr.summary,
    pr.status,
    pr.currency,
    pr.total_amount,
    pr.deposit_amount,
    pr.valid_until,
    pr.notes,
    pr.quote_request_id,
    pr.finalized_at,
    pr.finalized_by,
    public.crm_quote_profile_label(pr.quote_id, pr.finalized_by),
    pr.content_sha256,
    pr.sent_at,
    pr.accepted_at,
    pr.rejected_at,
    pr.expired_at,
    pr.created_by,
    public.crm_quote_profile_label(pr.quote_id, pr.created_by),
    document.id,
    document.storage_state,
    document.bucket,
    document.path,
    document.mime_type,
    document.byte_size,
    document.sha256,
    document.uploaded_at,
    pr.created_at,
    pr.updated_at,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  left join public.documents document
    on document.quote_version_id = pr.id and document.deleted_at is null
  order by pr.version_number desc, pr.id desc;
end;
$function$;

revoke all on function public.crm_quote_page(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean) from public, anon, service_role;
revoke all on function public.crm_quote_detail(uuid) from public, anon, service_role;
revoke all on function public.crm_quote_version_page(uuid, integer, integer, uuid) from public, anon, service_role;
grant execute on function public.crm_quote_page(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.crm_quote_detail(uuid) to authenticated;
grant execute on function public.crm_quote_version_page(uuid, integer, integer, uuid) to authenticated;
