create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label_es text not null,
  label_en text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  assigned_to uuid references public.profiles(id) on delete set null,
  booking_code text unique,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  destination_id uuid references public.destinations(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_on date,
  ends_on date,
  travelers_count integer not null default 1 check (travelers_count > 0),
  total_mxn numeric(12,2) check (total_mxn is null or total_mxn >= 0),
  total_usd numeric(12,2) check (total_usd is null or total_usd >= 0),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_date_range_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create trigger set_bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();
create index bookings_contact_id_idx on public.bookings(contact_id);
create index bookings_assigned_to_idx on public.bookings(assigned_to);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  method_id uuid references public.payment_methods(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  status text not null default 'pending' check (status in ('pending', 'received', 'verified', 'rejected', 'refunded')),
  payment_type text not null default 'deposit' check (payment_type in ('deposit', 'partial', 'balance', 'full', 'refund')),
  proof_bucket text,
  proof_path text,
  paid_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create index payments_booking_id_idx on public.payments(booking_id);
create index payments_status_idx on public.payments(status);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  document_type text not null default 'other' check (document_type in ('itinerary', 'voucher', 'invoice', 'identification', 'contract', 'other')),
  title text not null,
  bucket text not null default 'documents',
  path text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path)
);

create trigger set_documents_updated_at before update on public.documents for each row execute function public.set_updated_at();
create index documents_booking_id_idx on public.documents(booking_id);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel text not null check (channel in ('email', 'whatsapp')),
  subject_es text,
  subject_en text,
  body_es text not null,
  body_en text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_message_templates_updated_at before update on public.message_templates for each row execute function public.set_updated_at();
