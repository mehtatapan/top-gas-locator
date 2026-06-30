
# Careers Portal + SEO/Branding Fix

A large feature. Splitting into two tracks so we can ship incrementally and confirm a few choices before building the backend.

---

## Track A — Frontend Careers Portal

### New route
`/careers` added to `App.tsx`, linked from `Header` nav and `Footer`.

### Page sections (matching existing red / navy / gold brand, font + animations from `Hero`/`Locations`)

1. **Hero** — "Join Our Team" headline, supportive subtitle, "Apply Now" CTA that scrolls to the form. Same visual treatment as the homepage hero (background, gradient, fade-in).
2. **Why Work With Us** — 6 animated cards: Competitive Pay, Flexible Scheduling, Career Growth, Friendly Team, Multiple Locations, Training & Development. Icons from `lucide-react`, staggered scroll-in.
3. **Current Opportunities** — Modular array of positions (Cashier, Assistant Store Manager, Store Manager). Each card: title, short description, employment type badge, "Apply" button that scrolls to the form and pre-selects the role.
4. **Application Form** — Multi-section card (react-hook-form + zod):
   - Personal Info (name, email, phone, address, city, state, ZIP)
   - Employment Info (position dropdown, store location: Fritch / Borger / Spearman / Coulter Amarillo / Western Amarillo, employment type)
   - **Weekly Availability scheduler** — row per day Mon→Sun with `Available` checkbox, Start/End time pickers (12-hour AM/PM), "Available Anytime" toggle that disables time pickers. Time inputs disabled if not available; validates start < end.
   - Available Start Date (shadcn datepicker)
   - Desired Hourly Wage (number)
   - Relevant Experience (textarea)
   - Eligibility (US work auth Yes/No, 18+ Yes/No)
   - Resume upload — drag-and-drop, PDF/DOC/DOCX, ≤10MB, progress bar, filename preview
   - "Why would you be a good fit?" textarea
   - Submit with loading state, disabled-while-submitting, success toast + confirmation panel
5. **SEO** — `react-helmet-async` `<title>`, meta description, canonical, og/twitter tags for `/careers`. JobPosting JSON-LD per open role.

### Components
- `src/pages/CareersPage.tsx`
- `src/components/careers/CareersHero.tsx`
- `src/components/careers/WhyWorkWithUs.tsx`
- `src/components/careers/OpenPositions.tsx`
- `src/components/careers/ApplicationForm.tsx`
- `src/components/careers/AvailabilityScheduler.tsx`
- `src/components/careers/ResumeDropzone.tsx`
- `src/data/positions.ts` (modular list)

---

## Track B — Backend (Google Sheets + Drive + Email)

Requires **Lovable Cloud** (Supabase Edge Functions) for secure server-side credentials. I'll enable it as part of this work.

### Edge function `submit-application`
- Validates payload with zod
- Generates Application ID + timestamp
- Uploads resume to Google Drive folder, renames `YYYY-MM-DD_First_Last_Position_Location.ext`, returns shareable link
- Appends row to Google Sheet with all fields (availability serialized as `Mon 9:00 AM–5:00 PM | Tue Off | ...`)
- Sends applicant confirmation email + hiring-team notification email
- Returns `{ applicationId }`

### Credentials needed (I'll request via secrets tool after you approve)
- `GOOGLE_SERVICE_ACCOUNT_JSON` — service account with Drive + Sheets access
- `GOOGLE_DRIVE_FOLDER_ID` — destination resume folder (share folder with the service account email)
- `GOOGLE_SHEET_ID` — destination spreadsheet (share with the service account email, headers pre-created or auto-created on first run)
- `HIRING_TEAM_EMAIL` — recipient for notifications
- Email provider: **Resend** (recommended; needs `RESEND_API_KEY` + verified sender domain, or use `onboarding@resend.dev` for testing)

---

## Track C — SEO + Branding Fix

- Replace favicon with VT logo (`public/favicon.png` from `vt-logo-transparent.png`), delete `public/favicon.ico` if present.
- `index.html`: remove any Lovable defaults; set proper `<title>`, description, canonical, `og:title/description/image/url`, `twitter:card` using VT branding. Use the transparent logo as og:image (1200×630 brand card — I'll generate one).
- Confirm `LocalBusinessSchema` uses VT logo URL.
- Add Careers JSON-LD (`JobPosting`) via Helmet on `/careers`.
- Run SEO scan after deploy.

---

## Questions before I build Track B

1. **Email provider** — OK to use **Resend** (Lovable's recommended)? If yes I'll add the connector and you provide the API key + sender domain (or we use the test sender).
2. **Google credentials** — Do you already have a Google Cloud service account with Drive + Sheets API enabled? If not, I'll give you a 5-step setup guide before requesting the JSON.
3. **Hiring team email address** — what address should receive notifications?
4. **OG share image** — OK if I generate a 1200×630 branded image using the VT logo + tagline?

---

## Build order
1. Enable Lovable Cloud
2. Track A (frontend) — fully working with a stub submit that shows success
3. Track C (SEO/branding fix) + SEO scan
4. Track B (backend wiring) once you've answered the 4 questions and provided credentials
