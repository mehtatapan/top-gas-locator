# Supabase Migration Checklist

Tick off top to bottom on cutover day.

## Prep (can be done days before)

- [ ] New Supabase project created; DB URL and service-role key captured.
- [ ] `migrations-standalone/01_full_schema.sql` reviewed.
- [ ] Vercel project has all vars from `docs/ENV_VARS.md` **staged** (use the "Preview" env, not Production).
- [ ] Google Cloud OAuth client's Authorized JS origins + Redirect URIs include the production domain.
- [ ] Drive folder shared with the OAuth account (`vtgmaudit@gmail.com`).

## Schema

- [ ] `psql "$NEW_DB_URL" -f migrations-standalone/01_full_schema.sql` completes with no errors.
- [ ] `SELECT count(*) FROM public.roles;` returns the 5 seeded roles.
- [ ] `SELECT count(*) FROM public.permissions;` matches source project.
- [ ] Disable `handle_new_user` and `bootstrap_first_admin` triggers on `auth.users` before user import.

## Auth

- [ ] `users.json` exported from old project via Admin API.
- [ ] All users re-imported into new project with preserved `id` and `password_hash`.
- [ ] Spot-check: one user can log in on a staging deploy pointed at the new DB.

## Data

- [ ] `pg_dump --data-only` of each `public.*` table replayed on the new DB (see `docs/AUTH_MIGRATION.md` step 4).
- [ ] Row counts match old vs. new for `profiles`, `user_roles`, `stores`, `attachments`, `audit_logs`.
- [ ] Re-enable auth triggers.

## Storage

- [ ] No Supabase Storage buckets exist on the new project. `SELECT id FROM storage.buckets;` returns nothing (or only Supabase defaults).
- [ ] Optional: run `migrations-standalone/99_cleanup_storage.sql`.

## Vercel cutover

- [ ] Env vars promoted from Preview → Production on Vercel.
- [ ] Legacy `LOVABLE_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and both `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_*` removed.
- [ ] Redeploy triggered.
- [ ] Login works.
- [ ] Admin image upload works end-to-end (Drive file appears in the expected folder).
- [ ] Careers form submission works (Sheet row + confirmation email).

## Post-cutover

- [ ] Old Lovable Cloud project marked read-only or archived after 7-day soak.
- [ ] `docs/MIGRATION_READINESS.md` updated with cutover date.
- [ ] Follow-up ticket: refactor `promotions.image_url` + store photo columns to reference `attachments.id` (see approved plan, steps 3–4).
