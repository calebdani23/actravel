begin;

alter table public.tasks
  add column task_kind text not null default 'manual',
  add column source_event_id uuid,
  add column source_event_type text,
  add column source_event_created_at timestamptz,
  add column source_due_at timestamptz,
  add column source_payload jsonb,
  add column metadata jsonb;

alter table public.tasks
  add constraint tasks_task_kind_check check (task_kind in ('manual', 'follow_up')),
  add constraint tasks_metadata_size_check check (
    metadata is null or octet_length(convert_to(metadata::text, 'UTF8')) <= 8192
  ),
  add constraint tasks_source_payload_size_check check (
    source_payload is null or octet_length(convert_to(source_payload::text, 'UTF8')) <= 65536
  );

create unique index tasks_source_event_id_idx
  on public.tasks(source_event_id) where source_event_id is not null;

create or replace function public.validate_task_representation_insert()
returns trigger language plpgsql set search_path = public
as $function$
begin
  if new.task_kind = 'manual' then
    if new.source_event_id is not null or new.source_event_type is not null
       or new.source_event_created_at is not null or new.source_due_at is not null
       or new.source_payload is not null or new.metadata is not null then
      raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
    end if;
    return new;
  end if;

  if new.task_kind <> 'follow_up'
     or new.source_event_id is null or new.source_event_type is null
     or new.source_event_created_at is null or new.source_due_at is null
     or new.source_payload is null or new.metadata is null
     or new.source_event_type <> 'follow_up_registered'
     or new.lead_id is null or new.quote_id is not null
     or new.source_due_at is distinct from new.due_at
     or date_trunc('microseconds', new.source_event_created_at) is distinct from new.source_event_created_at
     or date_trunc('microseconds', new.source_due_at) is distinct from new.source_due_at
     or (select count(*) from jsonb_object_keys(new.metadata)) <> 5
     or new.metadata ?| array['unexpected']
     or (new.metadata - array['schema', 'source_event_id', 'source_event_type', 'owner_id', 'lead_id']) <> '{}'::jsonb
     or not (new.metadata ?& array['schema', 'source_event_id', 'source_event_type', 'owner_id', 'lead_id'])
     or exists (select 1 from jsonb_each(new.metadata) e where jsonb_typeof(e.value) <> 'string')
     or new.metadata->>'schema' <> 'follow_up_task.v1'
     or new.metadata->>'source_event_id' <> lower(new.source_event_id::text)
     or new.metadata->>'source_event_type' <> new.source_event_type
     or new.metadata->>'owner_id' <> lower(new.owner_id::text)
     or new.metadata->>'lead_id' <> lower(new.lead_id::text) then
    raise exception using errcode = 'PT002', message = 'TASK_INVALID_ARGUMENT';
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_task_representation_update()
returns trigger language plpgsql set search_path = public
as $function$
begin
  if new.task_kind is distinct from old.task_kind
     or new.source_event_id is distinct from old.source_event_id
     or new.source_event_type is distinct from old.source_event_type
     or new.source_event_created_at is distinct from old.source_event_created_at
     or new.source_due_at is distinct from old.source_due_at
     or new.source_payload is distinct from old.source_payload
     or new.metadata is distinct from old.metadata then
    raise exception using errcode = 'PT002', message = 'TASK_REPRESENTATION_IMMUTABLE';
  end if;
  return new;
end;
$function$;

create trigger validate_task_representation_insert
  before insert on public.tasks
  for each row execute function public.validate_task_representation_insert();

create trigger prevent_task_representation_update
  before update on public.tasks
  for each row execute function public.prevent_task_representation_update();

alter function public.validate_task_representation_insert() owner to postgres;
alter function public.prevent_task_representation_update() owner to postgres;
revoke all on function public.validate_task_representation_insert() from public, anon, authenticated, service_role;
revoke all on function public.prevent_task_representation_update() from public, anon, authenticated, service_role;

commit;
