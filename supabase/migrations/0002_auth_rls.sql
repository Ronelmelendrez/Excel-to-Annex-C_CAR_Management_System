-- 0002_auth_rls.sql
-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- Helper function is_admin (security definer)
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
as 
begin
  if uid is null then
    return false;
  end if;
  if exists (select 1 from public.profiles p where p.id = uid and p.status = 'disabled') then
    return false;
  end if;
  return exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = 'admin'
  );
end;
;

-- profiles policies
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- user_roles policies: read own, write only admin/server (enforced by API; RLS blocks non-admin client writes)
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists user_roles_no_client_write on public.user_roles;
create policy user_roles_no_client_write on public.user_roles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
