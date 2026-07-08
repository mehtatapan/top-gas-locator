# Google Drive Document Architecture

Google Drive is the **permanent** file layer for this application. Supabase only stores metadata. This document is the contract every future module must follow.

## Folder layout

Everything is created under the single root folder `GOOGLE_DRIVE_FOLDER_ID`:

```
VT Gas & Market/
├── Careers/{position}/{storeLocation}/          resumes
├── promotions/                                  promo images
├── location-photos/{storeSlug}/{slot}/          store hero/gallery photos
└── {future-module}/{...subPath}/                (add new modules by picking a folder name)
```

Folders are created on demand by `api/_lib/drive-uploader.ts::ensureFolderPath()` and cached in `public.drive_folders (path → drive_folder_id)` so a repeat upload skips the Drive lookup.

## Metadata contract: `public.attachments`

Every uploaded file has one row here:

| Column | Purpose |
|---|---|
| `id` | Primary key referenced by business tables |
| `module` | Logical bucket (`promotions`, `location-photos`, `careers`, …) |
| `entity_type`, `entity_id` | Polymorphic pointer back to the owning row |
| `store_id` | Scope-to-store link when applicable |
| `drive_file_id` | Google Drive file id (the source of truth) |
| `drive_folder_id`, `drive_folder_path` | Where the file lives in Drive |
| `web_view_link` | Drive's browser viewer URL |
| `name`, `mime_type`, `size_bytes` | File metadata |
| `uploaded_by` | `auth.uid()` at upload time |
| `deleted_at` | Soft-delete marker |

Business tables should reference `attachments.id` (e.g. `promotions.image_attachment_id`) rather than storing Drive URLs directly. The URL for `<img src>` is built client-side from `drive_file_id` via `src/lib/drive.ts::driveThumbUrl()`.

## Upload endpoints

- `POST /api/uploads` — authenticated, generic, used by the admin UI (`ImageUpload` component). Requires the `uploads.create` permission. Body: multipart with `file`, `module`, optional `entityId` / `entityType` / `storeId` / `subPath` / `public=true`.
- `DELETE /api/uploads?id=<attachmentId>` — hard-deletes the Drive file, soft-deletes the attachment row, writes an audit log entry.
- `POST /api/submit-application` — public, resume upload for the careers form. Writes to Drive + appends a Sheets row + sends Resend emails.

Both endpoints run on Vercel — no Supabase Edge Functions are involved.

## Adding a new module (3-step recipe)

1. Pick a `module` name (e.g. `"vendor-contracts"`). No table changes required.
2. In the UI, use `<ImageUpload module="vendor-contracts" subPath={vendorId} entityId={vendorId} entityType="vendors" />` — or any component that POSTs to `/api/uploads` with the same fields.
3. On the business table, store the returned `attachment.id` (e.g. `vendor_contracts.file_attachment_id uuid references attachments(id)`). Read the file by joining `attachments` and calling `driveThumbUrl(row.drive_file_id)` or linking to `row.web_view_link`.

## Rules

- **Never** call `supabase.storage.*` from any code. Business files always go through `/api/uploads`.
- **Never** hardcode a Drive URL in a business table. Store an `attachment_id` and reconstruct the URL from `drive_file_id`.
- Keep public exposure explicit: set `public=true` on upload only for files that need to render in an `<img>` (promos, location photos). Private docs (contracts, HR files) omit it.
