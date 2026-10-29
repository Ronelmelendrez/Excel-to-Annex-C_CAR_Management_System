-- 0008_imports_pipeline.sql
-- F3 Excel Import: versioned imports, duplicate detection, row traceability,
-- role-scoped reads, and a private upload bucket.

-- ---------------------------------------------------------------------------
-- Import metadata
-- ---------------------------------------------------------------------------
alter table public.imports
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists header_row int,
  add column if not exists row_count int not null default 0,
  add column if not exists valid_row_count int not null default 0,
  add column if not exists error_row_count int not null default 0,
  add column if not exists household_count int not null default 0,
  add column if not exists member_count int not null default 0,
  add column if not exists validation_summary jsonb,
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists duplicate_of uuid references public.imports(id);

-- An identical fingerprint is allowed as an explicit, audited new version.
-- Duplicate detection is done by the import API; history is never overwritten.
alter table public.imports
  drop constraint if exists imports_file_hash_sheet_name_key;

create index if not exists idx_imports_fingerprint on public.imports(file_hash, sheet_name, version desc);
create unique index if not exists imports_fingerprint_version_unique
  on public.imports(file_hash, sheet_name, version);
create index if not exists idx_imports_created_at on public.imports(created_at desc);

alter table public.import_rows
  add column if not exists issue_count int not null default 0;

create unique index if not exists import_rows_import_row_unique
  on public.import_rows(import_id, source_row_no);
create index if not exists idx_import_rows_import_status on public.import_rows(import_id, status);

alter table public.households
  add column if not exists member_count int not null default 0;

create index if not exists idx_households_import on public.households(import_id);

-- Deleting a failed import cascades to rows and households. Make the row link
-- nullable so cleanup cannot be blocked by foreign-key ordering.
alter table public.household_members
  drop constraint if exists household_members_import_row_id_fkey;
alter table public.household_members
  add constraint household_members_import_row_id_fkey
  foreign key (import_row_id) references public.import_rows(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Role helper (active profiles only)
-- ---------------------------------------------------------------------------
create or replace function public.has_active_role(uid uuid, roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.status = 'active'
  )
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid and ur.role = any(roles)
  );
$$;

grant execute on function public.has_active_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: staff read, server-only writes
-- ---------------------------------------------------------------------------
drop policy if exists imports_staff_read on public.imports;
create policy imports_staff_read on public.imports
  for select using (
    public.has_active_role(auth.uid(), array['admin','operator','case_worker','reviewer','auditor'])
  );

drop policy if exists import_rows_staff_read on public.import_rows;
create policy import_rows_staff_read on public.import_rows
  for select using (
    public.has_active_role(auth.uid(), array['admin','operator','case_worker','reviewer','auditor'])
  );

drop policy if exists households_staff_read on public.households;
create policy households_staff_read on public.households
  for select using (
    public.has_active_role(auth.uid(), array['admin','operator','case_worker','reviewer','auditor'])
  );

drop policy if exists household_members_staff_read on public.household_members;
create policy household_members_staff_read on public.household_members
  for select using (
    public.has_active_role(auth.uid(), array['admin','operator','case_worker','reviewer','auditor'])
  );

drop policy if exists household_corrections_staff_read on public.household_corrections;
create policy household_corrections_staff_read on public.household_corrections
  for select using (
    public.has_active_role(auth.uid(), array['admin','operator','case_worker','reviewer','auditor'])
  );

-- ---------------------------------------------------------------------------
-- Private workbook storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  26214400,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists imports_bucket_insert on storage.objects;
create policy imports_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_active_role(auth.uid(), array['admin','operator'])
  );

drop policy if exists imports_bucket_read_own on storage.objects;
create policy imports_bucket_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'imports'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

-- No client update/delete policy: workbooks are provenance, server-only.

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value)
values ('import_required_columns', '["HH_ID","ENTRY_ID","FIRST_NAME","LAST_NAME","GRANTEE"]'::jsonb)
on conflict (key) do nothing;
