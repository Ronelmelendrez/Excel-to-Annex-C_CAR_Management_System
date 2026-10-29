-- 0001_auth_profiles.sql
-- Profiles table linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','operator','case_worker','reviewer','auditor')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique(user_id, role)
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as 
begin
  new.updated_at = now();
  return new;
end;
 language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
