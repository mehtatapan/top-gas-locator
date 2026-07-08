
# Migration Prep: Lovable Cloud → Standalone Supabase + Vercel + Google Drive

Goal: remove infra dependency on Lovable Cloud without changing product behavior. No new features, no auth model changes. All work is portability + one small refactor of image columns to go through `attachments`.

---

## 1. Consolidated migration package (`migrations-standalone/`)

Create a fresh, ordered SQL bundle a new Supabase project can replay end-to-end. Existing `supabase/migrations/*` stay untouched (they're the historical Lovable Cloud record); the new folder is the clean deploy artifact.

Files (run in order):

```text
migrations-standalone/
  00_extensions.sql          -- pgcrypto, uuid-ossp
  01_schema_core.sql         -- stores, store_managers, profiles, roles, permissions,
                                role_permissions, user_roles, audit_logs
  02_schema_documents.sql    -- attachments, drive_folders
  03_schema_business.sql     -- promotions, employees, tickets, compliance_*,
                                fuel_*, gaming_*, lottery_*, atm_*, pnl_*,
                                vendors, vendor_contracts, equipment, maintenance_*,
                                payroll_*, shifts, time_entries, notifications,
                                email_queue, report_definitions, report_snapshots,
                                categories, expense_categories, revenue_categories,
                                ticket_categories, ticket_comments, ticket_history,
                                ticket_assignments
  04_functions.sql           -- set_updated_at, has_role, has_permission, is_admin,
                                can_access_store, user_store_ids, my_permissions,
                                fn_audit, fn_log_ticket_changes,
                                handle_new_user, bootstrap_first_admin
  05_triggers.sql            -- updated_at triggers, audit triggers,
                                auth.users → handle_new_user + bootstrap_first_admin
  06_rls_policies.sql        -- every policy currently in the DB
  07_grants.sql              -- GRANT SELECT/INSERT/UPDATE/DELETE per role
  08_seed_rbac.sql           -- roles (super_admin, owner, regional_manager,
                                store_manager, employee), permissions catalog,
                                role_permissions mapping
  09_seed_reference.sql      -- stores, ticket_categories, expense/revenue
                                categories, fuel_products, lottery_games
  README.md                  -- run order + psql one-liner
```

Portability audit already done — nothing Cloud-specific:
- No `vault`, `pg_net`, `pg_cron`, or Cloud extensions
- All helper functions use only `auth.uid()` + standard plpgsql
- No Supabase Edge Functions exist (`supabase/functions/` is empty)

---

## 2. Supabase Storage cleanup

Confirmed zero code references (`rg supabase.storage` returns nothing). Deliverables:

- `migrations-standalone/99_cleanup_storage.sql` — `delete from storage.buckets where id in ('resumes','promotion-images','location-photos');` (documented, run manually on the new project only if the buckets exist)
- Note in README: **do not create Supabase Storage buckets** on the new project
- Add ESLint rule / doc guard: any future `supabase.storage.*` call is a review blocker

---

## 3. Refactor image columns to reference `attachments`

Schema change (small, additive, no data loss for a fresh install; migration script for existing rows included):

```text
promotions
  + image_attachment_id uuid references attachments(id) on delete set null
  - image_url  (kept temporarily as fallback, dropped in a later migration)

stores
  + hero_photo_attachment_id uuid references attachments(id)
  + gallery_attachment_ids uuid[]  (or a stores_photos join table if slot-based)
  - existing photo_* url columns  (kept temporarily)
```

Backfill script for any rows already holding a `drive.google.com/thumbnail?id=<ID>` URL:
1. Parse `<ID>` from `image_url`
2. Upsert into `attachments` (`module='promotions'`, `drive_file_id=<ID>`, `web_view_link` reconstructed)
3. Set `image_attachment_id` to new row

Code changes:
- `ImageUpload` component: accept `attachmentId` + `onAttachmentChange(id, url)` instead of raw url. Server already returns the full `attachments` row from `/api/uploads`.
- `PromotionsPage` and `LocationPhotosPage`: store `image_attachment_id` instead of the URL
- Read side (`StorePromotions`, `LocationPage`): join `attachments` and build the Drive thumbnail URL client-side from `drive_file_id`
- Add a small helper `driveThumbUrl(fileId, w=2000)` in `src/lib/drive.ts`

---

## 4. Environment variable rename + cleanup

**Frontend `.env`:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
VITE_GOOGLE_MAPS_BROWSER_KEY        # renamed from VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY
VITE_GOOGLE_MAPS_TRACKING_ID        # renamed (optional)
```

**Vercel functions:**
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, SUPABASE_JWKS
GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN
GOOGLE_DRIVE_FOLDER_ID, GOOGLE_SHEET_ID
RESEND_API_KEY, HIRING_EMAIL
```

Removed: `LOVABLE_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` (unused), all `VITE_LOVABLE_CONNECTOR_*`.

Code touch points for the rename: `src/components/LocationsMap.tsx` and any other file reading the old maps var — update to `import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY` with a fallback to the old name for one release cycle.

Deliverable: updated `.env.example` at project root listing exactly the vars above.

---

## 5. Auth migration guide (`docs/AUTH_MIGRATION.md`)

No code changes — pure runbook.

Steps:
1. Provision new Supabase project, run `migrations-standalone/00–08` (skip `handle_new_user` + `bootstrap_first_admin` triggers until after import).
2. Export from current Supabase: `GET /auth/v1/admin/users` (paginated). Save JSON.
3. Import to new project: `POST /auth/v1/admin/users` with `id`, `email`, `email_confirmed_at`, and `password_hash` preserved — users keep their passwords.
4. Restore triggers on `auth.users`.
5. Copy `public.profiles`, `public.user_roles`, `public.store_managers`, `public.attachments`, `public.audit_logs`, etc. via `pg_dump --data-only --table=public.<t>` piped to the new DB. UUIDs preserved → all FKs resolve.
6. Fetch new `SUPABASE_JWKS` URL and update Vercel env.
7. Swap `VITE_SUPABASE_*` on Vercel, redeploy, smoke test login + upload.

Rollback: keep old Lovable Cloud project running until smoke tests pass; DNS/env swap is the cutover.

---

## 6. Docs to ship

- `docs/MIGRATION_READINESS.md` — the audit summary already produced
- `docs/GOOGLE_DRIVE_ARCHITECTURE.md` — folder layout, `attachments` contract, `/api/uploads` API, adding a new module (3-step recipe)
- `docs/SUPABASE_MIGRATION_CHECKLIST.md` — ordered checklist wrapping sections 1, 2, 4, 5 above
- `docs/ENV_VARS.md` — full var table with source, consumer, and whether it's client or server

---

## Technical details

**Files changed:**
- New: `migrations-standalone/*.sql`, `docs/*.md`, updated `.env.example`, `src/lib/drive.ts`
- Edited: `src/components/admin/ImageUpload.tsx` (attachment-first API, url still supported), `src/pages/admin/PromotionsPage.tsx`, `src/pages/admin/LocationPhotosPage.tsx`, `src/components/StorePromotions.tsx`, `src/pages/LocationPage.tsx`, `src/components/LocationsMap.tsx` (env var rename with fallback)

**Migrations run against current Lovable Cloud DB (via `supabase--migration`):**
- Add `image_attachment_id` / photo attachment FKs on `promotions` and `stores` (nullable, non-breaking)
- Backfill script for existing rows

**Explicitly NOT doing:**
- Changing auth flow, RBAC model, or any business logic
- Introducing new modules
- Touching `supabase/functions/` (empty)
- Deleting the old `image_url` columns yet — kept for one release as a safety net

---

## Order of execution once approved

1. Migration bundle + docs (no runtime impact)
2. Env var rename with backward-compatible fallback
3. Additive schema migration (`image_attachment_id` etc.) + backfill
4. Refactor `ImageUpload` + read sites to use attachment IDs
5. After a stable release: drop legacy `image_url` columns in a follow-up migration
