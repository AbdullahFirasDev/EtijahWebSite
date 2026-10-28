# Etijah Travel & Tourism — website

Corporate website for **الاتجاه للسياحة والسفر / Etijah Travel & Tourism** (Najaf, Iraq).
Arabic-first (RTL) at `/`, English (LTR) at `/en/`.

**Stack:** Next.js 16 (App Router, static export) · React 19 · Tailwind CSS 4 · GSAP 3 + ScrollTrigger · Lenis · Three.js · Lucide icons · Cairo (self-hosted via `next/font`).

The build output is plain HTML/CSS/JS in `out/`, so it runs on any static host: Apache/XAMPP, Nginx, Vercel, Netlify, etc. No server or database is required.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  (use "localhost", not 127.0.0.1, in dev)
npm run build        # static site → out/
npm start            # preview out/ at http://127.0.0.1:3000
```

## Deploying

1. Create `.env.production.local` from `.env.example` and set the public domain:
   ```
   NEXT_PUBLIC_SITE_URL=https://www.your-domain.com
   ```
   This turns on canonical URLs, hreflang alternates, Open Graph images, the absolute sitemap and the `url`/`logo` fields in the structured data. Without it, those are left out rather than pointing at a wrong address.
2. Run `npm run build`.
3. Upload **the contents of `out/`** to the web root. `out/.htaccess` configures Apache (404 page, compression, caching, security headers).

**Sub-folder hosting** (e.g. `http://localhost/etijah/` in XAMPP): also set `NEXT_PUBLIC_BASE_PATH=/etijah`, rebuild, copy `out/` to `htdocs/etijah/`, and change `ErrorDocument` in `.htaccess` to `/etijah/404.html`. Put env values in `.env.production.local` rather than on the command line, because Git Bash on Windows rewrites `/etijah` into a Windows path.

## Editing content

| What | Where |
| --- | --- |
| Phone, WhatsApp, address, map pin, email, domain | `src/content/site.ts` |
| Arabic copy | `src/content/ar.ts` |
| English copy | `src/content/en.ts` |
| Brand colours & typography tokens | `src/app/globals.css` (`@theme`) |
| Logo symbol (vector) | `src/components/brand/etijah-mark.ts` |

Every WhatsApp link (general, per service, per destination, booking form) is built from `site.whatsapp.number`.

## Asset pipelines

Source files live in `assets/`; generated files are committed.

| Command | Does |
| --- | --- |
| `npm run images` | `assets/images/*.jpg` → responsive AVIF/WebP in `public/images/` + `src/data/images.json` (sizes and blur placeholders) |
| `npm run globe` | Land-dot data for the 3D globe + its static fallback image |
| `npm run icons` | Favicon, Apple touch icon, PWA icons and `public/brand/etijah-mark.svg` from the logo symbol |
| `npm run og` | Open Graph share images (`public/og/`), rendered in Edge/Chrome |

To swap a photo, replace the file in `assets/images/` (keep the name) and run `npm run images`.

## How the site works

- **Contact without a backend:** the booking form validates input, then opens WhatsApp with a structured, prefilled message. The confirmation says the message is ready in WhatsApp; it never claims anything was sent.
- **Motion:**
  - **Hero entrance:** pure CSS, so content never waits for JavaScript.
  - **GSAP:** drives the plane/contrail loop, scroll reveals, parallax and the "How it works" flight path.
  - **Lenis:** smooth wheel scrolling on desktop pointers only, synced to ScrollTrigger.
  - **Reduced motion:** with `prefers-reduced-motion`, everything is static and fully visible.
- **3D globe:** Three.js is lazy-loaded only on capable, larger screens (not with reduced motion, Save-Data, low memory, or missing WebGL), renders only while visible, and is disposed on unmount. Everyone else sees a matching pre-rendered image.
- **SEO:**
  - Arabic and English metadata, Open Graph/Twitter tags.
  - `TravelAgency` (LocalBusiness) JSON-LD.
  - `robots.txt`, `sitemap.xml` and a web manifest.

## Testing

```bash
npm run typecheck && npm run lint
npm run build && npm run test:smoke      # uses installed Edge (BROWSER_CHANNEL=chrome for Chrome)
```

The smoke test drives a real browser against `out/` and checks:

- RTL/LTR, metadata, contact links (tel, WhatsApp, Maps), anchors and console errors.
- Desktop and mobile layouts, plus the mobile menu (focus trap, Escape).
- Booking-form validation and the WhatsApp handoff.
- Reduced motion, a browser with WebGL disabled, and the 404 page.

Screenshots are written to `.smoke/`.

## Open items for the company

- **Email:** the address supplied was `etijah.etijah.net`. It has no `@`, so it isn't a valid email, and `etijah.net` currently has no working DNS. Set `site.email` once confirmed, and email links appear across the site automatically.
- **Domain:** `etijah.net` is registered (GoDaddy, renews 2027-10) but its nameservers don't answer. Once the site is live, set `NEXT_PUBLIC_SITE_URL`.
- **Name order:** the brief says «الاتجاه للسياحة والسفر», while the logo and the Google Maps listing say «للسفر والسياحة». The logo lockup follows the logo; site copy follows the brief.
- **Street name:** please confirm the Arabic spelling «شارع الغدير كرامة» (`site.address.streetAr`).
- **Not shown on purpose:** opening hours, social accounts, prices, statistics and testimonials (none were provided). Add them only when verified.
- **Photography:** destination and hero photos are from Unsplash (free licence, credited in the footer). Replace them with the company's own photos when available.
- **Logo source:** the website symbol was vectorised from the supplied logo (`assets/brand/`). If an original vector file (AI/SVG/PDF) exists, replace `src/components/brand/etijah-mark.ts` with its paths and rerun `npm run icons && npm run og`.
