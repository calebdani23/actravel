create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  constraint roles_name_check check (name in ('admin', 'asesor', 'operaciones', 'finanzas', 'marketing'))
);

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create index profile_roles_role_id_idx on public.profile_roles(role_id);
