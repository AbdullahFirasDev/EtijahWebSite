# Etijah Travel & Tourism — website & travel platform

Corporate website and travel platform for **الاتجاه للسياحة والسفر / Etijah Travel & Tourism** (Najaf, Iraq).
Arabic-first (RTL) at `/`, English (LTR) at `/en/`.

- **Public offers** (`/programs/`): *fixed* programs (set dates, seats, several hotel options with a clear total price per hotel) and *custom* (tailor-made) programs with a wishes form; hotel pages; independent share links (`/p/<token>/`) with PDF download.
- **Staff portal** (`/staff/`), organised in four sections: **Tourism programs** (7-step program wizard, groups & seats, destinations, central **hotel library** with room types and nightly rates, services, traveler requests) · **B2B companies** (profiles with logo and colours, contacts, partner accounts, hotels and prices per company, quotes, requests & change requests, branded PDFs) · **Airlines & commissions** (airlines, ticket-issuance procedures, versioned company and Etijah commission rules, ticket records, reports with Excel/PDF export) · **Settings & administration** (staff & roles, currencies, company identity, PDF template, audit log).
- **Partner portal** (`/b2b/`): each company user sees only their own company — its identity, the hotels shared with it at its prices, its quotes (accept / request changes) and its requests.
- **Quotes & PDFs**: private quote pages (`/q/<token>/`) for companies (partner identity) or travelers (Etijah identity); one unified A4 template; hotel names stay clickable in every PDF.

**Stack:** Next.js 16 (App Router) on **Vercel** · React 19 · Tailwind CSS 4 · **MongoDB Atlas (official `mongodb` driver)** · **Vercel Blob** (images) · zod · sharp · playwright-core + @sparticuz/chromium (PDF rendering) · GSAP · Lenis · Three.js · Cairo.

Architecture, collections, relations, indexes and the migration design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Hosting: Vercel

The site runs on **Vercel** (Next.js, Node.js functions). There is no local database or local file
storage: data lives in **MongoDB Atlas**, uploaded images in **Vercel Blob**, and PDFs are rendered by
a serverless Chromium (`@sparticuz/chromium`) bundled with the PDF routes.

### First deployment

1. **MongoDB Atlas** — create a cluster (always a replica set, which the app needs for transactions), a
   database user with `readWrite` on the database, and in *Network Access* allow `0.0.0.0/0`
   (Vercel functions have no fixed IPs). Copy the `mongodb+srv://…` connection string.
2. **Vercel project** — push this repository to GitHub/GitLab/Bitbucket and import it in Vercel
   (framework: Next.js, defaults for build and output; Node.js 24 comes from `package.json`).
3. **Vercel Blob** — Project → Storage → Create → *Blob* (choose **Private**), then *Connect Project*.
   `BLOB_READ_WRITE_TOKEN` is added automatically.
4. **Environment variables** (Production and Preview) — see [`.env.example`](.env.example):
   `MONGODB_URI`, `MONGODB_DB_NAME`, `APP_SECRET` (32+ random characters), `NEXT_PUBLIC_SITE_URL`
   once the domain is attached (`BLOB_ACCESS=public` only if the Blob store was created public).
5. **Deploy**, then initialise the database and the first admin from your machine (against Atlas):

   ```bash
   npm i -g vercel && vercel link && vercel env pull .env.local
   npm install
   npm run db:init
   npm run db:seed-geo          # optional: ~690 tourist cities/areas in 64 countries
   npm run staff:create -- --email you@example.com --name "اسم الموظف" --role admin
   ```

   Collections, indexes and reference data are also created automatically on the first request.
6. **Domain** — Project → Settings → Domains, then set `NEXT_PUBLIC_SITE_URL=https://your-domain` and
   redeploy (it is inlined at build time).

Every push to the main branch deploys to production; other branches get preview URLs. For PDFs on
protected preview URLs, enable *Deployment Protection → Protection Bypass for Automation* (the app picks
up `VERCEL_AUTOMATION_BYPASS_SECRET` automatically).

`staff:create` prints a strong temporary password **once** when `--password` is omitted (only its scrypt
hash is stored). Roles: `admin`, `tourism_manager`, `sales`, `accountant`, `content`.

| Task | Command (after `vercel env pull .env.local`) |
| --- | --- |
| Connection, replica set and document counts | `npm run db:check` |
| See staff accounts | `npm run staff:list` |
| Forgotten password / locked out | `npm run staff:reset-password -- --email you@example.com [--activate]` |
| Add the reference cities and tourist areas | `npm run db:seed-geo [-- --dry-run] [-- --country TR,AE]` (or «الدول والوجهات» → «إضافة الكل») |
| Run the site on your machine (same cloud data) | `npm run dev` → http://localhost:3101 |

Partner (company) accounts are created by staff in the company profile → «حسابات المستخدمين».

**Backups:** enable Atlas backups (or `mongodump`); uploaded images are in the Blob store. PDFs are a
per-instance cache in `/tmp` and are regenerated on demand.

## Editing content

| What | Where |
| --- | --- |
| Programs, hotels & rates, destinations, services, groups | Staff portal → البرامج السياحية |
| Companies, partner accounts, company hotels/prices, quotes | Staff portal → الشركات B2B |
| Airlines, issuance procedures, commission rules, tickets, reports | Staff portal → الطيران والعمولات |
| Currencies, quote terms & validity, Etijah identity on documents, PDF template | Staff portal → الإعدادات والإدارة |
| Phone numbers, WhatsApp, social links, address, map pin, domain | `src/content/site.ts` |
| Arabic / English site copy | `src/content/ar.ts`, `src/content/en.ts`, `src/content/travel.ts`, `src/content/quote.ts` |
| Brand colours & typography tokens | `src/app/globals.css` (`@theme`) |

## Travel system

### Programs

- **Fixed** programs: departure airport, airlines and flights, one or more departure dates with seats, several **hotel options** from the library. Price per person for a hotel option = base price (everything except the hotel) + hotel share (night price × nights, divided by room occupancy for per-room rates), or a manual final price (permission `pricing.override`). Each option keeps a **copy of the library rate** it used; changing the library never changes the program unless staff click «تحديث من المكتبة».
- **Custom** programs: no date, no public price; travelers send their wishes (country, dates, days, airport, hotel stars, budget, airline, services). Staff turn the request into a traveler quote (web page + PDF).
- Every program has three exports: **PDF** (Etijah identity, clickable hotel links, no costs), **formatted text** for WhatsApp/Telegram/e-mail, and an **independent link** (`/p/<token>/`) that can be stopped or renewed; unlisted programs are reachable only by that link.

### Destinations and airports

- `src/data/destinations.ts`: reference list of tourist **cities and areas** (resorts, islands, regions, landmarks) for 64 countries (Türkiye, Malaysia, Iran, Azerbaijan, Lebanon, Georgia, Sri Lanka, Jordan, UAE, Egypt, Thailand, France, Tunisia, Maldives, Gulf, Morocco, Europe, Asia, Africa, Americas…), each with Arabic and English names and its nearest airport. Imported into `destinations` by `npm run db:seed-geo` or from the destinations page (per country or all). Importing is additive: an existing destination with the same name (spelling variants such as إسطنبول/اسطنبول count as the same) is kept as staff entered it; only missing type/airport are filled.
- `src/data/airports.ts`: ~310 airports (IATA code, country, Arabic and English names): every Iraqi airport and the airports of those destinations. Staff pick them by name or code in the wizard (departure airport, flight legs) and in destination profiles; the public request form offers the Iraqi departure airports.
- The wizard uses them to save time: choose the country, then the cities in visiting order (or search all countries); nights follow days; **«اقتراح الذهاب والعودة»** fills the outbound and return flights from the departure airport to the destinations' airports; **«تعبئة الأيام»** creates the remaining itinerary days with editable titles from the chosen cities; the hotel picker starts with hotels of the program's cities.
- `npm run test:geo` checks the reference data (unique slugs and codes, Arabic names, every destination airport present).

### Commissions

Two independent, versioned rule sets per airline: what **Etijah** receives from the airline (commission / none / net fare; percent of base or total fare, fixed amount, or another basis) and what each **B2B company** receives. A rate is never edited in place: a new version starts on a date and the previous one is closed the day before; overlaps are refused. Each ticket record copies the rules it used, so history never changes. Reports group totals per airline and company **per currency**.

### Roles

| Role | Scope |
| --- | --- |
| `admin` | everything |
| `tourism_manager` | programs (incl. prices, publishing), hotels & rates, destinations, services, groups, traveler requests |
| `sales` | traveler requests, companies & partner accounts, quotes; reads hotels (incl. costs) and programs |
| `accountant` | airlines, commission rules, ticket records & payments, financial reports |
| `content` | images and texts of programs, destinations, services; publishing — **cannot change prices** |
| company user | own company only, with the permissions staff grant (hotels, requests, view quotes, respond) |

Checked on the server in every page, server action and route handler (`src/server/auth/session.ts`, `src/lib/permissions.ts`, `src/server/actions/guard.ts`); `src/proxy.ts` only redirects visitors without a session cookie.

### Security & data separation

- Passwords: scrypt; lockout (5 failures → 15 min) and per-IP throttling. Staff and partner sessions are separate realms (different cookies), stored hashed, expire through a TTL index.
- A partner user's company always comes from the session, never from the request; every portal query is filtered by it (other companies' records return 404).
- Costs, margins, Etijah commissions and internal notes are never sent to client views: public pages, share links, quote pages, PDFs, text exports and the partner portal are built from whitelisted read models.
- Airline system passwords are never stored: procedures hold only a reference to where the credential is kept; text that looks like a password is refused.
- Sensitive changes (rates, prices, commission rules, tickets and payments, company identity, accounts, settings) are written to the audit log with before/after values (Settings → سجل العمليات).
- Seats are taken with an atomic conditional update in the same transaction as the request confirmation, so concurrent confirmations cannot overbook.

### PDFs

Headless Chromium renders the A4 print pages: quotes (`/q/<token>/pdf/`, partner or Etijah identity), programs (`/staff/programs/<id>/pdf/`, `/p/<token>/pdf/`) and the commission report. Template preview: `/print/brand-sample/?company=<id>`. On Vercel the bundled `@sparticuz/chromium` is used (with an Arabic font from `assets/fonts/` for the page footer); on a developer machine, the installed Edge/Chrome. Files are cached per instance in the temp folder.

## Testing

```bash
npm run typecheck && npm run lint
npm run build
npm run test:geo        # reference cities/airports data integrity
npm run test:e2e        # the 15 acceptance scenarios in a real browser (see below)
npm run test:smoke      # marketing pages
```

Every test creates its own **throw-away database** (`etijah_test_<time>`) on the Atlas cluster from `.env.local` and drops it afterwards (your data is never touched); uploads go to the Blob store. The browser tests drive an installed Edge (`BROWSER_CHANNEL=chrome` for Chrome). `npm run test:e2e -- --dev` uses `next dev` instead of a build.

The e2e test covers: roles and access; airlines and issuance procedures (password guard); Etijah and company commission rules; hotels with room types and rates; a fixed program built in the wizard with three hotels and different prices; the public hotel comparison and a request that keeps the price seen; library price changes not affecting programs or quotes; content editors unable to change prices; text/PDF/link exports and stopping a link; a custom program, its request and the traveler quote; companies with logo/colours and partner accounts; a company quote from the shared library and its branded PDF; portal isolation between two companies; tickets with automatic commissions; rate changes keeping history; importing reference cities (no duplicates), searching destinations, suggested flights and generated itinerary days; reports and Excel/PDF exports; concurrent seat confirmations; no internal data in any client view; the audit log. Screenshots and generated files go to `.smoke/travel/`.

## Asset pipelines

Source files live in `assets/`; generated files are committed.

| Command | Does |
| --- | --- |
| `npm run images` | `assets/images/*.jpg` → responsive AVIF/WebP in `public/images/` + `src/data/images.json` (sizes and blur placeholders) |
| `npm run globe` | Land-dot data for the 3D globe + its static fallback image |
| `npm run icons` | Favicon, Apple touch icon, PWA icons and `public/brand/etijah-mark.svg` from the logo symbol |
| `npm run og` | Open Graph share images (`public/og/`), rendered in Edge/Chrome |
| `npm run partners` | Partner logos in `assets/partners/` → trimmed, white background removed, normalised WebP in `public/partners/` + `src/data/partners.json` |

## How the site works

- **Contact without a backend:** the home page booking form validates input, then opens WhatsApp with a structured, prefilled message. The program pages' «احجز رحلتك الآن» flow is different: it saves the request in the database (reference number, staff follow-up) and then offers WhatsApp.
- **Motion:**
  - **Hero entrance:** pure CSS, so content never waits for JavaScript.
  - **GSAP:** drives the plane/contrail loop, scroll reveals, parallax, the "How it works" flight path and the itinerary progress line on program pages.
  - **Lenis:** smooth wheel scrolling on desktop pointers only (home page), synced to ScrollTrigger.
  - **Partners slider:** two infinite rows in opposite directions, driven by the GSAP ticker; pauses on demand (WCAG 2.2.2) and only runs while on screen.
  - **Reduced motion:** with `prefers-reduced-motion`, everything is static and fully visible.
- **3D globe:** Three.js is lazy-loaded only on capable, larger screens and disposed on unmount. Everyone else sees a matching pre-rendered image.
- **SEO:** metadata and JSON-LD (`TravelAgency`, `TouristTrip` on program pages), hreflang alternates, sitemap with published programs and hotels. `robots.txt` disallows `/staff/`, `/q/` and `/api/`, which also send `X-Robots-Tag: noindex`.

## Open items for the company

- **Email:** the address supplied was `etijah.etijah.net`. It has no `@`, so it isn't a valid email, and `etijah.net` currently has no working DNS. Set `site.email` once confirmed, and email links appear across the site automatically. Quotes are sent by WhatsApp, the staff member's email app (`mailto:`), or by copying the secure link; automatic sending by email would need an SMTP or email-API account.
- **Domain:** `etijah.net` is registered (GoDaddy, renews 2027-10) but its nameservers don't answer. Once the site is live, set `NEXT_PUBLIC_SITE_URL`.
- **Name order:** the brief says «الاتجاه للسياحة والسفر», while the logo and the Google Maps listing say «للسفر والسياحة». The logo lockup follows the logo; site copy follows the brief.
- **Street name:** please confirm the Arabic spelling «شارع الغدير كرامة» (`site.address.streetAr`).
- **Photography:** destination and hero photos are from Unsplash (free licence, credited in the footer). Program and hotel photos are uploaded by staff; use photos you have the rights to.
- **Logo source:** the website symbol was vectorised from the supplied logo (`assets/brand/`). If an original vector file (AI/SVG/PDF) exists, replace `src/components/brand/etijah-mark.ts` with its paths and rerun `npm run icons && npm run og`.
