-- 0003_admin_core_settings.sql
create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- only admins can read/write via RLS; API enforces too
drop policy if exists system_settings_admin_only on public.system_settings;
create policy system_settings_admin_only on public.system_settings
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- seed defaults
insert into public.system_settings (key, value)
values 
  ('access_mode', '"standard"'),
  ('required_car_fields', '[]'),
  ('retention_days', '365')
on conflict (key) do nothing;
