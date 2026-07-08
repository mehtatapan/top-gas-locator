# Environment Variables

## Frontend (Vite, browser-exposed)

| Variable | Source | Consumer |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase project | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project | typed client + edge-function URL construction |
| `VITE_GOOGLE_MAPS_BROWSER_KEY` | Google Cloud Console | `src/components/LocationsMap.tsx` |
| `VITE_GOOGLE_MAPS_TRACKING_ID` | Google Cloud Console (optional) | `src/components/LocationsMap.tsx` |

## Backend (Vercel serverless functions)

| Variable | Source | Consumer |
|---|---|---|
| `SUPABASE_URL` | Supabase project | `api/_lib/supabase-admin.ts`, `api/_lib/auth.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project (Settings → API) | `api/_lib/supabase-admin.ts` |
| `SUPABASE_ANON_KEY` | Supabase project | `api/_lib/auth.ts` (fallback) |
| `SUPABASE_JWKS` | `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` | `api/_lib/auth.ts` JWT verification |
| `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console | `api/_lib/google.ts` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console | `api/_lib/google.ts` |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Manual OAuth playground for `vtgmaudit@gmail.com` | `api/_lib/google.ts` |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder URL | `api/_lib/drive-uploader.ts`, `api/submit-application.ts` |
| `GOOGLE_SHEET_ID` | Sheet URL | `api/submit-application.ts` |
| `RESEND_API_KEY` | Resend dashboard | `api/submit-application.ts` |
| `HIRING_EMAIL` | HR mailbox | `api/submit-application.ts` |

## Removed on cutover

| Old variable | Reason |
|---|---|
| `LOVABLE_API_KEY` | No Lovable AI Gateway calls in this app |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Unused — the OAuth refresh-token flow is the only path |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` | Renamed to `VITE_GOOGLE_MAPS_BROWSER_KEY` |
| `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` | Renamed to `VITE_GOOGLE_MAPS_TRACKING_ID` |

The frontend reads the new names first and falls back to the old names for one release cycle. Once Vercel is set with the new names, the fallback lines can be removed.

## Where to set them

- **Vercel Project → Settings → Environment Variables** — all of the above.
- Never commit real values to `.env`. `.env.example` is the shape.
