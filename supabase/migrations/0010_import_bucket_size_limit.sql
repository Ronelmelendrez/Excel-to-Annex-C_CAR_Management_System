-- 0010_import_bucket_size_limit.sql
-- The app accepts workbooks up to 50 MB (MAX_IMPORT_BYTES in _shared/
-- import-domain.ts, mirrored by IMPORT_MAX_BYTES in the web build), but the
-- imports bucket was created with a 25 MB file_size_limit. Any workbook
-- between 25 MB and the platform cap passed every client/server check and
-- then failed at the storage upload with HTTP 400 (EntityTooLarge).
--
-- Raise the bucket to 100 MB: it now sits above both the app's 50 MB cap
-- and the Supabase free plan's 50 MB per-file platform limit, so the bucket
-- never rejects a file the app accepts, and a plan upgrade plus a
-- VITE_IMPORT_MAX_MB raise never hits the bucket either.
update storage.buckets
set file_size_limit = 104857600 -- 100 MB
where id = 'imports';
