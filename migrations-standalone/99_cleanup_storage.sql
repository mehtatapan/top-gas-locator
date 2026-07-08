-- Optional cleanup: remove unused Supabase Storage buckets.
-- Google Drive is the permanent document storage layer for this application.
-- Supabase Storage MUST NOT be used for business files.
--
-- Safe to skip on a fresh project (nothing to delete).

DELETE FROM storage.objects WHERE bucket_id IN ('resumes','promotion-images','location-photos');
DELETE FROM storage.buckets WHERE id       IN ('resumes','promotion-images','location-photos');
