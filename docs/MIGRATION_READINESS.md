# Migration Readiness Report

**Target architecture:** Vite React on Vercel · standalone Supabase (Postgres + Auth + RLS) · Google Drive for documents · Resend for email.

## Status: ready to migrate

Nothing in the codebase blocks the move off Lovable Cloud. Below is what was audited and why each area is safe.

## 1. Supabase Storage
- Three buckets exist (`resumes`, `promotion-images`, `location-photos`) — **all unused**.
- Zero references in `src/` or `api/` to `supabase.storage.*`.
- Cleanup: `migrations-standalone/99_cleanup_storage.sql` (optional; safe on a fresh project).

## 2. Google Drive
- Drive API v3 + Sheets API v4, OAuth 2.0 refresh-token flow (`vtgmaudit@gmail.com`).
- Folder layout auto-created under `GOOGLE_DRIVE_FOLDER_ID`:
  - `VT Gas & Market/Careers/{position}/{location}/` — resumes
  - `VT Gas & Market/promotions/`
  - `VT Gas & Market/location-photos/{storeSlug}/{slot}/`
- Metadata persisted in `public.attachments`; folder-id cache in `public.drive_folders`.
- No changes required for the migration.

## 3. Database
- No Cloud-only extensions (`vault`, `pg_net`, `pg_cron` all absent).
- Helper functions (`has_role`, `has_permission`, `is_admin`, `can_access_store`, `user_store_ids`, `my_permissions`, `handle_new_user`, `bootstrap_first_admin`, `fn_audit`, `fn_log_ticket_changes`, `set_updated_at`) use only stock plpgsql + `auth.uid()`.
- All RLS policies portable.
- Consolidated bundle: `migrations-standalone/01_full_schema.sql`.

## 4. Server code
- No Supabase Edge Functions (`supabase/functions/` is empty).
- All server code lives in Vercel functions under `api/` — portable as-is.
- No Lovable API / SDK / gateway calls anywhere in `api/` or `src/`.

## 5. Auth
- Standard Supabase Auth (email/password). No custom identity provider.
- Migration procedure: see `docs/AUTH_MIGRATION.md`. Passwords survive via `password_hash` re-import; UUIDs preserved so every FK still resolves.

## 6. Env vars
- Full mapping in `docs/ENV_VARS.md`.
- Only two Lovable-specific vars: `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` and `..._TRACKING_ID`. Both are renamed to `VITE_GOOGLE_MAPS_*` in `.env.example`; the code reads the new name with a fallback to the old one for one release.
- `LOVABLE_API_KEY` and `GOOGLE_SERVICE_ACCOUNT_JSON` are unused and can be dropped.

## Follow-up work (not blocking migration)

- Refactor `promotions.image_url` and store photo URL columns to reference `attachments.id` instead of storing raw Drive URLs. Tracked in the approved plan (steps 3–4). Purely additive — safe to do before or after the cutover.
