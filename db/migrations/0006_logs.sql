create table public.whatsapp_clicks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  locale text not null default 'es' check (locale in ('es', 'en')),
  page_path text,
  phone text,
  message text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index whatsapp_clicks_created_at_idx on public.whatsapp_clicks(created_at desc);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp', 'system')),
  provider text,
  recipient text,
  template_name text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notification_logs_status_idx on public.notification_logs(status);

create table public.sheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  direction text not null default 'push' check (direction in ('push', 'pull')),
  sheet_name text,
  row_id text,
  status text not null default 'queued' check (status in ('queued', 'success', 'failed', 'skipped')),
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sheet_sync_logs_status_idx on public.sheet_sync_logs(status);
