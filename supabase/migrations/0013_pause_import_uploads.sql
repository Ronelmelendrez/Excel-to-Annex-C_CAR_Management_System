-- Pause direct browser uploads and downloads while the import workflow is disabled.
drop policy if exists imports_bucket_insert on storage.objects;
drop policy if exists imports_bucket_read_own on storage.objects;
