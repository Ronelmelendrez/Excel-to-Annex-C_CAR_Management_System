-- 0006_templates_docs.sql
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version int not null default 1,
  storage_path text,
  field_mappings jsonb default '{}'::jsonb,
  required_fields jsonb default '[]'::jsonb,
  repeating_config jsonb default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','validated','active','retired')),
  created_by uuid references public.profiles(id),
  activated_by uuid references public.profiles(id),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(name, version)
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.case_assessments(id),
  revision int not null,
  import_id uuid references public.imports(id),
  template_id uuid references public.document_templates(id),
  template_version int,
  docx_path text,
  pdf_path text,
  kind text not null check (kind in ('draft','approved')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  checksums jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  assessment_id uuid references public.case_assessments(id),
  revision int,
  template_id uuid references public.document_templates(id),
  template_version int,
  kind text check (kind in ('draft','approved')),
  state text not null default 'queued' check (state in ('queued','running','docx_ok','pdf_ok','verified','failed')),
  attempts int not null default 0,
  last_error_safe text,
  output_verification jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_export_jobs_updated_at
before update on public.export_jobs
for each row execute function public.set_updated_at();

alter table public.document_templates enable row level security;
alter table public.generated_reports enable row level security;
alter table public.export_jobs enable row level security;
