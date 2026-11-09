# Etijah Travel & Tourism — website

Corporate website for **الاتجاه للسياحة والسفر / Etijah Travel & Tourism** (Najaf, Iraq).
Arabic-first (RTL) at `/`, English (LTR) at `/en/`.

It includes a travel offers system:

- **Public offers** (`/programs/`, `/en/programs/`): holiday packages and fixed-date group tours, program pages, hotel pages and a three-step booking request.
- **Staff portal** (`/staff/`): programs, groups and seats, hotels, destinations, services, traveler requests, companies, B2B quotes, users and settings, with role-based permissions.
- **B2B quotes**: private quote pages on secret links (`/q/<token>/`) with accept / request-changes, and a PDF generator whose hotel names stay clickable links.

**Stack:** Next.js 16 (App Router, Node.js server) · React 19 · Tailwind CSS 4 · GSAP 3 + ScrollTrigger · Lenis · Three.js · Lucide icons · Cairo (self-hosted via `next/font`) · SQLite (Node's built-in `node:sqlite`) · zod · sharp · playwright-core (PDF rendering).

## Quick start

Requires **Node.js 22.13 or later** (built-in SQLite; tested on Node 26) and, for PDFs, an installed **Microsoft Edge or Google Chrome**.

```bash
npm install
npm run db:migrate                     # creates data/etijah.db (also happens automatically on first request)
npm run staff:create -- --email you@example.com --name "اسم الموظف" --role admin
npm run dev                            # http://localhost:3101  (staff portal: /staff/)
```

`staff:create` prints a strong temporary password **once** when `--password` is omitted (only its scrypt hash is stored, so it cannot be looked up later). Roles: `admin`, `sales`, `content`.

| Task | Command |
| --- | --- |
| See existing accounts (email, role, last login) | `npm run staff:list` |
| Forgotten password / locked out | `npm run staff:reset-password -- --email you@example.com` |
| Re-enable a deactivated account at the same time | add `--activate` |

A reset only replaces the password: the account, its role and all data stay; failed-login lockout is cleared and the account's open sessions are signed out. The CLI reads `.env*` files like Next.js, so it always works on the same database as the server (it prints the file it uses). After signing in, change the password from «حسابي», and the account's name and email from «المستخدمون والصلاحيات».

## Deploying

The site now needs a Node.js server (the database, staff portal, quotes and PDFs run on the server). The home pages are still fully prerendered; their "latest offers" strip loads from `/api/programs/featured/` in the browser, so the build never depends on the database.

1. Create `.env.production.local` from `.env.example`. At minimum set `NEXT_PUBLIC_SITE_URL=https://www.your-domain.com` (canonical URLs, sitemap, and the "online version" link inside quote PDFs).
2. `npm ci && npm run build`
3. `npm run db:migrate` and create the first admin with `npm run staff:create`.
4. `npm start` (port 3101) under a process manager (PM2, systemd, Windows service), behind a reverse proxy with HTTPS (Apache `mod_proxy`, Nginx, IIS). Forward `Host`/`X-Forwarded-Host` and `X-Forwarded-Proto`.
5. Back up `data/` (database) and `storage/media/` (uploaded images). `storage/pdf-cache/` can be deleted at any time.

**PDFs on Linux servers:** install Chromium (`PDF_BROWSER_PATH=/usr/bin/chromium`) or Chrome (`PDF_BROWSER_CHANNEL=chrome`), plus an Arabic system font for the page footer (e.g. `fonts-noto-core`). The document body uses the site's Cairo font.

**Apache example** (XAMPP or shared hosting with `mod_proxy`):

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass        / http://127.0.0.1:3101/
ProxyPassReverse / http://127.0.0.1:3101/
```

**Sub-folder hosting** (e.g. `/etijah/`): set `NEXT_PUBLIC_BASE_PATH=/etijah` in `.env.production.local` (not on the command line: Git Bash on Windows rewrites `/etijah` into a Windows path) and rebuild.

## Editing content

| What | Where |
| --- | --- |
| Offers, groups, hotels, destinations, services, prices | Staff portal (`/staff/`) |
| Currencies, default quote terms and validity | Staff portal → الإعدادات (admin) |
| Phone numbers, WhatsApp, social links, address, map pin, email, domain | `src/content/site.ts` |
| Partner logos (names, order, optical size tweaks) | `src/content/partners.ts` |
| Arabic / English site copy | `src/content/ar.ts`, `src/content/en.ts` |
| Offers pages and booking flow copy | `src/content/travel.ts` |
| Quote page and PDF copy | `src/content/quote.ts` |
| Brand colours & typography tokens | `src/app/globals.css` (`@theme`) |
| Logo symbol (vector) | `src/components/brand/etijah-mark.ts` |

Every WhatsApp link (general, per service, per destination, booking form) is built from `site.whatsapp.number`.

## Travel offers system

### Data model (`db/migrations/`)

SQL migrations run automatically, in order, once each (`schema_migrations` records them). Money is stored as integer minor units; content is bilingual (`*_ar` required, `*_en` optional with Arabic fallback).

| Area | Tables |
| --- | --- |
| Staff & security | `staff_users`, `staff_sessions`, `rate_limits`, `audit_log`, `settings`, `counters` |
| Catalog | `destinations`, `hotels`, `hotel_media`, `services`, `media` |
| Programs | `programs`, `program_destinations`, `program_media`, `program_days`, `program_hotels`, `program_services`, `program_prices`, `departures` |
| Traveler requests | `leads`, `lead_events` |
| B2B | `companies`, `company_contacts`, `quotes`, `quote_days`, `quote_hotels`, `quote_items`, `quote_media`, `quote_events` |

Reference numbers: programs `PRG-0001`, group dates `GRP-2026-001`, requests `REQ-2026-00001`, quotes `QT-2026-0001`.

### Permissions

| Role | Can |
| --- | --- |
| `admin` | Everything, including deleting, users and settings |
| `content` | Programs, groups, hotels, destinations, services; publish/pause/archive; view requests |
| `sales` | Traveler requests, companies and quotes (incl. internal costs); add hotels; view programs |

Checks run on the server in every page, server action and route handler (`src/server/auth/session.ts`, `src/lib/permissions.ts`); `src/proxy.ts` only redirects visitors without a session cookie to the login page.

### Security notes

- Passwords: scrypt; per-account lockout (5 failures → 15 min) and per-IP throttling. Sessions are random tokens stored hashed, `HttpOnly`, `SameSite=Lax`, `Secure` behind HTTPS.
- Server actions: Next.js origin check (CSRF) + zod validation; URLs accept only `http(s)`; the upload API also checks the origin.
- Uploads: max 12 MB, decoded and re-encoded to WebP by sharp (metadata stripped), stored outside `public/`, served by `/media/<uuid>-<width>.webp`.
- Quotes: 256-bit random link tokens that can be revoked, regenerated or given an expiry. Drafts, revoked and expired links return 404. Quote pages send `noindex` and `no-referrer` (the token never leaks to hotel sites). Client views are counted from the browser, so WhatsApp link previews don't count.
- Internal costs, margins and internal notes are only in the staff editor. Client pages and PDFs are built from an explicit whitelist (`buildQuoteView`).
- Public request form: server-side validation, honeypot field, minimum fill time and per-IP rate limit.

### PDFs

`/q/<token>/pdf/` renders the print layout (`/q/<token>/print/`, also the on-screen PDF preview) in headless Edge/Chrome. Hotel names, phone, WhatsApp, map and the online quote link are real link annotations in the PDF. Files are cached per quote version in `storage/pdf-cache/`. If no browser is available, the route returns a clear message and the preview page can still be printed to PDF from any browser.

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

## Testing

```bash
npm run typecheck && npm run lint
npm run build
npm run test:smoke     # marketing pages: RTL/LTR, links, motion, mobile menu, form, reduced motion, WebGL off, 404
npm run test:e2e       # offers system end to end (see below)
```

Both start `next start` on a free port with a **temporary database** (your data is never touched) and drive an installed Edge (`BROWSER_CHANNEL=chrome` for Chrome). `npm run test:e2e -- --dev` uses `next dev` instead.

The e2e test logs in as staff, creates a destination, hotels (with real uploads), a group program with prices, itinerary, services and a departure, publishes it, checks the public pages (filters, hotel links, JSON-LD, English, mobile), sends a booking request through all three steps, confirms it in the portal (seats update), builds a company quote from the program with discount, internal cost and optional service, sends it, opens it as the client, downloads the PDF and verifies its hotel link annotations, accepts it, revokes the link, and checks roles and security headers.

Screenshots and the generated PDF are written to `.smoke/`.

## Open items for the company

- **Email:** the address supplied was `etijah.etijah.net`. It has no `@`, so it isn't a valid email, and `etijah.net` currently has no working DNS. Set `site.email` once confirmed, and email links appear across the site automatically. Quotes are sent by WhatsApp, the staff member's email app (`mailto:`), or by copying the secure link; automatic sending by email would need an SMTP or email-API account.
- **Domain:** `etijah.net` is registered (GoDaddy, renews 2027-10) but its nameservers don't answer. Once the site is live, set `NEXT_PUBLIC_SITE_URL`.
- **Name order:** the brief says «الاتجاه للسياحة والسفر», while the logo and the Google Maps listing say «للسفر والسياحة». The logo lockup follows the logo; site copy follows the brief.
- **Street name:** please confirm the Arabic spelling «شارع الغدير كرامة» (`site.address.streetAr`).
- **Photography:** destination and hero photos are from Unsplash (free licence, credited in the footer). Program and hotel photos are uploaded by staff; use photos you have the rights to.
- **Logo source:** the website symbol was vectorised from the supplied logo (`assets/brand/`). If an original vector file (AI/SVG/PDF) exists, replace `src/components/brand/etijah-mark.ts` with its paths and rerun `npm run icons && npm run og`.
