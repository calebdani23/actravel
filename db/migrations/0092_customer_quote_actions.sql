begin;

-- Deferred integrity checks must see protected origin rows at transaction end,
-- including when an authorized customer action cancels an existing native Task.
-- Keep their bodies unchanged and their callable surface private.
alter function public.validate_task_automation_task_parity() security definer;
alter function public.validate_task_automation_task_parity() set search_path='';
alter function public.validate_task_automation_task_parity() owner to postgres;
alter function public.validate_task_automation_origin_parity() security definer;
alter function public.validate_task_automation_origin_parity() set search_path='';
alter function public.validate_task_automation_origin_parity() owner to postgres;
revoke all on function public.validate_task_automation_task_parity(),public.validate_task_automation_origin_parity()
  from public,anon,authenticated,service_role;

create unique index customer_accounts_portal_scope on public.customer_accounts(user_id,contact_id);
create unique index quote_versions_portal_scope on public.quote_versions(id,quote_id,contact_id,lead_id);
create unique index documents_portal_version_scope on public.documents(id,quote_version_id);
create table public.quote_acceptances (
  id uuid primary key default gen_random_uuid(), request_id uuid not null,
  customer_id uuid not null, contact_id uuid not null, quote_id uuid not null, quote_version_id uuid not null unique, lead_id uuid not null,
  terms_id uuid not null references public.portal_quote_terms(id) on delete restrict,
  terms_revision text not null, terms_body text not null, terms_sha256 text not null,
  document_id uuid not null, document_sha256 text not null check(document_sha256 ~ '^[a-f0-9]{64}$'),
  version_sha256 text not null check(version_sha256 ~ '^[a-f0-9]{64}$'),
  currency text not null check(currency in ('MXN','USD')), total_amount numeric(12,2) not null check(total_amount>=0),
  deposit_amount numeric(12,2), valid_until date, expected_lock_version integer not null check(expected_lock_version>=0),
  accepted_at timestamptz not null check(isfinite(accepted_at)), source text not null check(source='customer_portal.v1'),
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  unique(customer_id,request_id),
  foreign key(customer_id,contact_id) references public.customer_accounts(user_id,contact_id) on delete restrict,
  foreign key(quote_version_id,quote_id,contact_id,lead_id) references public.quote_versions(id,quote_id,contact_id,lead_id) on delete restrict,
  foreign key(document_id,quote_version_id) references public.documents(id,quote_version_id) on delete restrict,
  check(terms_sha256=encode(extensions.digest(terms_body,'sha256'),'hex')),
  check(valid_until is null or (isfinite(valid_until) and (accepted_at at time zone 'UTC')::date<=valid_until))
);
create table public.customer_requests (
  id uuid primary key default gen_random_uuid(), request_id uuid not null, customer_id uuid not null, contact_id uuid not null,
  quote_id uuid not null, quote_version_id uuid not null, lead_id uuid not null,
  body text not null check(char_length(body) between 1 and 2000 and octet_length(body)<=8000),
  expected_lock_version integer not null check(expected_lock_version>=0),
  request_fingerprint text not null check(request_fingerprint ~ '^[a-f0-9]{64}$'),
  response_event_id uuid not null unique references public.quote_events(id) deferrable initially deferred,
  created_at timestamptz not null default clock_timestamp(), unique(customer_id,request_id),
  foreign key(customer_id,contact_id) references public.customer_accounts(user_id,contact_id) on delete restrict,
  foreign key(quote_version_id,quote_id,contact_id,lead_id) references public.quote_versions(id,quote_id,contact_id,lead_id) on delete restrict
);
create index customer_requests_recent on public.customer_requests(customer_id,created_at desc);
create table public.portal_quote_work (
  event_id uuid primary key references public.quote_events(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  kind text not null check(kind in ('acceptance_handoff','quote_change')),
  event_at timestamptz not null check(isfinite(event_at)), due_at timestamptz not null check(isfinite(due_at)),
  task_id uuid unique references public.tasks(id) on delete restrict,
  claimed_by uuid, claimed_at timestamptz,
  check(due_at=event_at+interval '24 hours'), check((claimed_by is null)=(claimed_at is null))
);
create index portal_quote_work_recent on public.portal_quote_work(event_at desc,event_id desc);
create function public.portal_customer_evidence_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'PORTAL_CUSTOMER_EVIDENCE_IMMUTABLE'; end $$;
create trigger quote_acceptances_immutable before update or delete on public.quote_acceptances for each row execute function public.portal_customer_evidence_immutable();
create trigger customer_requests_immutable before update or delete on public.customer_requests for each row execute function public.portal_customer_evidence_immutable();
create function public.portal_work_immutable() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'PORTAL_WORK_IMMUTABLE'; end if;
  if to_jsonb(new)-array['task_id','claimed_by','claimed_at'] is distinct from to_jsonb(old)-array['task_id','claimed_by','claimed_at']
    or old.task_id is not null then raise exception 'PORTAL_WORK_IMMUTABLE'; end if;
  return new;
end $$;
create trigger portal_work_immutable before update or delete on public.portal_quote_work for each row execute function public.portal_work_immutable();
alter table public.quote_acceptances enable row level security; alter table public.quote_acceptances force row level security;
alter table public.customer_requests enable row level security; alter table public.customer_requests force row level security;
alter table public.portal_quote_work enable row level security; alter table public.portal_quote_work force row level security;
revoke all on public.quote_acceptances,public.customer_requests,public.portal_quote_work from public,anon,authenticated,service_role;
grant select on public.quote_acceptances,public.customer_requests,public.portal_quote_work to authenticated;
create policy portal_acceptances_admin on public.quote_acceptances for select to authenticated using(public.is_admin());
create policy portal_requests_admin on public.customer_requests for select to authenticated using(public.is_admin());
create policy portal_work_admin on public.portal_quote_work for select to authenticated using(public.is_admin());

create function public.portal_lock_customer_quote(p_quote_id uuid) returns public.quotes
language plpgsql volatile security definer set search_path='' as $$
declare q public.quotes;
begin
  if not public.portal_customer_owns_quote(p_quote_id) then return null; end if;
  -- Same universe identity as 0085, before identity/context row locks.
  perform pg_advisory_xact_lock_shared(3825938359965795805);
  perform 1 from auth.users where id=auth.uid() for share;
  perform 1 from public.customer_accounts where user_id=auth.uid() for share;
  select * into q from public.quotes where id=p_quote_id;
  perform 1 from public.contacts where id=q.contact_id for update;
  perform 1 from public.leads where id=q.lead_id for update;
  perform 1 from public.quotes value where value.lead_id=q.lead_id order by value.id for update;
  perform 1 from public.quote_versions value where value.lead_id=q.lead_id order by value.quote_id,value.version_number,value.id for update;
  perform 1 from public.documents d join public.quote_versions v on v.id=d.quote_version_id
    where v.lead_id=q.lead_id order by d.id for update of d;
  perform 1 from public.quote_upload_intents i where i.quote_id in(select id from public.quotes where lead_id=q.lead_id) order by i.quote_id,i.id for update;
  if not public.portal_customer_owns_quote(p_quote_id) then return null; end if;
  select * into q from public.quotes where id=p_quote_id;
  return q;
end $$;

create function public.portal_create_work_task(p_work public.portal_quote_work,p_owner uuid) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare task_row public.tasks; task_key text; description_value text;
begin
  perform 1 from public.profiles where id=p_owner and is_active for share;
  if not found then return null; end if;
  task_key:=encode(extensions.digest('portal-quote-work:v1:'||p_work.event_id::text,'sha256'),'hex');
  description_value:=case p_work.kind when 'acceptance_handoff' then 'Prepare handoff for accepted quote' else 'Review customer quote change request' end;
  insert into public.tasks(owner_id,quote_id,description,due_at,idempotency_key,task_kind)
    values(p_owner,p_work.quote_id,description_value,p_work.due_at,task_key,'manual')
    on conflict(owner_id,idempotency_key) do nothing returning * into task_row;
  if task_row.id is null then select * into task_row from public.tasks where owner_id=p_owner and idempotency_key=task_key; end if;
  if task_row.quote_id is distinct from p_work.quote_id or task_row.task_kind<>'manual' or task_row.description<>description_value or task_row.due_at<>p_work.due_at then
    raise exception 'PORTAL_TASK_INTEGRITY';
  end if;
  return task_row.id;
end $$;

create function public.portal_enqueue_quote_work() returns trigger language plpgsql security definer set search_path='' as $$
declare work public.portal_quote_work; owner uuid; event_time timestamptz; work_kind text;
begin
  if new.event_type='quote_accepted' then
    if not exists(select 1 from public.quotes q join public.quote_versions v on v.id=new.quote_version_id where q.id=new.quote_id and q.accepted_version_id=v.id and v.status='accepted') then return new; end if;
    work_kind:='acceptance_handoff';
    select accepted_at into event_time from public.quote_acceptances where id::text=new.payload->>'customerAcceptanceId' and quote_version_id=new.quote_version_id;
  elsif new.event_type='quote_version_response' and new.actor_id is null and exists(select 1 from public.customer_requests where response_event_id=new.id) then
    work_kind:='quote_change';
  else return new;
  end if;
  event_time:=coalesce(event_time,new.created_at);
  work.event_id:=new.id; work.quote_id:=new.quote_id; work.kind:=work_kind; work.event_at:=event_time; work.due_at:=event_time+interval '24 hours';
  select p.id into owner from public.quotes q join public.leads l on l.id=q.lead_id join public.profiles p on p.id=l.assigned_to and p.is_active
    where q.id=new.quote_id and exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=p.id and r.name='asesor') for share of p;
  perform 1 from public.profile_roles where profile_id=owner for share;
  if not exists(select 1 from public.profile_roles pr join public.roles r on r.id=pr.role_id where pr.profile_id=owner and r.name='asesor') then owner:=null; end if;
  if owner is not null then work.task_id:=public.portal_create_work_task(work,owner); end if;
  insert into public.portal_quote_work(event_id,quote_id,kind,event_at,due_at,task_id)
    values(work.event_id,work.quote_id,work.kind,work.event_at,work.due_at,work.task_id);
  return new;
end $$;
create trigger portal_enqueue_quote_work after insert on public.quote_events for each row execute function public.portal_enqueue_quote_work();

-- Preserve the staff response validator unchanged. Null-actor responses require
-- a real immutable customer-request link, never a fabricated staff profile.
drop trigger cancel_quote_follow_up_on_response on public.quote_events;
create trigger cancel_quote_follow_up_on_response after insert on public.quote_events for each row
  when(new.actor_id is not null) execute function public.task_automation_cancel_quote_response();
create function public.portal_cancel_customer_quote_follow_up() returns trigger language plpgsql security definer set search_path='' as $$
declare source_key text;
begin
  if not exists(select 1 from public.customer_requests r where r.response_event_id=new.id and r.quote_id=new.quote_id
    and r.quote_version_id=new.quote_version_id and r.contact_id=new.contact_id and r.lead_id=new.lead_id)
    or new.idempotency_key is distinct from 'quote-version-response:'||new.id::text
    or new.payload is distinct from jsonb_build_object('schema','quote-version-response.v1','requestId',new.id,'quoteId',new.quote_id,'quoteVersionId',new.quote_version_id,'channel','portal','actorId',null) then
    raise exception 'TASK_QUOTE_RESPONSE_INVALID_PAYLOAD';
  end if;
  source_key:=encode(extensions.digest(convert_to(public.follow_up_canonical_json(jsonb_build_array('task-automation-source.v1','quote_version_response',new.quote_version_id::text,new.id::text)),'UTF8'),'sha256'),'hex');
  perform public.task_automation_cancel_quote_follow_up('quote_version_response',new.id,source_key,new.quote_version_id);
  return new;
end $$;
create trigger cancel_quote_follow_up_on_customer_response after insert on public.quote_events for each row
  when(new.event_type='quote_version_response' and new.actor_id is null) execute function public.portal_cancel_customer_quote_follow_up();

create function public.accept_customer_quote(p_request_id uuid,p_quote_id uuid,p_version_id uuid,p_expected_lock integer,
  p_terms_id uuid,p_terms_hash text,p_document_hash text,p_consent boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes; v public.quote_versions; d public.documents; terms public.portal_quote_terms; receipt public.quote_acceptances; fingerprint text; accepted_time timestamptz;
begin
  if not public.customer_account_is_active() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if p_request_id is null or p_quote_id is null or p_version_id is null or p_expected_lock is null or p_expected_lock<0
    or p_terms_id is null or p_consent is distinct from true or p_terms_hash is null or p_terms_hash !~ '^[a-f0-9]{64}$'
    or p_document_hash is null or p_document_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  perform pg_advisory_xact_lock(hashtextextended('portal-accept:v1:'||auth.uid()::text||':'||p_request_id::text,0));
  q:=public.portal_lock_customer_quote(p_quote_id);
  if q.id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  fingerprint:=encode(extensions.digest(jsonb_build_array(auth.uid(),p_quote_id,p_version_id,p_expected_lock,p_terms_id,p_terms_hash,p_document_hash,true)::text,'sha256'),'hex');
  select * into receipt from public.quote_acceptances where customer_id=auth.uid() and request_id=p_request_id;
  if receipt.id is not null then
    if receipt.request_fingerprint<>fingerprint then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
    return jsonb_build_object('ok',true,'acceptanceId',receipt.id,'acceptedAt',to_char(receipt.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
  end if;
  select * into v from public.quote_versions where id=p_version_id and quote_id=q.id;
  if v.id is null or q.current_version_id is distinct from v.id or v.status<>'sent' or v.finalized_at is null
    or v.content_sha256 is null or v.total_amount is null or v.total_amount::text in ('NaN','Infinity','-Infinity')
    or (v.deposit_amount is not null and v.deposit_amount::text in ('NaN','Infinity','-Infinity'))
    or (v.valid_until is not null and (not isfinite(v.valid_until) or v.valid_until<(clock_timestamp() at time zone 'UTC')::date))
    or exists(select 1 from public.leads l join public.lead_statuses s on s.id=l.status_id where l.id=q.lead_id and (l.archived_at is not null or s.is_terminal)) then
    return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  if q.lock_version<>p_expected_lock then return jsonb_build_object('ok',false,'code','STALE_QUOTE'); end if;
  if q.accepted_version_id is not null or exists(select 1 from public.quotes other where other.lead_id=q.lead_id and other.status='accepted') then
    return jsonb_build_object('ok',false,'code','ACCEPTED_PROPOSAL_EXISTS'); end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('portal-quote-terms:v1',0));
  select * into terms from public.portal_quote_terms where is_active;
  if terms.id is null then return jsonb_build_object('ok',false,'code','TERMS_REQUIRED'); end if;
  if terms.id<>p_terms_id or terms.sha256<>p_terms_hash then return jsonb_build_object('ok',false,'code','TERMS_CHANGED'); end if;
  select * into d from public.documents where quote_version_id=v.id and contact_id=q.contact_id and lead_id=q.lead_id
    and document_type='quote' and storage_state='ready' and status='active' and deleted_at is null and mime_type='application/pdf'
    and byte_size between 1 and 20971520 and sha256=p_document_hash;
  if d.id is null then return jsonb_build_object('ok',false,'code','STALE_QUOTE'); end if;
  accepted_time:=date_trunc('microseconds',clock_timestamp());
  if v.valid_until is not null and v.valid_until<(accepted_time at time zone 'UTC')::date then
    return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  insert into public.quote_acceptances(request_id,customer_id,contact_id,quote_id,quote_version_id,lead_id,terms_id,terms_revision,terms_body,terms_sha256,
    document_id,document_sha256,version_sha256,currency,total_amount,deposit_amount,valid_until,expected_lock_version,accepted_at,source,request_fingerprint)
    values(p_request_id,auth.uid(),q.contact_id,q.id,v.id,q.lead_id,terms.id,terms.revision,terms.body,terms.sha256,d.id,d.sha256,v.content_sha256,
      v.currency,v.total_amount,v.deposit_amount,v.valid_until,p_expected_lock,accepted_time,'customer_portal.v1',fingerprint) returning * into receipt;
  update public.quote_versions set status='accepted',accepted_at=accepted_time where id=v.id;
  perform public.crm_record_quote_mutation(q.id,v.id,null,'quote_accepted',q.status,'accepted','portal-accept:'||p_request_id::text,
    jsonb_build_object('customerAcceptanceId',receipt.id,'customerAccountId',auth.uid()));
  return jsonb_build_object('ok',true,'acceptanceId',receipt.id,'acceptedAt',to_char(receipt.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
exception when unique_violation then return jsonb_build_object('ok',false,'code','CONFLICT');
end $$;

create function public.request_customer_quote_change(p_request_id uuid,p_quote_id uuid,p_version_id uuid,p_expected_lock integer,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes; v public.quote_versions; request_row public.customer_requests; fingerprint text; body_value text; event_id uuid;
begin
  if not public.customer_account_is_active() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  body_value:=btrim(p_body,E' \t\r\n');
  if p_request_id is null or p_quote_id is null or p_version_id is null or p_expected_lock is null or p_expected_lock<0
    or body_value is null or char_length(body_value) not between 1 and 2000 or octet_length(body_value)>8000 then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  perform pg_advisory_xact_lock(hashtextextended('portal-change:v1:'||auth.uid()::text||':'||p_request_id::text,0));
  q:=public.portal_lock_customer_quote(p_quote_id);
  if q.id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  fingerprint:=encode(extensions.digest(jsonb_build_array(auth.uid(),q.id,p_version_id,p_expected_lock,body_value)::text,'sha256'),'hex');
  select * into request_row from public.customer_requests where customer_id=auth.uid() and request_id=p_request_id;
  if request_row.id is not null then
    if request_row.request_fingerprint<>fingerprint then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
    return jsonb_build_object('ok',true,'requestId',request_row.id);
  end if;
  select * into v from public.quote_versions where id=p_version_id and quote_id=q.id;
  if v.id is null or q.current_version_id is distinct from v.id or v.status not in ('sent','accepted') or v.finalized_at is null then
    return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  if q.lock_version<>p_expected_lock then return jsonb_build_object('ok',false,'code','STALE_QUOTE'); end if;
  if (select count(*) from public.customer_requests where customer_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then
    return jsonb_build_object('ok',false,'code','RATE_LIMITED'); end if;
  event_id:=gen_random_uuid();
  insert into public.customer_requests(request_id,customer_id,contact_id,quote_id,quote_version_id,lead_id,body,expected_lock_version,request_fingerprint,response_event_id)
    values(p_request_id,auth.uid(),q.contact_id,q.id,v.id,q.lead_id,body_value,p_expected_lock,fingerprint,event_id) returning * into request_row;
  insert into public.quote_events(id,quote_id,quote_version_id,contact_id,lead_id,actor_id,event_type,payload,idempotency_key,created_at)
    values(event_id,q.id,v.id,q.contact_id,q.lead_id,null,'quote_version_response',jsonb_build_object('schema','quote-version-response.v1','requestId',event_id,
      'quoteId',q.id,'quoteVersionId',v.id,'channel','portal','actorId',null),'quote-version-response:'||event_id::text,request_row.created_at);
  insert into public.lead_events(lead_id,actor_id,event_type,payload) values(q.lead_id,null,'customer_quote_change_requested',
    jsonb_build_object('quoteId',q.id,'quoteVersionId',v.id,'customerRequestId',request_row.id,'customerAccountId',auth.uid()));
  return jsonb_build_object('ok',true,'requestId',request_row.id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','CONFLICT');
end $$;

create function public.read_portal_quote_work(p_before timestamptz default null,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb:='[]'; cursor_value jsonb; more boolean:=false; r record;
begin
  if not public.is_portal_staff() or not(public.is_admin() or public.has_role('asesor') or public.has_role('operaciones')) then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if (p_before is null)<>(p_after is null) or p_before is not null and not isfinite(p_before) then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  for r in select w.*,q.quote_number,v.version_number,v.status as version_status,t.status as task_status,t.owner_id,cr.body,
      a.id as acceptance_id,case when a.id is not null or cr.id is not null then 'customer' else 'staff' end as source
    from public.portal_quote_work w join public.quote_events e on e.id=w.event_id join public.quotes q on q.id=w.quote_id
    join public.quote_versions v on v.id=e.quote_version_id left join public.tasks t on t.id=w.task_id
    left join public.customer_requests cr on cr.response_event_id=e.id
    left join public.quote_acceptances a on a.id::text=e.payload->>'customerAcceptanceId' and a.quote_id=q.id and a.quote_version_id=v.id
    where (public.is_admin() or public.has_role('asesor') and public.crm_can_read_quote(q.id) or public.has_role('operaciones') and w.kind='acceptance_handoff' and public.crm_can_read_quote(q.id))
      and (p_before is null or (w.event_at,w.event_id)<(p_before,p_after)) order by w.event_at desc,w.event_id desc limit 21
  loop
    if jsonb_array_length(items)=20 then more:=true; exit; end if;
    cursor_value:=jsonb_build_object('createdAt',to_char(r.event_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'eventId',r.event_id);
    items:=items||jsonb_build_array(jsonb_build_object('eventId',r.event_id,'quoteId',r.quote_id,'number',r.quote_number,'versionNumber',r.version_number,
      'versionStatus',r.version_status,'kind',r.kind,'body',r.body,'source',r.source,'acceptanceId',r.acceptance_id,'dueAt',to_char(r.due_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'taskId',r.task_id,'taskStatus',r.task_status,'canManage',r.task_id is not null and public.task_actor_can_manage(r.owner_id),'canClaim',r.task_id is null and public.is_admin()));
  end loop;
  return jsonb_build_object('ok',true,'items',items,'next',case when more then cursor_value else null end);
end $$;
create function public.claim_portal_quote_work(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare work public.portal_quote_work; created uuid;
begin
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  select * into work from public.portal_quote_work where event_id=p_event_id for update;
  if work.event_id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  perform 1 from public.profiles where id=auth.uid() for share;
  perform 1 from public.profile_roles where profile_id=auth.uid() for share;
  if not public.is_admin() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if work.task_id is null then
    created:=public.portal_create_work_task(work,auth.uid());
    if created is null then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
    update public.portal_quote_work set task_id=created,claimed_by=auth.uid(),claimed_at=clock_timestamp() where event_id=work.event_id;
  else created:=work.task_id;
  end if;
  return jsonb_build_object('ok',true,'taskId',created);
end $$;

create function public.manage_portal_quote_work(p_event_id uuid,p_request_id uuid,p_target_status text,p_cancel_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare work public.portal_quote_work; outcome jsonb;
begin
  if not public.is_portal_staff() or not(public.is_admin() or public.has_role('asesor')) then
    return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  select w.* into work from public.portal_quote_work w join public.tasks t on t.id=w.task_id
    where w.event_id=p_event_id and public.crm_can_read_quote(w.quote_id) and public.task_actor_can_manage(t.owner_id);
  if work.task_id is null then return jsonb_build_object('ok',false,'code','NOT_AVAILABLE'); end if;
  outcome:=public.task_action(p_request_id::text,auth.uid(),work.task_id::text,p_target_status,p_cancel_reason,
    case when p_target_status='completed' then 'work_completed' else null end,null);
  if outcome->>'ok' is distinct from 'true' then return jsonb_build_object('ok',false,'code','ACTION_UNAVAILABLE'); end if;
  return jsonb_build_object('ok',true,'taskId',work.task_id,'receiptId',outcome->>'receiptId');
end $$;

-- Accepted-ready versions may later lose accepted_at when superseded. Preserve
-- their genuine publication history using the existing immutable audit event.
create or replace function public.portal_customer_visible_versions(p_quote_id uuid) returns setof public.quote_versions
language sql stable security definer set search_path='' as $$
  select v.* from public.quote_versions v where v.quote_id=p_quote_id and public.portal_customer_owns_quote(p_quote_id)
    and v.total_amount is not null and v.total_amount::text not in ('NaN','Infinity','-Infinity')
    and (v.deposit_amount is null or v.deposit_amount::text not in ('NaN','Infinity','-Infinity'))
    and (v.valid_until is null or isfinite(v.valid_until))
    and v.finalized_at is not null and (v.sent_at is not null or v.accepted_at is not null or exists(
      select 1 from public.quote_events e where e.quote_id=v.quote_id and e.quote_version_id=v.id and e.event_type='quote_accepted'))
    and v.status in ('sent','accepted','rejected','expired','cancelled','superseded');
$$;
create or replace function public.read_customer_quote(p_quote_id uuid,p_version_id uuid default null,p_before_version integer default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; proof public.quote_acceptances; requests jsonb;
begin
  result:=public.portal_customer_quote_detail(p_quote_id,p_version_id,p_before_version);
  if result->>'ok' is distinct from 'true' then return result; end if;
  select * into proof from public.quote_acceptances where quote_version_id=(result->'version'->>'versionId')::uuid and customer_id=auth.uid();
  if proof.id is not null then
    result:=result||jsonb_build_object('acceptance',jsonb_build_object('acceptanceId',proof.id,'acceptedAt',to_char(proof.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'documentSha256',proof.document_sha256),
      'terms',jsonb_build_object('termsId',proof.terms_id,'revision',proof.terms_revision,'body',proof.terms_body,'sha256',proof.terms_sha256));
  end if;
  select coalesce(jsonb_agg(value.item order by value.created_at desc,value.id desc),'[]') into requests from (
    select r.id,r.created_at,jsonb_build_object('requestId',r.id,'versionId',r.quote_version_id,'body',r.body,
      'createdAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'status',coalesce(t.status,'awaiting_assignment')) item
    from public.customer_requests r left join public.portal_quote_work w on w.event_id=r.response_event_id left join public.tasks t on t.id=w.task_id
    where r.quote_id=p_quote_id and r.customer_id=auth.uid() order by r.created_at desc,r.id desc limit 10) value;
  return result||jsonb_build_object('requests',requests);
end $$;

-- Scope before the private version lookup, avoiding scans of other customers'
-- quote populations while retaining the original public page envelope.
create or replace function public.read_customer_quotes(p_before timestamptz default null,p_after uuid default null,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb:='[]'; cursor_value jsonb; more boolean:=false; r record; contact uuid;
begin
  if not public.customer_account_is_active() then return jsonb_build_object('ok',false,'code','ACCESS_DENIED'); end if;
  if (p_before is null)<>(p_after is null) or (p_before is not null and not isfinite(p_before)) or p_limit is null or p_limit not between 1 and 50 then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  select contact_id into contact from public.customer_accounts where user_id=auth.uid();
  for r in select q.id,q.quote_number,q.created_at,v.title,v.currency,v.total_amount,v.status
    from public.quotes q join lateral (select value.* from public.portal_customer_visible_versions(q.id) value
      order by (value.id=q.current_version_id) desc,(value.id=q.accepted_version_id) desc nulls last,value.version_number desc limit 1) v on true
    where q.contact_id=contact and q.deleted_at is null and (p_before is null or (q.created_at,q.id)<(p_before,p_after))
    order by q.created_at desc,q.id desc limit p_limit+1
  loop
    if jsonb_array_length(items)=p_limit then more:=true; exit; end if;
    cursor_value:=jsonb_build_object('createdAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'quoteId',r.id);
    items:=items||jsonb_build_array(jsonb_build_object('quoteId',r.id,'number',r.quote_number,'title',r.title,
      'currency',r.currency,'totalAmount',r.total_amount,'status',r.status));
  end loop;
  return jsonb_build_object('ok',true,'items',items,'next',case when more then cursor_value else null end);
end $$;

revoke all on function public.portal_customer_evidence_immutable(),public.portal_work_immutable(),public.portal_lock_customer_quote(uuid),
  public.portal_create_work_task(public.portal_quote_work,uuid),public.portal_enqueue_quote_work(),public.portal_cancel_customer_quote_follow_up(),
  public.accept_customer_quote(uuid,uuid,uuid,integer,uuid,text,text,boolean),public.request_customer_quote_change(uuid,uuid,uuid,integer,text),
  public.read_portal_quote_work(timestamptz,uuid),public.claim_portal_quote_work(uuid),public.manage_portal_quote_work(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.accept_customer_quote(uuid,uuid,uuid,integer,uuid,text,text,boolean),public.request_customer_quote_change(uuid,uuid,uuid,integer,text),
  public.read_portal_quote_work(timestamptz,uuid),public.claim_portal_quote_work(uuid),public.manage_portal_quote_work(uuid,uuid,text,text) to authenticated;
commit;
