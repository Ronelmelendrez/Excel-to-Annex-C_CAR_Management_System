-- 0005_cars_core.sql
create table if not exists public.case_assessments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  grantee_member_id uuid references public.household_members(id),
  case_group_id uuid not null default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved')),
  revision int not null default 1,
  owner_id uuid references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  content jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_group_id, revision)
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.case_assessments(id) on delete cascade,
  seq int not null,
  type text,
  details jsonb,
  unique(assessment_id, seq)
);

create trigger set_case_assessments_updated_at
before update on public.case_assessments
for each row execute function public.set_updated_at();

alter table public.case_assessments enable row level security;
alter table public.interventions enable row level security;

drop policy if exists cars_staff_read on public.case_assessments;
create policy cars_staff_read on public.case_assessments for select using (auth.uid() is not null);
