# Auth Migration Runbook — Lovable Cloud Supabase → Standalone Supabase

Migrates all users and their password hashes to a new Supabase project **without** forcing a password reset. All UUIDs are preserved so every foreign key (`profiles.id`, `user_roles.user_id`, `attachments.uploaded_by`, `audit_logs.actor_id`, `tickets.reporter_id`, …) resolves on the new project.

## Pre-flight

- New Supabase project provisioned.
- `psql` and `curl` available locally.
- Two connection strings: `OLD_DB_URL` (current Lovable Cloud project) and `NEW_DB_URL` (fresh project). Get them from Project Settings → Database → Connection string (URI).
- Service-role keys: `OLD_SERVICE_ROLE_KEY`, `NEW_SERVICE_ROLE_KEY`.
- Project URLs: `OLD_SUPABASE_URL`, `NEW_SUPABASE_URL`.

## Step 1 — Apply schema to the new project

```bash
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f migrations-standalone/01_full_schema.sql
```

Then **temporarily disable** the two `auth.users` triggers so the user import doesn't try to create profile rows twice:

```sql
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;      -- handle_new_user
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_bootstrap;    -- bootstrap_first_admin
```

(Trigger names may differ — check `\dS auth.users` and adjust.)

## Step 2 — Export users from the old project

Supabase Admin API paginates 1000 at a time:

```bash
curl -s -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
     -H "apikey: $OLD_SERVICE_ROLE_KEY" \
     "$OLD_SUPABASE_URL/auth/v1/admin/users?per_page=1000&page=1" > users.json
```

Repeat for additional pages if `total > 1000`.

## Step 3 — Import users into the new project

Each user is re-created with the **same `id`**, same email, same confirmed timestamp, and the **existing bcrypt `password_hash`** — so passwords survive.

```bash
jq -c '.users[]' users.json | while read u; do
  id=$(echo "$u"          | jq -r '.id')
  email=$(echo "$u"       | jq -r '.email')
  hash=$(echo "$u"        | jq -r '.encrypted_password')
  confirmed=$(echo "$u"   | jq -r '.email_confirmed_at')
  meta=$(echo "$u"        | jq  '.user_metadata')

  curl -s -X POST -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" \
       -H "apikey: $NEW_SERVICE_ROLE_KEY" \
       -H "Content-Type: application/json" \
       "$NEW_SUPABASE_URL/auth/v1/admin/users" \
       -d "$(jq -n --arg id "$id" --arg email "$email" --arg hash "$hash" \
                    --arg confirmed "$confirmed" --argjson meta "$meta" \
             '{id:$id, email:$email, password_hash:$hash, email_confirm:true,
               email_confirmed_at:$confirmed, user_metadata:$meta}')"
done
```

> Notes
> - The `password_hash` field on `POST /auth/v1/admin/users` accepts Supabase's bcrypt strings verbatim. No re-hashing needed.
> - If an account uses OAuth (Google), the OAuth identity must be re-linked on first sign-in; the base user row still imports fine.

## Step 4 — Copy public data

Preserve UUIDs. Simplest path is `pg_dump --data-only` per table in dependency order:

```bash
for t in profiles roles permissions role_permissions user_roles stores store_managers \
         drive_folders attachments audit_logs \
         promotions employees vendors vendor_contracts equipment \
         tickets ticket_comments ticket_history ticket_assignments \
         compliance_checklists compliance_items compliance_runs compliance_responses \
         fuel_products fuel_tanks fuel_inventory_readings fuel_deliveries fuel_orders \
         gaming_periods gaming_transactions gaming_manual_payouts gaming_reports \
         lottery_games lottery_shifts lottery_transactions \
         atm_machines atm_reports atm_cash_events \
         pnl_entries expense_categories revenue_categories \
         payroll_periods payroll_entries shifts time_entries \
         maintenance_schedules maintenance_tasks vendor_contacts \
         report_definitions report_snapshots \
         ticket_categories categories notifications email_queue; do
  pg_dump "$OLD_DB_URL" --data-only --no-owner --no-acl -t "public.$t" \
    | psql "$NEW_DB_URL" -v ON_ERROR_STOP=1
done
```

If a table has `handle_new_user`-created rows already (from step 3's user inserts), truncate the destination first: `TRUNCATE public.<t> CASCADE;`.

## Step 5 — Re-enable triggers

```sql
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_bootstrap;
```

## Step 6 — Update Vercel env vars

Per `docs/ENV_VARS.md`, swap the following on Vercel and redeploy:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `SUPABASE_JWKS` — fetch from `https://<new-project>.supabase.co/auth/v1/.well-known/jwks.json`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

## Step 7 — Smoke test

1. Log in with an existing user (password should just work).
2. Upload a promo image via the admin UI — confirms `/api/uploads`, JWKS verification, and Drive OAuth all wired.
3. Submit a test job application — confirms Sheets + Resend paths.
4. Spot-check RLS: sign in as a non-admin and confirm they only see their store's data.

## Rollback

Leave the old Lovable Cloud project running until step 7 passes. Cutover is nothing more than the Vercel env-var swap — revert the vars to roll back.
