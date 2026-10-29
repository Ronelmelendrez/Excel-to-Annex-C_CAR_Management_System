-- 0004_imports_core.sql
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  storage_path text not null,
  sheet_name text not null,
  version int not null default 1,
  status text not null default 'uploaded' check (status in ('uploaded','mapped','validating','validated','failed','committed')),
  uploaded_by uuid references public.profiles(id),
  column_mapping jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  unique(file_hash, sheet_name)
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  source_row_no int not null,
  raw jsonb not null,        -- immutable
  normalized jsonb,
  errors jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  hh_id text not null,
  grantee_status text not null check (grantee_status in ('valid','none','multiple','invalid','blank')),
  review_status text not null default 'ok' check (review_status in ('ok','needs_review','resolved')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  resolution_reason text,
  created_at timestamptz not null default now(),
  unique(import_id, hh_id)
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  import_row_id uuid references public.import_rows(id),
  entry_id text,
  lrn text,
  pcn text,
  is_grantee_flag_raw text,
  normalized_grantee boolean,
  excluded bool not null default false,
  raw jsonb
);

create table if not exists public.household_corrections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid references public.household_members(id),
  field text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.imports enable row level security;
alter table public.import_rows enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_corrections enable row level security;

-- basic policies (API enforces fine-grained; allow authenticated read for staff roles - checked by API)
drop policy if exists imports_staff_read on public.imports;
create policy imports_staff_read on public.imports for select using (auth.uid() is not null);

drop policy if exists households_staff_read on public.households;
create policy households_staff_read on public.households for select using (auth.uid() is not null);

drop policy if exists household_members_staff_read on public.household_members;
create policy household_members_staff_read on public.household_members for select using (auth.uid() is not null);
