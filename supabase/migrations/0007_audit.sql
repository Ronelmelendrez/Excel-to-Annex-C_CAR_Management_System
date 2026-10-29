-- 0007_audit.sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_address inet,
  user_agent text,
  before_state jsonb,
  after_state jsonb,
  at timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id, at);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id, at);

alter table public.audit_logs enable row level security;

-- insert via server only; read by auditor/admin
drop policy if exists audit_logs_read_auditor_admin on public.audit_logs;
create policy audit_logs_read_auditor_admin on public.audit_logs
  for select using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role in ('auditor','admin')
    ) and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );
