import "server-only";
import type { Locale } from "@/content/site";
import { countryName } from "@/lib/countries";
import { todayDay } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import {
  pick,
  type Board,
  type DepartureStatus,
  type ProgramKind,
  type ProgramStatus,
} from "@/lib/travel-labels";
import { all, get, now, placeholders, run, tx } from "../db";
import { mediaByIds } from "../media";
import { audit, nextRef } from "../security";
import { hotelsPublic, uniqueSlug, type HotelPublic } from "./catalog";

export interface ProgramRow {
  id: number;
  code: string;
  slug: string;
  kind: ProgramKind;
  status: ProgramStatus;
  featured: number;
  title_ar: string;
  title_en: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  duration_days: number;
  duration_nights: number;
  currency: string;
  price_from: number | null;
  price_note_ar: string | null;
  price_note_en: string | null;
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover_media_id: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartureRow {
  id: number;
  code: string;
  program_id: number;
  depart_date: string;
  return_date: string;
  seats_total: number;
  seats_held: number;
  price: number | null;
  status: DepartureStatus;
  note_ar: string | null;
  note_en: string | null;
}

// ------------------------------------------------------------------ Seats
/** Travelers (adults + children) in confirmed requests, per departure. */
export function confirmedPax(departureIds: number[]): Map<number, number> {
  if (!departureIds.length) return new Map();
  const rows = all<{ departure_id: number; pax: number }>(
    `SELECT departure_id, SUM(adults + children) AS pax FROM leads
     WHERE status = 'confirmed' AND departure_id IN (${placeholders(departureIds.length)}) GROUP BY departure_id`,
    ...departureIds,
  );
  return new Map(rows.map((r) => [r.departure_id, r.pax]));
}

export interface DepartureState {
  seatsLeft: number;
  soldOut: boolean;
  bookable: boolean;
  confirmed: number;
}

export function departureState(d: DepartureRow, confirmed: number, today = todayDay()): DepartureState {
  const seatsLeft = Math.max(0, d.seats_total - d.seats_held - confirmed);
  const soldOut = d.status === "full" || seatsLeft === 0;
  const bookable = (d.status === "open" || d.status === "guaranteed") && !soldOut && d.depart_date > today;
  return { seatsLeft, soldOut, bookable, confirmed };
}

// ------------------------------------------------------------------ Staff
export function listProgramsStaff(opts: { status?: string; q?: string; kind?: string } = {}) {
  const where: string[] = [];
  const params: string[] = [];
  if (opts.status) {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  if (opts.kind) {
    where.push("p.kind = ?");
    params.push(opts.kind);
  }
  if (opts.q) {
    where.push("(p.title_ar LIKE ? OR p.title_en LIKE ? OR p.code LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`);
  }
  const today = todayDay();
  return all<ProgramRow & { destinations: string | null; leads: number; new_leads: number; departures: number; next_departure: string | null }>(
    `SELECT p.*,
       (SELECT GROUP_CONCAT(d.name_ar, '، ') FROM program_destinations pd JOIN destinations d ON d.id = pd.destination_id WHERE pd.program_id = p.id) AS destinations,
       (SELECT COUNT(*) FROM leads l WHERE l.program_id = p.id) AS leads,
       (SELECT COUNT(*) FROM leads l WHERE l.program_id = p.id AND l.status = 'new') AS new_leads,
       (SELECT COUNT(*) FROM departures x WHERE x.program_id = p.id AND x.depart_date >= '${today}' AND x.status != 'cancelled') AS departures,
       (SELECT MIN(depart_date) FROM departures x WHERE x.program_id = p.id AND x.depart_date >= '${today}' AND x.status != 'cancelled') AS next_departure
     FROM programs p ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, p.updated_at DESC`,
    ...params,
  );
}

export interface ProgramInput {
  kind: ProgramKind;
  featured: boolean;
  title_ar: string;
  title_en: string | null;
  slug: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  destination_ids: number[];
  duration_days: number;
  duration_nights: number;
  currency: string;
  price_note_ar: string | null;
  price_note_en: string | null;
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover_media_id: string | null;
  gallery: string[];
  prices: { label_ar: string; label_en: string | null; amount: number }[];
  days: { title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null }[];
  hotels: { hotel_id: number; nights: number; room_ar: string | null; room_en: string | null; board: Board | null }[];
  services: { service_id: number; included: boolean; note_ar: string | null; note_en: string | null }[];
  departures: {
    id?: number;
    depart_date: string;
    return_date: string;
    seats_total: number;
    seats_held: number;
    price: number | null;
    status: DepartureStatus;
    note_ar: string | null;
    note_en: string | null;
  }[];
}

export type ProgramEditorData = ProgramInput & {
  id: number;
  code: string;
  slug: string;
  status: ProgramStatus;
  view_count: number;
  published_at: string | null;
  updated_at: string;
  departures: (ProgramInput["departures"][number] & { id: number; code: string; confirmed: number })[];
};

export function getProgramRow(id: number) {
  return get<ProgramRow>("SELECT * FROM programs WHERE id = ?", id);
}

export function getProgramEditor(id: number): ProgramEditorData | null {
  const p = getProgramRow(id);
  if (!p) return null;
  const deps = all<DepartureRow>("SELECT * FROM departures WHERE program_id = ? ORDER BY depart_date", id);
  const pax = confirmedPax(deps.map((d) => d.id));
  return {
    id: p.id,
    code: p.code,
    slug: p.slug,
    status: p.status,
    view_count: p.view_count,
    published_at: p.published_at,
    updated_at: p.updated_at,
    kind: p.kind,
    featured: !!p.featured,
    title_ar: p.title_ar,
    title_en: p.title_en,
    summary_ar: p.summary_ar,
    summary_en: p.summary_en,
    description_ar: p.description_ar,
    description_en: p.description_en,
    destination_ids: all<{ destination_id: number }>("SELECT destination_id FROM program_destinations WHERE program_id = ? ORDER BY sort", id).map((r) => r.destination_id),
    duration_days: p.duration_days,
    duration_nights: p.duration_nights,
    currency: p.currency,
    price_note_ar: p.price_note_ar,
    price_note_en: p.price_note_en,
    meals_ar: p.meals_ar,
    meals_en: p.meals_en,
    terms_ar: p.terms_ar,
    terms_en: p.terms_en,
    cover_media_id: p.cover_media_id,
    gallery: all<{ media_id: string }>("SELECT media_id FROM program_media WHERE program_id = ? ORDER BY sort", id).map((r) => r.media_id),
    prices: all("SELECT label_ar, label_en, amount FROM program_prices WHERE program_id = ? ORDER BY sort", id),
    days: all("SELECT title_ar, title_en, body_ar, body_en FROM program_days WHERE program_id = ? ORDER BY sort", id),
    hotels: all("SELECT hotel_id, nights, room_ar, room_en, board FROM program_hotels WHERE program_id = ? ORDER BY sort", id),
    services: all<{ service_id: number; included: number; note_ar: string | null; note_en: string | null }>(
      "SELECT service_id, included, note_ar, note_en FROM program_services WHERE program_id = ? ORDER BY sort",
      id,
    ).map((s) => ({ ...s, included: !!s.included })),
    departures: deps.map((d) => ({
      id: d.id,
      code: d.code,
      depart_date: d.depart_date,
      return_date: d.return_date,
      seats_total: d.seats_total,
      seats_held: d.seats_held,
      price: d.price,
      status: d.status,
      note_ar: d.note_ar,
      note_en: d.note_en,
      confirmed: pax.get(d.id) ?? 0,
    })),
  };
}

/**
 * The "from" price: the first (main) price tier — e.g. per adult in a double room — or a lower
 * special price on an upcoming group date. Child or supplement tiers never become the headline.
 */
function computePriceFrom(input: ProgramInput): number | null {
  const today = todayDay();
  const candidates = [
    ...input.prices.slice(0, 1).map((p) => p.amount),
    ...input.departures.filter((d) => d.price != null && d.depart_date >= today && d.status !== "cancelled").map((d) => d.price as number),
  ].filter((n) => n > 0);
  return candidates.length ? Math.min(...candidates) : null;
}

/** Saves a program and all its parts atomically. Returns the program id. */
export function saveProgram(id: number | null, input: ProgramInput, userId: number): number {
  const t = now();
  return tx(() => {
    const priceFrom = computePriceFrom(input);
    let programId = id;
    const cols = [
      input.kind, input.featured, input.title_ar, input.title_en, input.summary_ar, input.summary_en, input.description_ar, input.description_en,
      input.duration_days, input.duration_nights, input.currency, priceFrom, input.price_note_ar, input.price_note_en,
      input.meals_ar, input.meals_en, input.terms_ar, input.terms_en, input.cover_media_id,
    ];
    if (programId) {
      const slug = uniqueSlug("programs", input.slug || input.title_en || "", `program-${programId}`, programId);
      run(
        `UPDATE programs SET kind = ?, featured = ?, title_ar = ?, title_en = ?, summary_ar = ?, summary_en = ?, description_ar = ?, description_en = ?,
           duration_days = ?, duration_nights = ?, currency = ?, price_from = ?, price_note_ar = ?, price_note_en = ?, meals_ar = ?, meals_en = ?,
           terms_ar = ?, terms_en = ?, cover_media_id = ?, slug = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
        ...cols, slug, userId, t, programId,
      );
    } else {
      const code = nextRef("PRG");
      const slug = uniqueSlug("programs", input.slug || input.title_en || "", code.toLowerCase());
      programId = run(
        `INSERT INTO programs (kind, featured, title_ar, title_en, summary_ar, summary_en, description_ar, description_en, duration_days, duration_nights,
           currency, price_from, price_note_ar, price_note_en, meals_ar, meals_en, terms_ar, terms_en, cover_media_id, slug, code, status,
           created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        ...cols, slug, code, userId, userId, t, t,
      ).id;
    }
    const pid = programId!;

    for (const table of ["program_destinations", "program_media", "program_days", "program_hotels", "program_services", "program_prices"]) {
      run(`DELETE FROM ${table} WHERE program_id = ?`, pid);
    }
    input.destination_ids.forEach((d, i) => run("INSERT INTO program_destinations (program_id, destination_id, sort) VALUES (?, ?, ?)", pid, d, i));
    input.gallery.forEach((m, i) => run("INSERT INTO program_media (program_id, media_id, sort) VALUES (?, ?, ?)", pid, m, i));
    input.days.forEach((d, i) =>
      run("INSERT INTO program_days (program_id, day_number, title_ar, title_en, body_ar, body_en, sort) VALUES (?, ?, ?, ?, ?, ?, ?)", pid, i + 1, d.title_ar, d.title_en, d.body_ar, d.body_en, i),
    );
    input.hotels.forEach((h, i) =>
      run("INSERT INTO program_hotels (program_id, hotel_id, nights, room_ar, room_en, board, sort) VALUES (?, ?, ?, ?, ?, ?, ?)", pid, h.hotel_id, h.nights, h.room_ar, h.room_en, h.board, i),
    );
    input.services.forEach((s, i) =>
      run("INSERT INTO program_services (program_id, service_id, included, note_ar, note_en, sort) VALUES (?, ?, ?, ?, ?, ?)", pid, s.service_id, s.included, s.note_ar, s.note_en, i),
    );
    input.prices.forEach((p, i) =>
      run("INSERT INTO program_prices (program_id, label_ar, label_en, amount, sort) VALUES (?, ?, ?, ?, ?)", pid, p.label_ar, p.label_en, p.amount, i),
    );

    // Departures are updated in place (requests reference them), added, or removed.
    const keep = new Set<number>();
    for (const d of input.departures) {
      const owned = d.id ? get<{ id: number }>("SELECT id FROM departures WHERE id = ? AND program_id = ?", d.id, pid) : undefined;
      if (owned) {
        keep.add(owned.id);
        run(
          `UPDATE departures SET depart_date = ?, return_date = ?, seats_total = ?, seats_held = ?, price = ?, status = ?, note_ar = ?, note_en = ?, updated_at = ? WHERE id = ?`,
          d.depart_date, d.return_date, d.seats_total, d.seats_held, d.price, d.status, d.note_ar, d.note_en, t, owned.id,
        );
      } else {
        const newId = run(
          `INSERT INTO departures (code, program_id, depart_date, return_date, seats_total, seats_held, price, status, note_ar, note_en, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          nextRef("GRP"), pid, d.depart_date, d.return_date, d.seats_total, d.seats_held, d.price, d.status, d.note_ar, d.note_en, t, t,
        ).id;
        keep.add(newId);
      }
    }
    const existing = all<{ id: number }>("SELECT id FROM departures WHERE program_id = ?", pid);
    for (const e of existing) if (!keep.has(e.id)) run("DELETE FROM departures WHERE id = ?", e.id);

    audit(userId, id ? "update" : "create", "program", pid);
    return pid;
  });
}

/** Problems that block publishing (an incomplete offer must not go live). */
export function publishProblems(id: number): string[] {
  const p = getProgramEditor(id);
  if (!p) return ["البرنامج غير موجود."];
  const problems: string[] = [];
  if (!p.cover_media_id) problems.push("أضف صورة الغلاف.");
  if (!p.summary_ar) problems.push("أضف وصفاً مختصراً بالعربية.");
  if (!p.prices.length && !p.departures.some((d) => d.price != null)) problems.push("أضف سعراً واحداً على الأقل.");
  if (!p.days.length) problems.push("أضف البرنامج اليومي (يوم واحد على الأقل).");
  if (p.kind === "group" && !p.departures.some((d) => d.depart_date > todayDay() && d.status !== "cancelled"))
    problems.push("الكروب يحتاج موعد انطلاق قادماً واحداً على الأقل.");
  return problems;
}

export function setProgramStatus(id: number, status: ProgramStatus, userId: number) {
  const t = now();
  run(
    `UPDATE programs SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
       updated_by = ?, updated_at = ? WHERE id = ?`,
    status, status, t, userId, t, id,
  );
  audit(userId, `status:${status}`, "program", id);
}

export function deleteProgram(id: number, userId: number) {
  tx(() => {
    run("DELETE FROM programs WHERE id = ?", id);
    audit(userId, "delete", "program", id);
  });
}

export function duplicateProgram(id: number, userId: number): number | null {
  const p = getProgramEditor(id);
  if (!p) return null;
  return saveProgram(
    null,
    {
      ...p,
      title_ar: `${p.title_ar} (نسخة)`,
      title_en: p.title_en ? `${p.title_en} (copy)` : null,
      slug: null,
      featured: false,
      departures: [],
    },
    userId,
  );
}

/** All departures across programs, for the "Groups" staff page. */
export function listDeparturesStaff(opts: { scope?: "upcoming" | "past" | "all" } = {}) {
  const today = todayDay();
  const where = opts.scope === "past" ? `WHERE x.depart_date < '${today}'` : opts.scope === "all" ? "" : `WHERE x.depart_date >= '${today}'`;
  const rows = all<DepartureRow & { title_ar: string; program_status: ProgramStatus; currency: string; requests: number }>(
    `SELECT x.*, p.title_ar, p.status AS program_status, p.currency,
       (SELECT COUNT(*) FROM leads l WHERE l.departure_id = x.id AND l.status NOT IN ('cancelled', 'lost')) AS requests
     FROM departures x JOIN programs p ON p.id = x.program_id ${where}
     ORDER BY x.depart_date ${opts.scope === "past" ? "DESC" : "ASC"}`,
  );
  const pax = confirmedPax(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, ...departureState(r, pax.get(r.id) ?? 0, today) }));
}

export function updateDepartureQuick(id: number, input: { seats_total: number; seats_held: number; status: DepartureStatus }, userId: number) {
  run("UPDATE departures SET seats_total = ?, seats_held = ?, status = ?, updated_at = ? WHERE id = ?", input.seats_total, input.seats_held, input.status, now(), id);
  audit(userId, "update", "departure", id, input);
}

// ------------------------------------------------------------------ Public read models
export interface ServiceChip {
  icon: string;
  name: string;
  note: string | null;
}

export interface DeparturePublic {
  id: number;
  code: string;
  departDate: string;
  returnDate: string;
  seatsTotal: number;
  seatsLeft: number;
  soldOut: boolean;
  bookable: boolean;
  status: DepartureStatus;
  price: number | null;
  note: string | null;
}

export interface ProgramCard {
  id: number;
  slug: string;
  kind: ProgramKind;
  featured: boolean;
  title: string;
  summary: string | null;
  places: string[];
  countries: { code: string; name: string }[];
  days: number;
  nights: number;
  currency: string;
  priceFrom: number | null;
  priceNote: string | null;
  cover: MediaRef | null;
  nextDeparture: DeparturePublic | null;
  departures: DeparturePublic[];
  services: ServiceChip[];
  publishedAt: string | null;
}

function buildCards(rows: ProgramRow[], locale: Locale): ProgramCard[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ph = placeholders(ids.length);
  const today = todayDay();
  const dests = all<{ program_id: number; country_code: string; name_ar: string; name_en: string }>(
    `SELECT pd.program_id, d.country_code, d.name_ar, d.name_en FROM program_destinations pd JOIN destinations d ON d.id = pd.destination_id
     WHERE pd.program_id IN (${ph}) ORDER BY pd.sort`,
    ...ids,
  );
  const services = all<{ program_id: number; icon: string; name_ar: string; name_en: string; note_ar: string | null; note_en: string | null }>(
    `SELECT ps.program_id, s.icon, s.name_ar, s.name_en, ps.note_ar, ps.note_en FROM program_services ps JOIN services s ON s.id = ps.service_id
     WHERE ps.program_id IN (${ph}) AND ps.included = 1 AND s.active = 1 ORDER BY ps.sort`,
    ...ids,
  );
  const deps = all<DepartureRow>(
    `SELECT * FROM departures WHERE program_id IN (${ph}) AND depart_date >= ? AND status != 'cancelled' ORDER BY depart_date`,
    ...ids,
    today,
  );
  const pax = confirmedPax(deps.map((d) => d.id));
  const media = mediaByIds(rows.map((r) => r.cover_media_id).filter((m): m is string => !!m));

  return rows.map((r) => {
    const own = dests.filter((d) => d.program_id === r.id);
    const codes = [...new Set(own.map((d) => d.country_code))];
    const departures = deps
      .filter((d) => d.program_id === r.id)
      .map((d) => toDeparturePublic(d, pax.get(d.id) ?? 0, locale, today));
    return {
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      featured: !!r.featured,
      title: pick(locale, r.title_ar, r.title_en),
      summary: pick(locale, r.summary_ar, r.summary_en) || null,
      places: own.map((d) => pick(locale, d.name_ar, d.name_en)),
      countries: codes.map((code) => ({ code, name: countryName(code, locale) })),
      days: r.duration_days,
      nights: r.duration_nights,
      currency: r.currency,
      priceFrom: r.price_from,
      priceNote: pick(locale, r.price_note_ar, r.price_note_en) || null,
      cover: r.cover_media_id ? (media.get(r.cover_media_id) ?? null) : null,
      nextDeparture: departures.find((d) => d.bookable) ?? departures[0] ?? null,
      departures,
      services: services
        .filter((s) => s.program_id === r.id)
        .map((s) => ({ icon: s.icon, name: pick(locale, s.name_ar, s.name_en), note: pick(locale, s.note_ar, s.note_en) || null })),
      publishedAt: r.published_at,
    };
  });
}

function toDeparturePublic(d: DepartureRow, confirmed: number, locale: Locale, today: string): DeparturePublic {
  const s = departureState(d, confirmed, today);
  return {
    id: d.id,
    code: d.code,
    departDate: d.depart_date,
    returnDate: d.return_date,
    seatsTotal: d.seats_total,
    seatsLeft: s.seatsLeft,
    soldOut: s.soldOut,
    bookable: s.bookable,
    status: d.status,
    price: d.price,
    note: pick(locale, d.note_ar, d.note_en) || null,
  };
}

export interface ProgramFilters {
  country?: string;
  kind?: ProgramKind;
  duration?: "short" | "week" | "long" | "extended";
  month?: string;
  maxPrice?: number;
  q?: string;
  sort?: "recommended" | "price-asc" | "price-desc" | "soonest";
}

const DURATIONS = { short: [1, 4], week: [5, 7], long: [8, 10], extended: [11, 99] } as const;

export function listPublicPrograms(filters: ProgramFilters, locale: Locale): ProgramCard[] {
  const rows = all<ProgramRow>("SELECT * FROM programs WHERE status = 'published'");
  let cards = buildCards(rows, locale);

  if (filters.country) cards = cards.filter((c) => c.countries.some((x) => x.code === filters.country));
  if (filters.kind) cards = cards.filter((c) => c.kind === filters.kind);
  if (filters.duration) {
    const [min, max] = DURATIONS[filters.duration];
    cards = cards.filter((c) => c.days >= min && c.days <= max);
  }
  if (filters.month) {
    // Fixed-date groups must depart that month; flexible packages can be booked for any month.
    cards = cards.filter((c) => c.kind === "package" || c.departures.some((d) => d.departDate.startsWith(filters.month!)));
  }
  if (filters.maxPrice != null) cards = cards.filter((c) => c.priceFrom != null && c.priceFrom <= filters.maxPrice!);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    const text = (c: ProgramCard) => [c.title, c.summary, ...c.places, ...c.countries.map((x) => x.name)].join(" ").toLowerCase();
    cards = cards.filter((c) => text(c).includes(q));
  }

  const price = (c: ProgramCard) => c.priceFrom ?? Number.MAX_SAFE_INTEGER;
  const soonest = (c: ProgramCard) => c.nextDeparture?.departDate ?? "9999";
  switch (filters.sort) {
    case "price-asc":
      return cards.sort((a, b) => price(a) - price(b));
    case "price-desc":
      return cards.sort((a, b) => (b.priceFrom ?? -1) - (a.priceFrom ?? -1));
    case "soonest":
      return cards.sort((a, b) => soonest(a).localeCompare(soonest(b)));
    default:
      return cards.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }
}

export function publicFacets(locale: Locale) {
  const cards = listPublicPrograms({}, locale);
  const countries = new Map<string, { code: string; name: string; count: number }>();
  for (const c of cards) for (const x of c.countries) countries.set(x.code, { ...x, count: (countries.get(x.code)?.count ?? 0) + 1 });
  const months = [...new Set(cards.flatMap((c) => c.departures.map((d) => d.departDate.slice(0, 7))))].sort();
  const currencies = [...new Set(cards.map((c) => c.currency))];
  return {
    total: cards.length,
    groups: cards.filter((c) => c.kind === "group").length,
    countries: [...countries.values()].sort((a, b) => b.count - a.count),
    months,
    currency: currencies.length === 1 ? currencies[0] : null,
  };
}

export function featuredPrograms(locale: Locale, limit = 6) {
  return listPublicPrograms({ sort: "recommended" }, locale).slice(0, limit);
}

/** Upcoming group departures across all published programs. */
export function upcomingDepartures(locale: Locale, limit = 12) {
  const cards = listPublicPrograms({ kind: "group" }, locale);
  return cards
    .flatMap((c) => c.departures.map((d) => ({ program: c, departure: d })))
    .sort((a, b) => a.departure.departDate.localeCompare(b.departure.departDate))
    .slice(0, limit);
}

export interface ProgramDetail extends ProgramCard {
  description: string | null;
  meals: string | null;
  terms: string | null;
  gallery: MediaRef[];
  itinerary: { day: number; title: string; body: string | null }[];
  hotels: (HotelPublic & { nights: number; room: string | null; board: Board | null })[];
  included: ServiceChip[];
  excluded: ServiceChip[];
  prices: { label: string; amount: number }[];
  updatedAt: string;
}

export function getPublicProgram(slug: string, locale: Locale): ProgramDetail | null {
  const row = get<ProgramRow>("SELECT * FROM programs WHERE slug = ? AND status = 'published'", slug);
  if (!row) return null;
  return buildDetail(row, locale);
}

/** Staff preview of any program (draft included). */
export function getProgramPreview(id: number, locale: Locale): ProgramDetail | null {
  const row = getProgramRow(id);
  return row ? buildDetail(row, locale) : null;
}

function buildDetail(row: ProgramRow, locale: Locale): ProgramDetail {
  const [card] = buildCards([row], locale);
  const id = row.id;
  const galleryIds = all<{ media_id: string }>("SELECT media_id FROM program_media WHERE program_id = ? ORDER BY sort", id).map((r) => r.media_id);
  const media = mediaByIds(galleryIds);
  const hotelRows = all<{ hotel_id: number; nights: number; room_ar: string | null; room_en: string | null; board: Board | null }>(
    "SELECT hotel_id, nights, room_ar, room_en, board FROM program_hotels WHERE program_id = ? ORDER BY sort",
    id,
  );
  const hotels = hotelsPublic(hotelRows.map((h) => h.hotel_id), locale);
  const services = all<{ icon: string; name_ar: string; name_en: string; note_ar: string | null; note_en: string | null; included: number }>(
    `SELECT s.icon, s.name_ar, s.name_en, ps.note_ar, ps.note_en, ps.included FROM program_services ps JOIN services s ON s.id = ps.service_id
     WHERE ps.program_id = ? AND s.active = 1 ORDER BY ps.sort`,
    id,
  );
  const chip = (s: (typeof services)[number]): ServiceChip => ({ icon: s.icon, name: pick(locale, s.name_ar, s.name_en), note: pick(locale, s.note_ar, s.note_en) || null });

  return {
    ...card,
    description: pick(locale, row.description_ar, row.description_en) || null,
    meals: pick(locale, row.meals_ar, row.meals_en) || null,
    terms: pick(locale, row.terms_ar, row.terms_en) || null,
    gallery: galleryIds.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
    itinerary: all<{ day_number: number; title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null }>(
      "SELECT day_number, title_ar, title_en, body_ar, body_en FROM program_days WHERE program_id = ? ORDER BY sort",
      id,
    ).map((d) => ({ day: d.day_number, title: pick(locale, d.title_ar, d.title_en), body: pick(locale, d.body_ar, d.body_en) || null })),
    hotels: hotelRows
      .map((h) => {
        const hotel = hotels.get(h.hotel_id);
        return hotel ? { ...hotel, nights: h.nights, room: pick(locale, h.room_ar, h.room_en) || null, board: h.board } : null;
      })
      .filter((h): h is NonNullable<typeof h> => !!h),
    included: services.filter((s) => s.included).map(chip),
    excluded: services.filter((s) => !s.included).map(chip),
    prices: all<{ label_ar: string; label_en: string | null; amount: number }>(
      "SELECT label_ar, label_en, amount FROM program_prices WHERE program_id = ? ORDER BY sort",
      id,
    ).map((p) => ({ label: pick(locale, p.label_ar, p.label_en), amount: p.amount })),
    updatedAt: row.updated_at,
  };
}

export function relatedPrograms(program: ProgramCard, locale: Locale, limit = 3) {
  const codes = new Set(program.countries.map((c) => c.code));
  const others = listPublicPrograms({}, locale).filter((c) => c.id !== program.id);
  const same = others.filter((c) => c.countries.some((x) => codes.has(x.code)));
  return [...same, ...others.filter((c) => !same.includes(c))].slice(0, limit);
}

/** Programs that include a hotel (for the public hotel page). */
export function programsWithHotel(hotelId: number, locale: Locale) {
  const rows = all<ProgramRow>(
    "SELECT p.* FROM programs p WHERE p.status = 'published' AND EXISTS (SELECT 1 FROM program_hotels ph WHERE ph.program_id = p.id AND ph.hotel_id = ?)",
    hotelId,
  );
  return buildCards(rows, locale);
}

export function recordProgramView(id: number) {
  run("UPDATE programs SET view_count = view_count + 1 WHERE id = ? AND status = 'published'", id);
}

export const publicProgramSlugs = () => all<{ slug: string; updated_at: string }>("SELECT slug, updated_at FROM programs WHERE status = 'published'");

/** For the request form: a bookable departure of a published program. */
export function departureForRequest(programId: number, departureId: number) {
  const d = get<DepartureRow>("SELECT * FROM departures WHERE id = ? AND program_id = ?", departureId, programId);
  if (!d) return null;
  return { row: d, state: departureState(d, confirmedPax([d.id]).get(d.id) ?? 0) };
}
