# Standalone Supabase Migration Bundle

Replay this bundle against a fresh Supabase project to reproduce the full VT Gas & Market schema, RBAC, RLS, triggers, and seed data with **zero Lovable Cloud dependencies**.

## Contents

| File | Purpose |
|---|---|
| `01_full_schema.sql` | Consolidated schema: extensions, tables, functions, triggers, RLS, grants, seed RBAC & reference data. Concatenated from `supabase/migrations/*` in chronological order. |
| `99_cleanup_storage.sql` | Optional. Deletes the three unused Supabase Storage buckets (`resumes`, `promotion-images`, `location-photos`). Only needed if a previous deploy created them. |

## How to run

Get the direct Postgres connection string from **Project Settings → Database → Connection string (URI)** in your new Supabase project, then:

```bash
export DATABASE_URL='postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations-standalone/01_full_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations-standalone/99_cleanup_storage.sql   # optional
```

## Order of operations for a full cutover

1. Create the new Supabase project.
2. Run `01_full_schema.sql`.
3. **Do not** create any Storage buckets. Google Drive is the document layer.
4. Follow `docs/AUTH_MIGRATION.md` to move users and profile rows across.
5. Update Vercel env vars per `docs/ENV_VARS.md`.
6. Redeploy the Vercel app and smoke-test login + `/api/uploads`.

## Portability guarantees

The schema uses only stock Postgres + Supabase Auth (`auth.uid()`). It does **not** depend on:

- `vault`, `pg_net`, `pg_cron`, or any Cloud-only extension
- Supabase Edge Functions (none exist in the project — all server code is Vercel functions under `api/`)
- Lovable Cloud secrets, connectors, or the Lovable API gateway

## Adding future changes

Once the bundle has been deployed, treat `01_full_schema.sql` as the baseline. New schema changes belong in numbered follow-up files (`10_*.sql`, `11_*.sql`, …) — do **not** edit the baseline.
