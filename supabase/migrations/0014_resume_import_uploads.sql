-- Resume direct browser uploads and downloads for the import workflow.
-- Restores exactly what 0013_pause_import_uploads.sql dropped: private
-- workbooks may be uploaded to the caller's own folder and read back by
-- that caller (or an admin). Still no update/delete policy — workbooks
-- are provenance, server-only.
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
