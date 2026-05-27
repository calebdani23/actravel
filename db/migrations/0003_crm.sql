create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text,
  email text,
  phone text,
  preferred_locale text not null default 'es' check (preferred_locale in ('es', 'en')),
  source text,
  consent_marketing boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_email_or_phone_check check (email is not null or phone is not null)
);

create trigger set_contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create index contacts_email_idx on public.contacts(lower(email));
create index contacts_phone_idx on public.contacts(phone);

create table public.lead_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label_es text not null,
  label_en text not null,
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  status_id uuid not null references public.lead_statuses(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  destination_id uuid,
  service_id uuid,
  travel_start_date date,
  travel_end_date date,
  travelers_count integer not null default 1 check (travelers_count > 0),
  budget_mxn numeric(12,2) check (budget_mxn is null or budget_mxn >= 0),
  budget_usd numeric(12,2) check (budget_usd is null or budget_usd >= 0),
  source text not null default 'website',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_leads_updated_at before update on public.leads for each row execute function public.set_updated_at();
create index leads_contact_id_idx on public.leads(contact_id);
create index leads_status_id_idx on public.leads(status_id);
create index leads_assigned_to_idx on public.leads(assigned_to);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_lead_notes_updated_at before update on public.lead_notes for each row execute function public.set_updated_at();
create index lead_notes_lead_id_idx on public.lead_notes(lead_id);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lead_events_lead_id_idx on public.lead_events(lead_id);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  locale text not null default 'es' check (locale in ('es', 'en')),
  destination_slug text,
  service_slug text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processing', 'converted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_quote_requests_updated_at before update on public.quote_requests for each row execute function public.set_updated_at();
create index quote_requests_lead_id_idx on public.quote_requests(lead_id);
