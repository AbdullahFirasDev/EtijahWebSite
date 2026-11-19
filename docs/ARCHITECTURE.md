# Etijah Travel — System architecture (MongoDB)

Status: implemented on branch `feature/mongodb-restructure`, hosted on **Vercel**. There is no local
runtime environment any more: MongoDB Atlas holds the data, Vercel Blob the uploaded images.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, Server Actions) on **Vercel** (Node.js 24 functions, Fluid Compute) | managed hosting, preview deployments |
| Database | **MongoDB 7+/8** via the official **`mongodb` Node.js driver** (no Mongoose) | the code already validates every input with zod at the action boundary; a second schema layer would duplicate it |
| Topology | **MongoDB Atlas** (always a replica set; connection pool attached with `attachDatabasePool`) | multi-document transactions (seats, quote revisions, ticket + commission snapshots) |
| PDFs | headless Chromium via `playwright-core` + `@sparticuz/chromium` on Vercel (Edge/Chrome on a developer machine); cache in `/tmp` | programs and partner-branded quotes |
| Images | **Vercel Blob** (`media/<uuid>-<width>.webp`), served same-origin by `/media/[file]` with CDN caching | no writable disk on Vercel |
| Tests | each test run creates a throw-away database (`etijah_test_<time>`) on the Atlas cluster and drops it | never touches real data |

Only one database is ever used at runtime. The one-off SQLite → MongoDB migration tool was retired
with the local environment (the old SQLite version stays in git: tag `sqlite-baseline`).

## 2. Conventions

* **IDs**: numeric `_id` for business entities (allocated from the `counters` collection with an
  atomic `$inc`). This keeps every existing ID, URL (`/staff/programs/12/`) and audit reference
  identical after the migration. Logs/events use `ObjectId`. Media keeps its UUID.
* **Money**: integer minor units (× 100) **in the currency stored next to the amount**. No price
  is assumed to be USD. Percentages are basis points (1% = 100).
* **Time**: business timestamps are ISO-8601 UTC strings (lexicographically sortable, same as the
  migrated data); calendar dates are `YYYY-MM-DD`. Only TTL-managed fields (`sessions.expires_at`,
  `rate_limits.at`) are BSON `Date`, because TTL indexes require it.
* **Snapshots**: anything that prices a document (hotel rate in a program/quote, commission rule in
  a ticket) is **copied** into that document. Changing the library later never changes old offers
  or old tickets.
* **Internal vs client data**: costs, margins, our commissions and internal notes live in clearly
  named fields (`cost`, `*_cost`, `internal_notes`, `etijah_commission`). Client views (web, PDF,
  B2B portal, text export) are built by whitelisting read models — never by spreading documents.

## 3. Collections

```
staff_users      {_id:int, name, email↑unique, password_hash, role, active, failed_logins, locked_until, last_login_at}
company_users    {_id:int, company_id→companies, name, email↑unique, password_hash, permissions{…}, active, …}
sessions         {_id:sha256(token), realm:"staff"|"company", user_id, company_id?, expires_at:Date(TTL), last_seen_at, ip_hash, user_agent}
counters         {_id:name, value}
settings         {_id:key, value}
rate_limits      {bucket, key, at:Date(TTL 24h)}
audit_log        {_id:ObjectId, user_id, actor:"staff"|"company"|"system"|"cli", action, entity, entity_id, meta{before,after,…}, created_at}
media            {_id:uuid, original_name, width, height, widths[], blur, bytes, kind:"photo"|"logo", uploaded_by, created_at}

destinations     {_id:int, slug↑, country_code, name_ar, name_en, kind (city|area), airport_code (IATA), ref (reference slug
                  from src/data/destinations.ts when imported), summary_*, cover_media_id, active}
services         {_id:int, icon, name_ar, name_en, sort, active}
hotels           {_id:int, slug↑, destination_id→destinations, country_code (denormalised), name_*, stars, category_*,
                  website_url, maps_url, address_*, description_*, amenities[], contact{phone,email,person}, internal_notes,
                  media[], room_types[{id, name_ar, name_en, max_pax, notes}],
                  rates[{id, room_type_id, board, basis:"per_person"|"per_room", occupancy, currency, cost, price,
                         season_*, valid_from, valid_to, active}],
                  status:"active"|"archived"}
programs         {_id:int, code↑, slug↑, type:"fixed"|"custom", status, visibility:"public"|"unlisted", featured,
                  title_*, summary_*, description_*, destination_ids[], country_codes[] (denormalised),
                  days, nights, currency, departure_airport{code,name_ar,name_en}, airline_ids[], flights[],
                  itinerary[], services[{service_id, included, note_*}], meals_*, terms_*, cover_media_id, gallery[],
                  base_price, base_cost (per person, everything except the hotel),
                  hotel_options[{id, hotel_id, room_type_*, occupancy, board, nights, source:"library"|"custom",
                                 rate_snapshot{rate_id,currency,price,cost,basis,captured_at}, fx_rate,
                                 night_price, night_cost, basis, final_price_override, sort}],
                  extra_prices[{label_*, amount}], price_from (cached), custom_form{…},
                  share{token↑, enabled}, view_count, published_at, created_by, updated_by}
departures       {_id:int, code↑, program_id→programs, depart_date, return_date, seats_total, seats_held,
                  seats_confirmed, price_supplement, status, note_*}
leads            {_id:int, ref↑, kind:"program"|"custom", program_id, departure_id, hotel_option{id,label,price,currency},
                  custom{…travel wishes…}, pax…, contact…, status, assigned_to, seats_counted, quote_ids[]}
lead_events      {_id:ObjectId, lead_id, user_id, kind, body, from_status, to_status, created_at}

companies        {_id:int, name, name_en, …contact…, terms, notes, status,
                  branding{logo_media_id, primary_color, secondary_color, display_name, contact_line},
                  contacts[{id:int, name, position, phone, email, is_primary, notes}],
                  portal{enabled}}
company_hotels   {_id:ObjectId, company_id, hotel_id, rates[{rate_id, room_type_id, board, basis, occupancy, currency, price}], note}
b2b_requests     {_id:int, ref↑, company_id, company_user_id, …trip wishes…, status, quote_id}
quotes           {_id:int, ref↑, token↑, audience:"company"|"traveler", company_id, contact_id, lead_id, b2b_request_id,
                  client{name,phone,email}, beneficiary{name,note}, branding:"company"|"etijah", …content…,
                  hotels[{hotel_id, …, rate{rate_id, source, basis, currency, night_price, night_cost}}],
                  items[{kind,label,unit,quantity,unit_price,unit_cost}], days[], gallery[], status, link…, response…}
quote_events     {_id:ObjectId, quote_id, kind, channel, actor_user_id, actor_label, note, created_at}

airlines         {_id:int, name_ar, name_en, iata↑(partial unique), logo_media_id, country_code, contact{…}, internal_notes,
                  status:"active"|"inactive"|"suspended",
                  issuance{method, method_note, portal_url, email, phone, instructions, documents, booking_request,
                           confirmation, payment, prepayment_required, credit:"none"|"credit"|"balance", credit_note,
                           access_notes, secret_ref}}
commission_rules {_id:int, scope:"etijah"|"company", airline_id, company_id|null,
                  kind:"commission"|"none"|"net_fare", method:"percent"|"fixed", rate_bp, fixed_amount,
                  basis:"base_fare"|"total_fare"|"other", basis_note, currency, settlement, valid_from, valid_to|null,
                  notes, created_by, created_at}           ← immutable rates: a change = a new version
tickets          {_id:int, ref↑, airline_id, company_id|null, ticket_number, pnr, currency, base_fare, taxes, total_fare,
                  service_fee, issue_method, issued_at, staff_id, payment_method, payment_status, paid_amount,
                  company_commission{rule_id, kind, method, rate_bp, basis, amount, overridden, override_reason},
                  etijah_commission{…same…}, net_due, payable_to_airline, etijah_margin, status:"issued"|"void"}
migrations       {_id:"sqlite-import", at, source, counts, checksum}
```

### Indexes (created idempotently on start-up and by `npm run db:init`)

See `src/server/db/schema.ts` — every list/filter in the portal is backed by an index
(e.g. `programs {status, type, updated_at}`, `programs {country_codes, status}`,
`hotels {status, country_code, stars}`, `tickets {company_id, issued_at}`,
`commission_rules {scope, airline_id, company_id, valid_from}`), plus unique keys
(`email`, `slug`, `code`, `ref`, `token`, `{airline_id, ticket_number}`, `{company_id, hotel_id}`)
and TTL indexes for sessions and rate limits.

### Relations

Embedded (owned, bounded, edited together): hotel room types and rates, program itinerary /
hotel options / services, company contacts and branding, quote days / hotels / items,
airline issuance procedure.
Referenced (shared or unbounded): destination ← hotel, hotel ← program option / quote line,
program ← departure ← lead, company ← quote / user / ticket / commission rule, airline ← rule / ticket.

## 4. Concurrency

* **Seats**: `departures.seats_confirmed` is changed only with a conditional atomic update
  (`$expr: seats_held + seats_confirmed + pax <= seats_total`), inside the same transaction as the
  lead status change. Two staff confirming the last seats at once cannot overbook.
* **Counters / references**: `findOneAndUpdate($inc, upsert)` — atomic, gap-tolerant.
* **Multi-document writes** (lead + departure, quote + events, ticket + audit, migration) run in
  `withTransaction` (automatic retry on transient errors).
* **Commission rules** are append-only versions; tickets copy the rule they used.

## 5. Migration (SQLite → MongoDB)

Done once, then retired together with the local environment. Imported databases carry the marker
`{_id: "sqlite-import"}` in `migrations`; fresh databases carry `{_id: "defaults"}`.

## 6. Roles

| Role | Scope |
|---|---|
| `admin` | everything |
| `tourism_manager` | programs (incl. pricing & publishing), hotels & rates, destinations, services, groups, traveler requests |
| `sales` | traveler requests, companies & their users, quotes; reads hotels (incl. costs) and programs |
| `accountant` | airlines, commission rules, ticket issuance records, payments, financial reports |
| `content` | images and texts of programs, destinations, services; publishing; **cannot change prices** |
| company user (B2B) | own company only: allowed hotels at company prices, requests, own quotes |

Checked in every page, server action and route handler (`requireStaff(permission)`,
`requireCompanyUser()`); hiding buttons is only cosmetic.
