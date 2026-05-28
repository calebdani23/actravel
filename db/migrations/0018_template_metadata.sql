alter table public.message_templates
  add column if not exists category text not null default 'general',
  add column if not exists description text,
  add column if not exists sort_order integer not null default 100;

create index if not exists message_templates_channel_category_active_sort_idx
  on public.message_templates (channel, category, is_active, sort_order, updated_at desc);
