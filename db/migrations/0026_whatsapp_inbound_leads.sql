create table public.whatsapp_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  meta_message_id text not null unique,
  phone_number_id text not null,
  wa_id text not null,
  from_phone text not null,
  profile_name text,
  message_type text not null,
  message_text text,
  normalized_text text,
  referral jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (
    processing_status in (
      'received',
      'ignored_non_text',
      'ignored_trigger_mismatch',
      'ignored_no_referral',
      'duplicate',
      'lead_created',
      'failed'
    )
  ),
  ignored_reason text,
  error_message text,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_inbound_messages_message_text_len check (message_text is null or char_length(message_text) <= 4000),
  constraint whatsapp_inbound_messages_profile_name_len check (profile_name is null or char_length(profile_name) <= 180),
  constraint whatsapp_inbound_messages_error_len check (error_message is null or char_length(error_message) <= 1000),
  constraint whatsapp_inbound_messages_ignored_reason_len check (ignored_reason is null or char_length(ignored_reason) <= 180)
);

create trigger set_whatsapp_inbound_messages_updated_at
before update on public.whatsapp_inbound_messages
for each row execute function public.set_updated_at();

create index whatsapp_inbound_messages_received_at_idx on public.whatsapp_inbound_messages(received_at desc);
create index whatsapp_inbound_messages_lead_id_idx on public.whatsapp_inbound_messages(lead_id);
create index whatsapp_inbound_messages_contact_id_idx on public.whatsapp_inbound_messages(contact_id);
create index whatsapp_inbound_messages_processing_status_idx on public.whatsapp_inbound_messages(processing_status);
create index whatsapp_inbound_messages_wa_id_idx on public.whatsapp_inbound_messages(wa_id);

alter table public.whatsapp_inbound_messages enable row level security;

create policy "whatsapp inbound staff read"
on public.whatsapp_inbound_messages
for select to authenticated
using (
  public.is_admin()
  or public.has_role('marketing')
  or public.has_role('operaciones')
  or (public.has_role('asesor') and lead_id is not null and public.is_assigned_lead(lead_id))
);

create policy "whatsapp inbound admin marketing write"
on public.whatsapp_inbound_messages
for all to authenticated
using (public.is_admin() or public.has_role('marketing'))
with check (public.is_admin() or public.has_role('marketing'));
