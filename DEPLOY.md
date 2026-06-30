# Deploy to Vercel

This project is a Vite + React frontend with Vercel Serverless Functions in `/api`.
Frontend and backend deploy together as a single Vercel project. No CORS needed.

## 1. Import the repo into Vercel

1. Push to GitHub.
2. https://vercel.com/new → import the repo.
3. Framework preset: **Vite** (auto-detected). Leave build settings as-is.

## 2. Environment variables (Project Settings → Environment Variables)

| Name | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | minted via OAuth Playground as vtgmaudit@gmail.com |
| `GOOGLE_DRIVE_FOLDER_ID` | `16-asEBZNWGfOLfxWWcK5fc9vLCIaClPb` |
| `GOOGLE_SHEET_ID` | `1NoLp9X-YveVBTKNzlPxBEAE0M9G3HqtLVk40wfESl-U` |
| `RESEND_API_KEY` | from resend.com dashboard |
| `HIRING_EMAIL` | `vtgmhr@gmail.com` |

Apply each to **Production**, **Preview**, and **Development**. Redeploy after adding.

## 3. Custom domain

In Vercel → Project → Settings → Domains, add `www.vtgasandmarket.com` and `vtgasandmarket.com`.

At Hostinger DNS:
- Remove old GitHub Pages A records (`185.199.108.153`, etc.) and the GH Pages CNAME on `www`.
- Add the records Vercel shows (typically an A record `@ → 76.76.21.21` and CNAME `www → cname.vercel-dns.com`).
- Propagation: minutes to a few hours. Vercel auto-issues SSL.

## 4. Verify

- Visit `https://www.vtgasandmarket.com/careers`.
- Submit a test application.
- Check: Drive folder has the resume, Sheet has a new row, both emails arrive.

## 5. Decommission GitHub Pages

After Vercel is serving the domain, disable GitHub Pages in repo Settings → Pages.

## Local development

```bash
bun install
cp .env.example .env.local   # fill in values
bunx vercel dev              # runs frontend + /api together
```
