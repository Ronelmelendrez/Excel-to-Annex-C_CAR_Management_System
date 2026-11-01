-- 0009_template_management.sql
-- Private DOCX storage and administrator-only template lifecycle.

alter table public.document_templates
  add column if not exists file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz;

update public.document_templates
set file_name = coalesce(nullif(file_name, ''), nullif(regexp_replace(coalesce(storage_path, ''), '^.*/', ''), ''), 'template.docx'),
    file_size_bytes = coalesce(file_size_bytes, 0)
where file_name is null or file_size_bytes is null;

alter table public.document_templates
  alter column file_name set default '',
  alter column file_name set not null,
  alter column file_size_bytes set default 0,
  alter column file_size_bytes set not null;

drop policy if exists document_templates_admin_all on public.document_templates;
create policy document_templates_admin_all on public.document_templates
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-templates',
  'document-templates',
  false,
  5242880,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists document_templates_storage_select on storage.objects;
create policy document_templates_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'document-templates' and public.is_admin(auth.uid()));

drop policy if exists document_templates_storage_insert on storage.objects;
create policy document_templates_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'document-templates' and public.is_admin(auth.uid()));

drop policy if exists document_templates_storage_update on storage.objects;
create policy document_templates_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'document-templates' and public.is_admin(auth.uid()))
  with check (bucket_id = 'document-templates' and public.is_admin(auth.uid()));

drop policy if exists document_templates_storage_delete on storage.objects;
create policy document_templates_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'document-templates' and public.is_admin(auth.uid()));

create or replace function public.activate_document_template(template_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_template public.document_templates%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select *
  into selected_template
  from public.document_templates
  where id = template_uuid
  for update;

  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  if selected_template.status <> 'validated' or selected_template.approved_by is null then
    raise exception 'template_not_ready' using errcode = '23514';
  end if;

  update public.document_templates
  set status = 'retired'
  where name = selected_template.name
    and status = 'active'
    and id <> selected_template.id;

  update public.document_templates
  set status = 'active',
      activated_by = auth.uid(),
      activated_at = now()
  where id = selected_template.id;
end;
$$;

revoke all on function public.activate_document_template(uuid) from public;
grant execute on function public.activate_document_template(uuid) to authenticated;
