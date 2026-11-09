-- Etijah travel programs, groups, traveler requests and B2B quotes.
-- Conventions:
--   * Money is stored as INTEGER minor units (amount × 100) in the row's currency.
--   * Timestamps are ISO-8601 UTC strings; calendar dates are 'YYYY-MM-DD'.
--   * *_ar / *_en pairs hold bilingual content (Arabic is required, English optional).

-- ------------------------------------------------------------------ Staff & sessions
CREATE TABLE staff_users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'sales', 'content')),
  active        INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- The session id is the SHA-256 of the random cookie token, so a leaked database
-- cannot be replayed as a cookie.
CREATE TABLE staff_sessions (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ip_hash      TEXT,
  user_agent   TEXT
);
CREATE INDEX staff_sessions_user ON staff_sessions(user_id);

-- ------------------------------------------------------------------ Infrastructure
CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  key    TEXT NOT NULL,
  at     INTEGER NOT NULL
);
CREATE INDEX rate_limits_lookup ON rate_limits(bucket, key, at);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  meta       TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_log_entity ON audit_log(entity, entity_id);

-- ------------------------------------------------------------------ Media
-- Uploaded images are re-encoded to WebP variants (see src/server/media.ts).
CREATE TABLE media (
  id            TEXT PRIMARY KEY,
  original_name TEXT,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  widths        TEXT NOT NULL,
  blur          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  alt_ar        TEXT,
  alt_en        TEXT,
  uploaded_by   INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

-- ------------------------------------------------------------------ Catalog
CREATE TABLE destinations (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  country_code   TEXT NOT NULL,
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  summary_ar     TEXT,
  summary_en     TEXT,
  cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX destinations_country ON destinations(country_code);

CREATE TABLE hotels (
  id             INTEGER PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  name_ar        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  stars          INTEGER CHECK (stars BETWEEN 1 AND 5),
  category_ar    TEXT,
  category_en    TEXT,
  website_url    TEXT,
  maps_url       TEXT,
  address_ar     TEXT,
  address_en     TEXT,
  description_ar TEXT,
  description_en TEXT,
  rooms_ar       TEXT,
  rooms_en       TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX hotels_destination ON hotels(destination_id);

CREATE TABLE hotel_media (
  hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hotel_id, media_id)
);

CREATE TABLE services (
  id         INTEGER PRIMARY KEY,
  icon       TEXT NOT NULL DEFAULT 'check',
  name_ar    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE programs (
  id              INTEGER PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL CHECK (kind IN ('package', 'group')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  featured        INTEGER NOT NULL DEFAULT 0,
  title_ar        TEXT NOT NULL,
  title_en        TEXT,
  summary_ar      TEXT,
  summary_en      TEXT,
  description_ar  TEXT,
  description_en  TEXT,
  duration_days   INTEGER NOT NULL,
  duration_nights INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  -- Cached lowest public price (minor units), for listing, sorting and filtering.
  price_from      INTEGER,
  price_note_ar   TEXT,
  price_note_en   TEXT,
  meals_ar        TEXT,
  meals_en        TEXT,
  terms_ar        TEXT,
  terms_en        TEXT,
  cover_media_id  TEXT REFERENCES media(id) ON DELETE SET NULL,
  view_count      INTEGER NOT NULL DEFAULT 0,
  published_at    TEXT,
  created_by      INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX programs_status ON programs(status);

CREATE TABLE program_destinations (
  program_id     INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  destination_id INTEGER NOT NULL REFERENCES destinations(id) ON DELETE RESTRICT,
  sort           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, destination_id)
);
CREATE INDEX program_destinations_dest ON program_destinations(destination_id);

CREATE TABLE program_media (
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  media_id   TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, media_id)
);

CREATE TABLE program_days (
  id         INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title_ar   TEXT NOT NULL,
  title_en   TEXT,
  body_ar    TEXT,
  body_en    TEXT,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX program_days_program ON program_days(program_id);

-- board: RO room only, BB bed & breakfast, HB half board, FB full board, AI all inclusive.
CREATE TABLE program_hotels (
  id         INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  hotel_id   INTEGER NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  nights     INTEGER NOT NULL,
  room_ar    TEXT,
  room_en    TEXT,
  board      TEXT CHECK (board IN ('RO', 'BB', 'HB', 'FB', 'AI')),
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX program_hotels_program ON program_hotels(program_id);
CREATE INDEX program_hotels_hotel ON program_hotels(hotel_id);

CREATE TABLE program_services (
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  included   INTEGER NOT NULL DEFAULT 1,
  note_ar    TEXT,
  note_en    TEXT,
  sort       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (program_id, service_id)
);

CREATE TABLE program_prices (
  id         INTEGER PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  label_ar   TEXT NOT NULL,
  label_en   TEXT,
  amount     INTEGER NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX program_prices_program ON program_prices(program_id);

-- Group departures ("الكروبات"): fixed dates with a seat allocation.
CREATE TABLE departures (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  program_id  INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  depart_date TEXT NOT NULL,
  return_date TEXT NOT NULL,
  seats_total INTEGER NOT NULL,
  -- Seats sold outside the website (office, phone). Confirmed web requests are added on top.
  seats_held  INTEGER NOT NULL DEFAULT 0,
  price       INTEGER,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'guaranteed', 'full', 'closed', 'cancelled')),
  note_ar     TEXT,
  note_en     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX departures_program ON departures(program_id, depart_date);

-- ------------------------------------------------------------------ Traveler requests
CREATE TABLE leads (
  id              INTEGER PRIMARY KEY,
  ref             TEXT NOT NULL UNIQUE,
  program_id      INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  departure_id    INTEGER REFERENCES departures(id) ON DELETE SET NULL,
  program_title   TEXT NOT NULL,
  departure_label TEXT,
  preferred_date  TEXT,
  adults          INTEGER NOT NULL,
  children        INTEGER NOT NULL DEFAULT 0,
  infants         INTEGER NOT NULL DEFAULT 0,
  rooms           INTEGER NOT NULL DEFAULT 1,
  room_type       TEXT,
  full_name       TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  notes           TEXT,
  locale          TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'confirmed', 'cancelled', 'lost')),
  assigned_to     INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  source          TEXT NOT NULL DEFAULT 'website',
  ip_hash         TEXT,
  user_agent      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX leads_status ON leads(status, created_at);
CREATE INDEX leads_program ON leads(program_id);
CREATE INDEX leads_departure ON leads(departure_id);

CREATE TABLE lead_events (
  id          INTEGER PRIMARY KEY,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('created', 'status', 'note', 'assigned', 'contact')),
  body        TEXT,
  from_status TEXT,
  to_status   TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX lead_events_lead ON lead_events(lead_id, created_at);

-- ------------------------------------------------------------------ B2B
CREATE TABLE companies (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  name_en    TEXT,
  industry   TEXT,
  city       TEXT,
  address    TEXT,
  website    TEXT,
  phone      TEXT,
  email      TEXT,
  notes      TEXT,
  created_by INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE company_contacts (
  id         INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   TEXT,
  phone      TEXT,
  email      TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX company_contacts_company ON company_contacts(company_id);

CREATE TABLE quotes (
  id              INTEGER PRIMARY KEY,
  ref             TEXT NOT NULL UNIQUE,
  revision        INTEGER NOT NULL DEFAULT 1,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  contact_id      INTEGER REFERENCES company_contacts(id) ON DELETE SET NULL,
  program_id      INTEGER REFERENCES programs(id) ON DELETE SET NULL,
  locale          TEXT NOT NULL CHECK (locale IN ('ar', 'en')),
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'changes_requested', 'expired')),
  title           TEXT NOT NULL,
  destination     TEXT,
  intro           TEXT,
  start_date      TEXT,
  end_date        TEXT,
  adults          INTEGER NOT NULL DEFAULT 0,
  children        INTEGER NOT NULL DEFAULT 0,
  infants         INTEGER NOT NULL DEFAULT 0,
  rooms           INTEGER NOT NULL DEFAULT 0,
  rooms_note      TEXT,
  currency        TEXT NOT NULL,
  pricing_mode    TEXT NOT NULL DEFAULT 'per_person' CHECK (pricing_mode IN ('per_person', 'per_room', 'per_group')),
  -- discount_value: minor units for 'amount', basis points (1% = 100) for 'percent'.
  discount_kind   TEXT CHECK (discount_kind IN ('amount', 'percent')),
  discount_value  INTEGER NOT NULL DEFAULT 0,
  discount_label  TEXT,
  inclusions      TEXT NOT NULL DEFAULT '[]',
  exclusions      TEXT NOT NULL DEFAULT '[]',
  notes           TEXT,
  terms           TEXT,
  internal_notes  TEXT,
  cover_media_id  TEXT REFERENCES media(id) ON DELETE SET NULL,
  valid_until     TEXT NOT NULL,
  -- Secret link token (256-bit, URL-safe). Revocable and optionally time-limited.
  token           TEXT NOT NULL UNIQUE,
  link_expires_at TEXT,
  link_revoked_at TEXT,
  sent_at         TEXT,
  first_viewed_at TEXT,
  last_viewed_at  TEXT,
  view_count      INTEGER NOT NULL DEFAULT 0,
  responded_at    TEXT,
  response_name   TEXT,
  response_note   TEXT,
  created_by      INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by      INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX quotes_company ON quotes(company_id);
CREATE INDEX quotes_status ON quotes(status);

CREATE TABLE quote_days (
  id         INTEGER PRIMARY KEY,
  quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX quote_days_quote ON quote_days(quote_id);

CREATE TABLE quote_hotels (
  id        INTEGER PRIMARY KEY,
  quote_id  INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  hotel_id  INTEGER NOT NULL REFERENCES hotels(id) ON DELETE RESTRICT,
  check_in  TEXT,
  check_out TEXT,
  nights    INTEGER NOT NULL DEFAULT 1,
  room_type TEXT,
  board     TEXT CHECK (board IN ('RO', 'BB', 'HB', 'FB', 'AI')),
  rooms     INTEGER,
  sort      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX quote_hotels_quote ON quote_hotels(quote_id);

-- kind: 'main' (in the total), 'fee' (additional cost, in the total), 'option' (optional, not in the total).
-- unit_cost is INTERNAL (company cost) and must never reach client pages, PDFs or public APIs.
CREATE TABLE quote_items (
  id          INTEGER PRIMARY KEY,
  quote_id    INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('main', 'fee', 'option')),
  label       TEXT NOT NULL,
  description TEXT,
  unit        TEXT NOT NULL CHECK (unit IN ('person', 'child', 'room', 'group', 'night', 'unit')),
  quantity    INTEGER NOT NULL,
  unit_price  INTEGER NOT NULL,
  unit_cost   INTEGER,
  sort        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX quote_items_quote ON quote_items(quote_id);

CREATE TABLE quote_media (
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (quote_id, media_id)
);

CREATE TABLE quote_events (
  id            INTEGER PRIMARY KEY,
  quote_id      INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  channel       TEXT,
  actor_user_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  actor_label   TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX quote_events_quote ON quote_events(quote_id, created_at);
