# VT Gas & Market — Admin Portal Backend Plan

Goal: zero-recurring-cost, production-ready backend. Supabase = auth + Postgres + RLS. Google Drive (existing OAuth as `vtgmaudit@gmail.com`) = all binary files. Resend = email. No Supabase Storage.

---

## 1. Reuse existing Drive uploader

Today's `api/submit-application.ts` uses `api/_lib/google.ts` (OAuth2 refresh token → `googleapis` Drive + Sheets). We'll extract that into a shared service and delete the ad-hoc logic from the careers endpoint.

New shared modules under `api/_lib/`:
- `google.ts` — unchanged (OAuth2 client, `getDrive()`, `getSheets()`).
- `drive-uploader.ts` — one canonical upload API:
  - `ensureFolderPath(pathSegments: string[]): Promise<string>` — walks/creates nested folders under `GOOGLE_DRIVE_ROOT_FOLDER_ID`, caches folder IDs in a new `drive_folders` table so we never re-query Drive for the same path.
  - `uploadStream({ pathSegments, name, mimeType, stream }): Promise<{ fileId, webViewLink, name, mimeType, size }>`
  - `makeAnyoneReader(fileId)`, `deleteFile(fileId)`, `replaceFile(fileId, ...)`.
- `supabase-admin.ts` — server-side Supabase client using service role for audit/log writes from Vercel functions.
- `auth.ts` — verifies the Supabase JWT on every API request and returns `{ userId, roles, permissions }`.

New Vercel endpoints (thin wrappers, all auth-gated):
- `POST /api/uploads` — multipart; body includes `module`, `entityId`, `subPath[]`; returns Drive metadata + inserted `attachments` row.
- `DELETE /api/uploads/:id`
- `GET /api/uploads/:id/link` (fresh signed webViewLink if needed)

Careers endpoint refactored to call `drive-uploader.uploadStream(['Careers', position, storeLocation], …)` — same behavior, no duplicated code.

---

## 2. Drive folder convention

Root: existing `GOOGLE_DRIVE_FOLDER_ID` becomes `VT Gas & Market/`. Auto-created children:

```text
VT Gas & Market/
├── Promotions/{StoreName}/
├── Tickets/Ticket-{number}/
├── Gaming/{StoreName}/{Year}/{Period}/
├── Profit-and-Loss/{Year}/{Month}/
├── Equipment/{StoreName}/
├── Maintenance/{StoreName}/{Year}/
├── Receipts/{Year}/{Month}/
├── Employees/{EmployeeId}/
└── Careers/{Position}/{StoreName}/   (existing)
```

`drive_folders(path text unique, drive_id text)` caches created folder IDs — first upload creates the branch, subsequent uploads hit the cache.

---

## 3. Supabase schema (metadata + business data only)

### Auth & RBAC

```text
profiles(id=auth.users.id, full_name, phone, avatar_drive_file_id, active)
roles(id, key unique, name, description)                     -- super_admin, owner, regional_manager, store_manager, employee
permissions(id, key unique, description)                     -- e.g. tickets.create, gaming.close_period, pnl.edit
role_permissions(role_id, permission_id)                     -- many-to-many
user_roles(user_id, role_id, store_id nullable)              -- role optionally scoped to a store
```

Security-definer helpers (avoid RLS recursion):
- `has_role(_uid, _role_key) returns bool`
- `has_permission(_uid, _perm_key) returns bool`
- `user_store_ids(_uid) returns setof uuid` — stores the user can access (super_admin/owner → all).

### Core

```text
stores(id, slug unique, name, city, state, address, phone, active, meta jsonb)
store_managers(store_id, user_id)      -- optional convenience

attachments(                            -- SINGLE table used by every module
  id, module text, entity_type text, entity_id uuid,
  drive_file_id text, drive_folder_id text, name, mime_type, size_bytes,
  web_view_link, uploaded_by=auth.users.id, uploaded_at, deleted_at)
```

### Tickets (Jira-style)

```text
ticket_categories(id, key, name)
tickets(id, number serial, title, description, status enum, priority enum,
        category_id, store_id, created_by, assignee_id, due_at, closed_at)
ticket_comments(id, ticket_id, author_id, body, created_at)
ticket_assignments(id, ticket_id, assignee_id, assigned_by, assigned_at, unassigned_at)
ticket_history(id, ticket_id, actor_id, field, old_value, new_value, created_at)
-- attachments via attachments(module='tickets', entity_id=ticket.id)
```

### Promotions

```text
promotions(id, store_id, title, description, starts_at, ends_at, status, banner_attachment_id)
```

### Gaming

```text
gaming_periods(id, store_id, period_start, period_end, status, opened_by, closed_by)
gaming_transactions(id, period_id, machine_id, type, amount, occurred_at, notes)
gaming_manual_payouts(id, period_id, amount, reason, paid_by, paid_at)
gaming_reports(id, period_id, pdf_attachment_id, generated_at)
```

### Profit & Loss

```text
expense_categories(id, key, name, parent_id)
revenue_categories(id, key, name, parent_id)
pnl_entries(id, store_id, period_month date, kind enum(expense,revenue),
            category_id, amount, memo, entry_date)
-- supporting docs via attachments(module='pnl', entity_id=pnl_entry.id)
```

### Cross-cutting

```text
audit_logs(id, actor_id, module, action, entity_type, entity_id,
           before jsonb, after jsonb, ip, ua, created_at)
notifications(id, user_id, kind, title, body, link, read_at, created_at)
email_queue(id, to_email, template, payload jsonb, status, attempts, last_error, send_after, sent_at)
```

Indexes on every `store_id`, `entity_id`, `created_at`, `status`, `assignee_id`. `pg_trgm` on ticket title/description for search.

### RLS pattern (uniform)

For every table: `ENABLE RLS` + `GRANT SELECT/INSERT/UPDATE/DELETE … TO authenticated` + `GRANT ALL … TO service_role`.

- `super_admin` / `owner`: full access via `has_role`.
- Store-scoped tables (tickets, promotions, gaming, pnl, attachments with store): `store_id = ANY(user_store_ids(auth.uid()))`.
- Writes gated by `has_permission(auth.uid(), '<module>.<action>')`.
- Employees see only their own tickets/assignments unless permission grants more.
- `audit_logs` insert-only from server (service role); readable by admins.

---

## 4. Auth flow

- Supabase email/password with password reset (`/reset-password` route). Managed Google sign-in **off** by default (owner invites only — no public sign-ups).
- Super admin bootstrapped via migration + secret email.
- Session persisted; `onAuthStateChange` in an `AuthProvider`; protected routes check `has_permission` via a `useCan()` hook backed by an RPC that returns the user's permission keys once per session.

---

## 5. Notifications & email

Reuse existing Resend key. `email_queue` populated by DB triggers (ticket assigned/updated/due, gaming period closed, promotion expiring). A single Vercel cron endpoint (`/api/cron/dispatch-emails`, hourly) drains the queue via Resend. Daily digest = same mechanism with a scheduled row.

---

## 6. Audit logging

Generic Postgres trigger `fn_audit()` attached to write-heavy tables — captures `OLD`/`NEW` as jsonb into `audit_logs` with `auth.uid()`. File uploads/deletes logged from the `/api/uploads` endpoint using service role.

---

## 7. Future modules

The `attachments` + `audit_logs` + `stores` + RBAC primitives cover every listed future module (Fuel, Lottery, ATM, Scheduling, Payroll, Vendors, Assets, Maintenance, Compliance). Adding a module = new table(s) + permission keys + RLS using the same helpers. No redesign.

---

## 8. Build order (after you approve)

1. Migration 1: RBAC (roles, permissions, user_roles, helper functions) + `profiles` + trigger.
2. Migration 2: `stores`, `attachments`, `drive_folders`, `audit_logs`, `notifications`, `email_queue` + RLS + audit trigger.
3. Migration 3: tickets + promotions + gaming + pnl tables + RLS + seed categories.
4. Refactor `api/_lib` — extract `drive-uploader.ts`, add `supabase-admin.ts`, `auth.ts`; refactor careers to use it.
5. New `/api/uploads` endpoint + `useUploader` React hook.
6. `AuthProvider`, login/reset pages, `useCan`, `RequireAuth`, `RequirePerm`.
7. Admin shell (sidebar, layout) at `/admin` — module screens land in later PRs one at a time (Tickets first).
8. Cron endpoint + Vercel `vercel.json` schedule for email dispatch.

---

## Technical notes

- No Supabase Storage anywhere. `attachments.drive_file_id` is the source of truth.
- Drive OAuth stays server-only in Vercel functions; the browser never sees the refresh token.
- Every public-schema table gets `GRANT`s + RLS in the same migration (per project rules).
- Free-tier friendly: no realtime channels enabled unless a screen needs them (tickets board will opt-in).
- All uploads size-capped at 25 MB per file in the endpoint; Drive quota is 15 GB on the connected account — surface usage in an admin settings page later.

Reply **approve** to start with Migration 1 and the uploader refactor, or tell me what to change.