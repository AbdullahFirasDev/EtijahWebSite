import "server-only";
import { UserFacingError } from "../errors";
import { randomUUID } from "node:crypto";
import type { ClientSession, Filter } from "mongodb";
import type { Locale } from "@/content/site";
import { countryName } from "@/lib/countries";
import { addDays, todayDay } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { hotelPerPerson, optionMargin, optionPrice, priceFrom, type ProgramPricing } from "@/lib/program-pricing";
import { pick, type Board, type DepartureStatus, type ProgramStatus, type ProgramType, type Visibility } from "@/lib/travel-labels";
import { col, contains, nextId, now, tx } from "../db";
import { mediaByIds } from "../media";
import { audit, nextRef, randomToken } from "../security";
import { hotelsPublic, uniqueSlug, type HotelDoc, type HotelPublic, type RateBasis } from "./catalog";

// ------------------------------------------------------------------ Documents
export interface RateSnapshot {
  rate_id: string;
  currency: string;
  price: number;
  cost: number | null;
  basis: RateBasis;
  occupancy: number;
  captured_at: string;
}

export interface HotelOption {
  id: string;
  hotel_id: number;
  room_type_id: string | null;
  room_ar: string | null;
  room_en: string | null;
  occupancy: number;
  board: Board | null;
  nights: number;
  basis: RateBasis;
  /** Selling price per night in the program currency (copied from the library or set for this program only). */
  night_price: number;
  /** INTERNAL: cost per night in the program currency. */
  night_cost: number | null;
  source: "library" | "custom";
  /** Copy of the library rate when it was picked: later library changes never change this program. */
  rate_snapshot: RateSnapshot | null;
  /** Program-currency units per 1 unit of the rate currency (only when they differ). */
  fx_rate: number | null;
  final_price_override: number | null;
  note_ar: string | null;
  note_en: string | null;
}

export interface FlightLeg {
  direction: "outbound" | "return" | "internal";
  airline_id: number | null;
  flight_no: string | null;
  from: string | null;
  to: string | null;
  day: number | null;
  depart_time: string | null;
  arrive_time: string | null;
  note: string | null;
}

export interface ProgramDoc {
  _id: number;
  code: string;
  slug: string;
  type: ProgramType;
  status: ProgramStatus;
  visibility: Visibility;
  featured: boolean;
  title_ar: string;
  title_en: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  destination_ids: number[];
  country_codes: string[];
  duration_days: number;
  duration_nights: number;
  currency: string;
  departure_airport: { code: string | null; name_ar: string; name_en: string | null } | null;
  airline_ids: number[];
  flights: FlightLeg[];
  itinerary: { title_ar: string; title_en: string | null; body_ar: string | null; body_en: string | null }[];
  services: { service_id: number; included: boolean; note_ar: string | null; note_en: string | null }[];
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover_media_id: string | null;
  gallery: string[];
  base_price: number;
  base_cost: number | null;
  hotel_options: HotelOption[];
  extra_prices: { label_ar: string; label_en: string | null; amount: number }[];
  price_note_ar: string | null;
  price_note_en: string | null;
  /** Cached lowest price per person (fixed programs only), for listing, sorting and filtering. */
  price_from: number | null;
  share: { token: string; enabled: boolean } | null;
  view_count: number;
  published_at: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  /** Prices of programs migrated from the old system that had no hotel options (kept for reference). */
  legacy_prices?: { label_ar: string; label_en: string | null; amount: number }[];
}

export interface DepartureDoc {
  _id: number;
  code: string;
  program_id: number;
  depart_date: string;
  return_date: string;
  seats_total: number;
  /** Seats sold outside the website (office, phone). */
  seats_held: number;
  /** Travelers of confirmed requests (changed only with atomic conditional updates). */
  seats_confirmed: number;
  /** Added to every hotel option's price for this date (may be negative). */
  price_supplement: number;
  status: DepartureStatus;
  note_ar: string | null;
  note_en: string | null;
  created_at: string;
  updated_at: string;
}

const programs = () => col<ProgramDoc>("programs");
const departures = () => col<DepartureDoc>("departures");
export const programsCollection = programs;
export const departuresCollection = departures;

// ------------------------------------------------------------------ Seats
export interface DepartureState {
  seatsLeft: number;
  soldOut: boolean;
  bookable: boolean;
  confirmed: number;
}

export function departureState(d: Pick<DepartureDoc, "seats_total" | "seats_held" | "seats_confirmed" | "status" | "depart_date">, today = todayDay()): DepartureState {
  const seatsLeft = Math.max(0, d.seats_total - d.seats_held - d.seats_confirmed);
  const soldOut = d.status === "full" || seatsLeft === 0;
  const bookable = (d.status === "open" || d.status === "guaranteed") && !soldOut && d.depart_date > today;
  return { seatsLeft, soldOut, bookable, confirmed: d.seats_confirmed };
}

/**
 * Reserves `pax` confirmed seats on a departure. Atomic: the update only matches while
 * held + confirmed + pax ≤ total, so concurrent confirmations can never overbook.
 */
export async function reserveSeats(departureId: number, pax: number, session: ClientSession): Promise<boolean> {
  if (pax <= 0) return true;
  const r = await (await departures()).updateOne(
    { _id: departureId, $expr: { $lte: [{ $add: ["$seats_held", "$seats_confirmed", pax] }, "$seats_total"] } },
    { $inc: { seats_confirmed: pax }, $set: { updated_at: now() } },
    { session },
  );
  return r.modifiedCount === 1;
}

export async function releaseSeats(departureId: number, pax: number, session: ClientSession) {
  if (pax <= 0) return;
  await (await departures()).updateOne({ _id: departureId }, [{ $set: { seats_confirmed: { $max: [0, { $subtract: ["$seats_confirmed", pax] }] }, updated_at: now() } }], { session });
}

// ------------------------------------------------------------------ Staff list
export interface StaffProgramFilters {
  view?: "all" | "fixed" | "custom" | "drafts" | "published" | "archived";
  q?: string;
  country?: string;
  destinationId?: number;
  hotelId?: number;
  status?: ProgramStatus;
  type?: ProgramType;
  from?: string;
  to?: string;
  duration?: "short" | "week" | "long" | "extended";
  priceMin?: number;
  priceMax?: number;
}

const DURATIONS = { short: [1, 4], week: [5, 7], long: [8, 10], extended: [11, 999] } as const;

export async function listProgramsStaff(f: StaffProgramFilters = {}) {
  const filter: Filter<ProgramDoc> = {};
  switch (f.view) {
    case "fixed":
    case "custom":
      filter.type = f.view;
      filter.status = { $ne: "archived" };
      break;
    case "drafts":
      filter.status = "draft";
      break;
    case "published":
      filter.status = "published";
      break;
    case "archived":
      filter.status = "archived";
      break;
    default:
      filter.status = { $ne: "archived" };
  }
  if (f.status) filter.status = f.status;
  if (f.type) filter.type = f.type;
  if (f.country) filter.country_codes = f.country;
  if (f.destinationId) filter.destination_ids = f.destinationId;
  if (f.hotelId) filter["hotel_options.hotel_id"] = f.hotelId;
  if (f.duration) filter.duration_days = { $gte: DURATIONS[f.duration][0], $lte: DURATIONS[f.duration][1] };
  if (f.priceMin != null || f.priceMax != null) filter.price_from = { ...(f.priceMin != null ? { $gte: f.priceMin } : {}), ...(f.priceMax != null ? { $lte: f.priceMax } : {}) };
  if (f.q) filter.$or = [{ title_ar: contains(f.q) }, { title_en: contains(f.q) }, { code: contains(f.q) }];

  const today = todayDay();
  // Travel-date filter: programs with a non-cancelled departure in the range.
  if (f.from || f.to) {
    const dep = await (await departures()).distinct("program_id", {
      status: { $ne: "cancelled" },
      depart_date: { ...(f.from ? { $gte: f.from } : {}), ...(f.to ? { $lte: f.to } : {}) },
    });
    filter._id = { $in: dep };
  }

  const rows = await (await programs())
    .find(filter, { projection: { itinerary: 0, description_ar: 0, description_en: 0, terms_ar: 0, terms_en: 0 } })
    .sort({ updated_at: -1 })
    .limit(500)
    .toArray();
  const ids = rows.map((r) => r._id);
  const [leadStats, depStats, dests] = await Promise.all([
    (await col("leads"))
      .aggregate<{ _id: number; leads: number; new_leads: number }>([
        { $match: { program_id: { $in: ids } } },
        { $group: { _id: "$program_id", leads: { $sum: 1 }, new_leads: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } } } },
      ])
      .toArray(),
    (await departures())
      .aggregate<{ _id: number; n: number; next: string }>([
        { $match: { program_id: { $in: ids }, depart_date: { $gte: today }, status: { $ne: "cancelled" } } },
        { $group: { _id: "$program_id", n: { $sum: 1 }, next: { $min: "$depart_date" } } },
      ])
      .toArray(),
    (await col<{ _id: number; name_ar: string }>("destinations")).find({ _id: { $in: [...new Set(rows.flatMap((r) => r.destination_ids))] } }).toArray(),
  ]);
  const ls = new Map(leadStats.map((r) => [r._id, r]));
  const ds = new Map(depStats.map((r) => [r._id, r]));
  const dn = new Map(dests.map((d) => [d._id, d.name_ar]));
  const order: Record<ProgramStatus, number> = { published: 0, draft: 1, paused: 2, archived: 3 };
  return rows
    .map((p) => ({
      id: p._id,
      code: p.code,
      slug: p.slug,
      type: p.type,
      status: p.status,
      visibility: p.visibility,
      featured: p.featured,
      title_ar: p.title_ar,
      title_en: p.title_en,
      country_codes: p.country_codes,
      destinations: p.destination_ids.map((d) => dn.get(d)).filter(Boolean).join("، "),
      duration_days: p.duration_days,
      duration_nights: p.duration_nights,
      currency: p.currency,
      price_from: p.price_from,
      hotels: new Set(p.hotel_options.map((o) => o.hotel_id)).size,
      cover_media_id: p.cover_media_id,
      share_enabled: !!p.share?.enabled,
      view_count: p.view_count,
      updated_at: p.updated_at,
      leads: ls.get(p._id)?.leads ?? 0,
      new_leads: ls.get(p._id)?.new_leads ?? 0,
      departures: ds.get(p._id)?.n ?? 0,
      next_departure: ds.get(p._id)?.next ?? null,
    }))
    .sort((a, b) => order[a.status] - order[b.status] || b.updated_at.localeCompare(a.updated_at));
}

/** Tab counts and filter facets for the programs page. */
export async function programFacets() {
  const c = await programs();
  const [byView, countries, hotels] = await Promise.all([
    c.aggregate<{ _id: { type: string; status: string }; n: number }>([{ $group: { _id: { type: "$type", status: "$status" }, n: { $sum: 1 } } }]).toArray(),
    c.aggregate<{ _id: string; n: number }>([{ $match: { status: { $ne: "archived" } } }, { $unwind: "$country_codes" }, { $group: { _id: "$country_codes", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    c
      .aggregate<{ _id: number; n: number }>([
        { $match: { status: { $ne: "archived" } } },
        { $project: { h: { $setUnion: ["$hotel_options.hotel_id", []] } } },
        { $unwind: "$h" },
        { $group: { _id: "$h", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const count = (pred: (t: string, s: string) => boolean) => byView.filter((r) => pred(r._id.type, r._id.status)).reduce((s, r) => s + r.n, 0);
  const hotelNames = new Map(
    (await (await col<HotelDoc>("hotels")).find({ _id: { $in: hotels.map((h) => h._id) } }, { projection: { name_ar: 1 } }).toArray()).map((h) => [h._id, h.name_ar]),
  );
  return {
    tabs: {
      all: count((_, s) => s !== "archived"),
      fixed: count((t, s) => t === "fixed" && s !== "archived"),
      custom: count((t, s) => t === "custom" && s !== "archived"),
      drafts: count((_, s) => s === "draft"),
      published: count((_, s) => s === "published"),
      archived: count((_, s) => s === "archived"),
    },
    countries: countries.map((c) => ({ code: c._id, n: c.n })),
    hotels: hotels.map((h) => ({ id: h._id, name: hotelNames.get(h._id) ?? `#${h._id}`, n: h.n })).sort((a, b) => b.n - a.n),
  };
}

// ------------------------------------------------------------------ Editor
export interface DepartureInput {
  id?: number;
  depart_date: string;
  return_date: string;
  seats_total: number;
  seats_held: number;
  price_supplement: number;
  status: DepartureStatus;
  note_ar: string | null;
  note_en: string | null;
}

export interface HotelOptionInput extends Omit<HotelOption, "rate_snapshot" | "id"> {
  id: string | null;
  rate_id: string | null;
  /** Re-copy the current library rate (otherwise an existing snapshot is kept as it was). */
  refresh_rate: boolean;
}

export interface ProgramInput {
  type: ProgramType;
  visibility: Visibility;
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
  departure_airport: ProgramDoc["departure_airport"];
  airline_ids: number[];
  flights: FlightLeg[];
  itinerary: ProgramDoc["itinerary"];
  services: ProgramDoc["services"];
  meals_ar: string | null;
  meals_en: string | null;
  terms_ar: string | null;
  terms_en: string | null;
  cover_media_id: string | null;
  gallery: string[];
  base_price: number;
  base_cost: number | null;
  hotel_options: HotelOptionInput[];
  extra_prices: ProgramDoc["extra_prices"];
  price_note_ar: string | null;
  price_note_en: string | null;
  departures: DepartureInput[];
}

export type ProgramEditorData = Omit<ProgramInput, "departures" | "hotel_options"> & {
  id: number;
  code: string;
  slug: string;
  status: ProgramStatus;
  view_count: number;
  published_at: string | null;
  updated_at: string;
  share: ProgramDoc["share"];
  hotel_options: (HotelOption & { rate_id: string | null; refresh_rate: boolean })[];
  departures: (DepartureInput & { id: number; code: string; confirmed: number })[];
  legacy_prices: ProgramDoc["legacy_prices"] | null;
};

export async function getProgramDoc(id: number) {
  return (await programs()).findOne({ _id: id });
}

export async function getProgramEditor(id: number): Promise<ProgramEditorData | null> {
  const p = await getProgramDoc(id);
  if (!p) return null;
  const deps = await (await departures()).find({ program_id: id }).sort({ depart_date: 1 }).toArray();
  return {
    id: p._id,
    code: p.code,
    slug: p.slug,
    status: p.status,
    view_count: p.view_count,
    published_at: p.published_at,
    updated_at: p.updated_at,
    share: p.share,
    type: p.type,
    visibility: p.visibility,
    featured: p.featured,
    title_ar: p.title_ar,
    title_en: p.title_en,
    summary_ar: p.summary_ar,
    summary_en: p.summary_en,
    description_ar: p.description_ar,
    description_en: p.description_en,
    destination_ids: p.destination_ids,
    duration_days: p.duration_days,
    duration_nights: p.duration_nights,
    currency: p.currency,
    departure_airport: p.departure_airport,
    airline_ids: p.airline_ids,
    flights: p.flights,
    itinerary: p.itinerary,
    services: p.services,
    meals_ar: p.meals_ar,
    meals_en: p.meals_en,
    terms_ar: p.terms_ar,
    terms_en: p.terms_en,
    cover_media_id: p.cover_media_id,
    gallery: p.gallery,
    base_price: p.base_price,
    base_cost: p.base_cost,
    hotel_options: p.hotel_options.map((o) => ({ ...o, rate_id: o.rate_snapshot?.rate_id ?? null, refresh_rate: false })),
    extra_prices: p.extra_prices,
    price_note_ar: p.price_note_ar,
    price_note_en: p.price_note_en,
    legacy_prices: p.legacy_prices ?? null,
    departures: deps.map((d) => ({
      id: d._id,
      code: d.code,
      depart_date: d.depart_date,
      return_date: d.return_date,
      seats_total: d.seats_total,
      seats_held: d.seats_held,
      price_supplement: d.price_supplement,
      status: d.status,
      note_ar: d.note_ar,
      note_en: d.note_en,
      confirmed: d.seats_confirmed,
    })),
  };
}

const pricingOf = (p: Pick<ProgramDoc, "base_price" | "base_cost">): ProgramPricing => ({ base_price: p.base_price, base_cost: p.base_cost });

export class ProgramSaveError extends UserFacingError {}

export interface SaveRights {
  /** May change prices, costs, hotel options and currency. */
  pricing: boolean;
  /** May set a manual final price on a hotel option. */
  override: boolean;
}

/**
 * Saves a program, its hotel options (with rate snapshots) and its departures atomically.
 * Staff without pricing rights keep every price-related field exactly as stored.
 */
export async function saveProgram(id: number | null, input: ProgramInput, userId: number, rights: SaveRights): Promise<number> {
  const t = now();
  const existing = id ? await getProgramDoc(id) : null;
  if (id && !existing) throw new ProgramSaveError("البرنامج غير موجود.");

  // Hotel options: rate snapshots are built from the library on the server, never from the client.
  let options: HotelOption[] = [];
  if (rights.pricing) {
    const hotelIds = [...new Set(input.hotel_options.map((o) => o.hotel_id))];
    const hotelDocs = new Map((await (await col<HotelDoc>("hotels")).find({ _id: { $in: hotelIds } }).toArray()).map((h) => [h._id, h]));
    const old = new Map((existing?.hotel_options ?? []).map((o) => [o.id, o]));
    options = input.hotel_options.map((o) => {
      const hotel = hotelDocs.get(o.hotel_id);
      if (!hotel) throw new ProgramSaveError("أحد الفنادق المختارة غير موجود.");
      const prev = o.id ? old.get(o.id) : undefined;
      let snapshot: RateSnapshot | null = null;
      if (o.source === "library") {
        if (!o.rate_id) throw new ProgramSaveError(`اختر سعر الغرفة من مكتبة الفنادق لفندق «${hotel.name_ar}» أو حوّل السعر إلى «سعر خاص بهذا البرنامج».`);
        if (prev?.rate_snapshot?.rate_id === o.rate_id && !o.refresh_rate) snapshot = prev.rate_snapshot;
        else {
          const rate = hotel.rates.find((r) => r.id === o.rate_id);
          if (!rate) throw new ProgramSaveError(`السعر المختار لم يعد موجوداً في مكتبة فندق «${hotel.name_ar}».`);
          snapshot = { rate_id: rate.id, currency: rate.currency, price: rate.price, cost: rate.cost, basis: rate.basis, occupancy: rate.occupancy, captured_at: t };
        }
        if (snapshot.currency !== input.currency && !(o.fx_rate && o.fx_rate > 0))
          throw new ProgramSaveError(`سعر فندق «${hotel.name_ar}» بعملة ${snapshot.currency} وعملة البرنامج ${input.currency}: أدخل سعر الصرف.`);
      }
      return {
        id: prev ? prev.id : randomUUID(),
        hotel_id: o.hotel_id,
        room_type_id: o.room_type_id,
        room_ar: o.room_ar,
        room_en: o.room_en,
        occupancy: o.occupancy,
        board: o.board,
        nights: o.nights,
        basis: o.basis,
        night_price: o.night_price,
        night_cost: o.night_cost,
        source: o.source,
        rate_snapshot: snapshot,
        fx_rate: snapshot && snapshot.currency !== input.currency ? o.fx_rate : null,
        // A manual final price needs its own permission; otherwise the stored one is kept.
        final_price_override: rights.override ? o.final_price_override : (prev?.final_price_override ?? null),
        note_ar: o.note_ar,
        note_en: o.note_en,
      };
    });
  } else {
    options = existing?.hotel_options ?? [];
  }

  const pricing = rights.pricing
    ? { currency: input.currency, base_price: input.base_price, base_cost: input.base_cost, extra_prices: input.extra_prices }
    : {
        currency: existing?.currency ?? input.currency,
        base_price: existing?.base_price ?? 0,
        base_cost: existing?.base_cost ?? null,
        extra_prices: existing?.extra_prices ?? [],
      };
  const isCustom = input.type === "custom";
  const countryCodes = (await (await col<{ _id: number; country_code: string }>("destinations")).find({ _id: { $in: input.destination_ids } }).toArray()).map((d) => d.country_code);

  const doc = {
    type: input.type,
    visibility: input.visibility,
    featured: input.featured,
    title_ar: input.title_ar,
    title_en: input.title_en,
    summary_ar: input.summary_ar,
    summary_en: input.summary_en,
    description_ar: input.description_ar,
    description_en: input.description_en,
    destination_ids: input.destination_ids,
    country_codes: [...new Set(countryCodes)],
    duration_days: input.duration_days,
    duration_nights: input.duration_nights,
    departure_airport: input.departure_airport,
    airline_ids: input.airline_ids,
    flights: input.flights,
    itinerary: input.itinerary,
    services: input.services,
    meals_ar: input.meals_ar,
    meals_en: input.meals_en,
    terms_ar: input.terms_ar,
    terms_en: input.terms_en,
    cover_media_id: input.cover_media_id,
    gallery: input.gallery,
    ...pricing,
    hotel_options: options,
    price_note_ar: input.price_note_ar,
    price_note_en: input.price_note_en,
    // Tailor-made programs never show a price before staff approve a quote.
    price_from: isCustom ? null : priceFrom(pricingOf(pricing), options),
    updated_by: userId,
    updated_at: t,
  };

  // Ids and codes come from atomic counters outside the transaction (gaps after a retry are harmless).
  const programId = id ?? (await nextId("programs"));
  const code = existing?.code ?? (await nextRef("PRG"));
  const slug = await uniqueSlug("programs", input.slug || input.title_en || "", code.toLowerCase(), programId);

  await tx(async (session) => {
    const pc = await programs();
    if (existing) {
      await pc.updateOne({ _id: programId }, { $set: { ...doc, slug } }, { session });
    } else {
      await pc.insertOne(
        { _id: programId, code, slug, status: "draft", share: null, view_count: 0, published_at: null, created_by: userId, created_at: t, ...doc },
        { session },
      );
    }

    // Departures: updated in place (requests reference them), added, or removed when unused.
    const dc = await departures();
    const current = await dc.find({ program_id: programId }, { session }).toArray();
    const byId = new Map(current.map((d) => [d._id, d]));
    const keep = new Set<number>();
    for (const d of isCustom ? [] : input.departures) {
      const owned = d.id ? byId.get(d.id) : undefined;
      const supplement = rights.pricing ? d.price_supplement : (owned?.price_supplement ?? 0);
      if (owned) {
        keep.add(owned._id);
        // Seats can never drop below what is already confirmed (checked atomically).
        const r = await dc.updateOne(
          { _id: owned._id, $expr: { $lte: [{ $add: [d.seats_held, "$seats_confirmed"] }, d.seats_total] } },
          {
            $set: {
              depart_date: d.depart_date,
              return_date: d.return_date,
              seats_total: d.seats_total,
              seats_held: d.seats_held,
              price_supplement: supplement,
              status: d.status,
              note_ar: d.note_ar,
              note_en: d.note_en,
              updated_at: t,
            },
          },
          { session },
        );
        if (!r.matchedCount) throw new ProgramSaveError(`مقاعد موعد ${owned.code} أقل من الطلبات المؤكدة (${owned.seats_confirmed}) والمحجوز خارج الموقع.`);
      } else {
        const newId = await nextId("departures");
        await dc.insertOne(
          {
            _id: newId,
            code: await nextRef("GRP"),
            program_id: programId,
            depart_date: d.depart_date,
            return_date: d.return_date,
            seats_total: d.seats_total,
            seats_held: d.seats_held,
            seats_confirmed: 0,
            price_supplement: supplement,
            status: d.status,
            note_ar: d.note_ar,
            note_en: d.note_en,
            created_at: t,
            updated_at: t,
          },
          { session },
        );
        keep.add(newId);
      }
    }
    const removed = current.filter((d) => !keep.has(d._id));
    if (removed.length) {
      const leads = await (await col("leads")).countDocuments({ departure_id: { $in: removed.map((d) => d._id) }, status: { $nin: ["cancelled", "lost"] } }, { session });
      if (leads) throw new ProgramSaveError("لا يمكن حذف موعد عليه طلبات مسافرين. غيّر حالته إلى «ملغى» بدلاً من ذلك.");
      await dc.deleteMany({ _id: { $in: removed.map((d) => d._id) } }, { session });
    }

    const priceChanged =
      existing &&
      (existing.base_price !== doc.base_price ||
        existing.currency !== doc.currency ||
        JSON.stringify(existing.hotel_options.map((o) => [o.id, o.night_price, o.final_price_override])) !== JSON.stringify(options.map((o) => [o.id, o.night_price, o.final_price_override])));
    await audit(
      userId,
      existing ? "update" : "create",
      "program",
      programId,
      priceChanged ? { pricing: { before: { base_price: existing!.base_price, price_from: existing!.price_from }, after: { base_price: doc.base_price, price_from: doc.price_from } } } : null,
      { session },
    );
  });
  return programId;
}

/** Problems that block publishing (an incomplete offer must not go live). */
export async function publishProblems(id: number): Promise<string[]> {
  const p = await getProgramEditor(id);
  if (!p) return ["البرنامج غير موجود."];
  const problems: string[] = [];
  if (!p.cover_media_id) problems.push("أضف صورة الغلاف.");
  if (!p.summary_ar) problems.push("أضف وصفاً مختصراً بالعربية.");
  if (!p.itinerary.length) problems.push("أضف البرنامج اليومي (يوم واحد على الأقل).");
  if (p.type === "fixed") {
    if (!p.departures.some((d) => d.depart_date > todayDay() && d.status !== "cancelled")) problems.push("البرنامج العام يحتاج موعد سفر قادماً واحداً على الأقل.");
    const doc = (await getProgramDoc(id))!;
    if (!(doc.price_from && doc.price_from > 0)) problems.push("أضف السعر: السعر الأساسي أو خيار فندق واحداً على الأقل بسعر.");
  }
  return problems;
}

export async function setProgramStatus(id: number, status: ProgramStatus, userId: number) {
  const t = now();
  const p = await getProgramDoc(id);
  if (!p) return;
  const set: Partial<ProgramDoc> = { status, updated_by: userId, updated_at: t };
  if (status === "published") {
    set.published_at = p.published_at ?? t;
    // Every published program gets its own shareable link (enabled on first publish).
    if (!p.share) set.share = { token: randomToken(18), enabled: true };
  }
  await (await programs()).updateOne({ _id: id }, { $set: set });
  await audit(userId, `status:${status}`, "program", id);
}

/** Enables, disables or renews a program's independent share link. */
export async function setShareLink(id: number, action: "enable" | "disable" | "regenerate", userId: number) {
  const p = await getProgramDoc(id);
  if (!p) return null;
  const share = action === "regenerate" || !p.share ? { token: randomToken(18), enabled: action !== "disable" } : { token: p.share.token, enabled: action === "enable" };
  await (await programs()).updateOne({ _id: id }, { $set: { share, updated_at: now() } });
  await audit(userId, `share:${action}`, "program", id);
  return share;
}

export async function deleteProgram(id: number, userId: number) {
  await tx(async (session) => {
    const pc = await programs();
    const leads = await (await col("leads")).countDocuments({ program_id: id, status: { $nin: ["cancelled", "lost"] } }, { session });
    if (leads) throw new ProgramSaveError("على هذا البرنامج طلبات مسافرين مفتوحة أو مؤكدة. أرشفه بدلاً من حذفه.");
    await (await departures()).deleteMany({ program_id: id }, { session });
    await pc.deleteOne({ _id: id }, { session });
    await audit(userId, "delete", "program", id, null, { session });
  });
}

export async function duplicateProgram(id: number, userId: number, rights: SaveRights): Promise<number | null> {
  const p = await getProgramEditor(id);
  if (!p) return null;
  return saveProgram(
    null,
    {
      ...p,
      title_ar: `${p.title_ar} (نسخة)`,
      title_en: p.title_en ? `${p.title_en} (copy)` : null,
      slug: null,
      featured: false,
      // New option ids; snapshots are re-taken from the current library (the copy is a new offer).
      hotel_options: p.hotel_options.map((o) => ({ ...o, id: null, refresh_rate: true })),
      departures: [],
    },
    userId,
    { ...rights, override: true },
  );
}

/** All departures across programs, for the "Groups" staff page. */
export async function listDeparturesStaff(opts: { scope?: "upcoming" | "past" | "all" } = {}) {
  const today = todayDay();
  const filter: Filter<DepartureDoc> = opts.scope === "past" ? { depart_date: { $lt: today } } : opts.scope === "all" ? {} : { depart_date: { $gte: today } };
  const rows = await (await departures()).find(filter).sort({ depart_date: opts.scope === "past" ? -1 : 1 }).limit(500).toArray();
  const progs = new Map(
    (await (await programs()).find({ _id: { $in: [...new Set(rows.map((r) => r.program_id))] } }, { projection: { title_ar: 1, status: 1, currency: 1 } }).toArray()).map((p) => [p._id, p]),
  );
  const requests = new Map(
    (
      await (await col("leads"))
        .aggregate<{ _id: number; n: number }>([{ $match: { departure_id: { $in: rows.map((r) => r._id) }, status: { $nin: ["cancelled", "lost"] } } }, { $group: { _id: "$departure_id", n: { $sum: 1 } } }])
        .toArray()
    ).map((r) => [r._id, r.n]),
  );
  return rows.map((r) => ({
    id: r._id,
    code: r.code,
    program_id: r.program_id,
    depart_date: r.depart_date,
    return_date: r.return_date,
    seats_total: r.seats_total,
    seats_held: r.seats_held,
    price_supplement: r.price_supplement,
    status: r.status,
    title_ar: progs.get(r.program_id)?.title_ar ?? "",
    program_status: (progs.get(r.program_id)?.status ?? "draft") as ProgramStatus,
    currency: progs.get(r.program_id)?.currency ?? "USD",
    requests: requests.get(r._id) ?? 0,
    ...departureState(r, today),
  }));
}

export async function getDeparture(id: number) {
  return (await departures()).findOne({ _id: id });
}

export async function updateDepartureQuick(id: number, input: { seats_total: number; seats_held: number; status: DepartureStatus }, userId: number): Promise<boolean> {
  const r = await (await departures()).updateOne(
    { _id: id, $expr: { $lte: [{ $add: [input.seats_held, "$seats_confirmed"] }, input.seats_total] } },
    { $set: { ...input, updated_at: now() } },
  );
  if (r.matchedCount) await audit(userId, "update", "departure", id, input);
  return r.matchedCount === 1;
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
  priceSupplement: number;
  note: string | null;
}

export interface ProgramCard {
  id: number;
  slug: string;
  type: ProgramType;
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
  hotelStars: number[];
  publishedAt: string | null;
}

async function buildCards(rows: ProgramDoc[], locale: Locale): Promise<ProgramCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r._id);
  const today = todayDay();
  const [dests, svc, deps, media, hotelStars] = await Promise.all([
    (await col<{ _id: number; country_code: string; name_ar: string; name_en: string }>("destinations")).find({ _id: { $in: [...new Set(rows.flatMap((r) => r.destination_ids))] } }).toArray(),
    (await col<{ _id: number; icon: string; name_ar: string; name_en: string; active: boolean }>("services")).find({ active: true }).toArray(),
    (await departures()).find({ program_id: { $in: ids }, depart_date: { $gte: today }, status: { $ne: "cancelled" } }).sort({ depart_date: 1 }).toArray(),
    mediaByIds(rows.map((r) => r.cover_media_id)),
    (await col<HotelDoc>("hotels")).find({ _id: { $in: [...new Set(rows.flatMap((r) => r.hotel_options.map((o) => o.hotel_id)))] } }, { projection: { stars: 1 } }).toArray(),
  ]);
  const destMap = new Map(dests.map((d) => [d._id, d]));
  const svcMap = new Map(svc.map((s) => [s._id, s]));
  const starMap = new Map(hotelStars.map((h) => [h._id, h.stars]));

  return rows.map((r) => {
    const own = r.destination_ids.map((d) => destMap.get(d)).filter((d): d is NonNullable<typeof d> => !!d);
    const codes = [...new Set(own.map((d) => d.country_code))];
    const departures = r.type === "fixed" ? deps.filter((d) => d.program_id === r._id).map((d) => toDeparturePublic(d, locale, today)) : [];
    return {
      id: r._id,
      slug: r.slug,
      type: r.type,
      featured: r.featured,
      title: pick(locale, r.title_ar, r.title_en),
      summary: pick(locale, r.summary_ar, r.summary_en) || null,
      places: own.map((d) => pick(locale, d.name_ar, d.name_en)),
      countries: codes.map((code) => ({ code, name: countryName(code, locale) })),
      days: r.duration_days,
      nights: r.duration_nights,
      currency: r.currency,
      priceFrom: r.type === "custom" ? null : r.price_from,
      priceNote: pick(locale, r.price_note_ar, r.price_note_en) || null,
      cover: r.cover_media_id ? (media.get(r.cover_media_id) ?? null) : null,
      nextDeparture: departures.find((d) => d.bookable) ?? departures[0] ?? null,
      departures,
      services: r.services
        .filter((s) => s.included && svcMap.has(s.service_id))
        .map((s) => {
          const x = svcMap.get(s.service_id)!;
          return { icon: x.icon, name: pick(locale, x.name_ar, x.name_en), note: pick(locale, s.note_ar, s.note_en) || null };
        }),
      hotelStars: [...new Set(r.hotel_options.map((o) => starMap.get(o.hotel_id)).filter((s): s is number => !!s))].sort(),
      publishedAt: r.published_at,
    };
  });
}

function toDeparturePublic(d: DepartureDoc, locale: Locale, today: string): DeparturePublic {
  const s = departureState(d, today);
  return {
    id: d._id,
    code: d.code,
    departDate: d.depart_date,
    returnDate: d.return_date,
    seatsTotal: d.seats_total,
    seatsLeft: s.seatsLeft,
    soldOut: s.soldOut,
    bookable: s.bookable,
    status: d.status,
    priceSupplement: d.price_supplement,
    note: pick(locale, d.note_ar, d.note_en) || null,
  };
}

export interface ProgramFilters {
  country?: string;
  type?: ProgramType;
  duration?: "short" | "week" | "long" | "extended";
  month?: string;
  maxPrice?: number;
  q?: string;
  sort?: "recommended" | "price-asc" | "price-desc" | "soonest";
}

/** Published, publicly listed programs (unlisted ones are reachable only by their share link). */
export async function listPublicPrograms(filters: ProgramFilters, locale: Locale): Promise<ProgramCard[]> {
  const query: Filter<ProgramDoc> = { status: "published", visibility: { $ne: "unlisted" } };
  if (filters.country) query.country_codes = filters.country;
  if (filters.type) query.type = filters.type;
  if (filters.duration) query.duration_days = { $gte: DURATIONS[filters.duration][0], $lte: DURATIONS[filters.duration][1] };
  const rows = await (await programs()).find(query).toArray();
  let cards = await buildCards(rows, locale);

  if (filters.month) {
    // Fixed programs must depart that month; tailor-made trips can be requested for any month.
    cards = cards.filter((c) => c.type === "custom" || c.departures.some((d) => d.departDate.startsWith(filters.month!)));
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

export async function publicFacets(locale: Locale) {
  const cards = await listPublicPrograms({}, locale);
  const countries = new Map<string, { code: string; name: string; count: number }>();
  for (const c of cards) for (const x of c.countries) countries.set(x.code, { ...x, count: (countries.get(x.code)?.count ?? 0) + 1 });
  const months = [...new Set(cards.flatMap((c) => c.departures.map((d) => d.departDate.slice(0, 7))))].sort();
  const currencies = [...new Set(cards.filter((c) => c.type === "fixed").map((c) => c.currency))];
  return {
    total: cards.length,
    fixed: cards.filter((c) => c.type === "fixed").length,
    custom: cards.filter((c) => c.type === "custom").length,
    countries: [...countries.values()].sort((a, b) => b.count - a.count),
    months,
    currency: currencies.length === 1 ? currencies[0] : null,
  };
}

export async function featuredPrograms(locale: Locale, limit = 6) {
  return (await listPublicPrograms({ sort: "recommended" }, locale)).slice(0, limit);
}

/** Upcoming departures across all published fixed programs. */
export async function upcomingDepartures(locale: Locale, limit = 12) {
  const cards = await listPublicPrograms({ type: "fixed" }, locale);
  return cards
    .flatMap((c) => c.departures.map((d) => ({ program: c, departure: d })))
    .sort((a, b) => a.departure.departDate.localeCompare(b.departure.departDate))
    .slice(0, limit);
}

/** One hotel choice of a program as travelers see it (selling prices only, never costs). */
export interface HotelChoice {
  id: string;
  hotel: HotelPublic;
  room: string | null;
  occupancy: number;
  board: Board | null;
  nights: number;
  basis: RateBasis;
  /** Null for tailor-made programs (no price before a staff-approved quote). */
  nightPrice: number | null;
  hotelPerPerson: number | null;
  pricePerPerson: number | null;
  note: string | null;
}

export interface ProgramDetail extends ProgramCard {
  code: string;
  description: string | null;
  meals: string | null;
  terms: string | null;
  gallery: MediaRef[];
  itinerary: { day: number; title: string; body: string | null }[];
  hotelChoices: HotelChoice[];
  included: ServiceChip[];
  excluded: ServiceChip[];
  extraPrices: { label: string; amount: number }[];
  basePrice: number | null;
  departureAirport: string | null;
  airlines: { name: string; iata: string | null; logo: MediaRef | null }[];
  flights: { direction: FlightLeg["direction"]; airline: string | null; flightNo: string | null; from: string | null; to: string | null; day: number | null; departTime: string | null; arriveTime: string | null; note: string | null }[];
  updatedAt: string;
  shareToken: string | null;
}

export async function getPublicProgram(slug: string, locale: Locale): Promise<ProgramDetail | null> {
  const row = await (await programs()).findOne({ slug, status: "published" });
  return row ? buildDetail(row, locale) : null;
}

/** Program behind an enabled share link (published only; unlisted programs included). */
export async function getSharedProgram(token: string, locale: Locale): Promise<ProgramDetail | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const row = await (await programs()).findOne({ "share.token": token, "share.enabled": true, status: "published" });
  return row ? buildDetail(row, locale) : null;
}

export async function sharedProgramLocale(token: string) {
  const row = await (await programs()).findOne({ "share.token": token }, { projection: { title_en: 1 } });
  return row ? (row.title_en ? "both" : "ar") : null;
}

/** Staff preview of any program (draft included). */
export async function getProgramPreview(id: number, locale: Locale): Promise<ProgramDetail | null> {
  const row = await getProgramDoc(id);
  return row ? buildDetail(row, locale) : null;
}

async function buildDetail(row: ProgramDoc, locale: Locale): Promise<ProgramDetail> {
  const [card] = await buildCards([row], locale);
  const [media, hotels, svc, airlines] = await Promise.all([
    mediaByIds(row.gallery),
    hotelsPublic(row.hotel_options.map((o) => o.hotel_id), locale),
    (await col<{ _id: number; icon: string; name_ar: string; name_en: string; active: boolean }>("services")).find({ _id: { $in: row.services.map((s) => s.service_id) }, active: true }).toArray(),
    (await col<{ _id: number; name_ar: string; name_en: string; iata: string | null; logo_media_id: string | null }>("airlines"))
      .find({ _id: { $in: [...new Set([...row.airline_ids, ...row.flights.map((f) => f.airline_id).filter((a): a is number => !!a)])] } })
      .toArray(),
  ]);
  const airlineLogos = await mediaByIds(airlines.map((a) => a.logo_media_id));
  const svcMap = new Map(svc.map((s) => [s._id, s]));
  const airlineMap = new Map(airlines.map((a) => [a._id, a]));
  const chip = (s: ProgramDoc["services"][number]): ServiceChip | null => {
    const x = svcMap.get(s.service_id);
    return x ? { icon: x.icon, name: pick(locale, x.name_ar, x.name_en), note: pick(locale, s.note_ar, s.note_en) || null } : null;
  };
  const isCustom = row.type === "custom";
  const pricing = pricingOf(row);

  return {
    ...card,
    code: row.code,
    description: pick(locale, row.description_ar, row.description_en) || null,
    meals: pick(locale, row.meals_ar, row.meals_en) || null,
    terms: pick(locale, row.terms_ar, row.terms_en) || null,
    gallery: row.gallery.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
    itinerary: row.itinerary.map((d, i) => ({ day: i + 1, title: pick(locale, d.title_ar, d.title_en), body: pick(locale, d.body_ar, d.body_en) || null })),
    hotelChoices: row.hotel_options
      .map((o): HotelChoice | null => {
        const hotel = hotels.get(o.hotel_id);
        if (!hotel) return null;
        return {
          id: o.id,
          hotel,
          room: pick(locale, o.room_ar, o.room_en) || null,
          occupancy: o.occupancy,
          board: o.board,
          nights: o.nights,
          basis: o.basis,
          nightPrice: isCustom ? null : o.night_price,
          hotelPerPerson: isCustom ? null : hotelPerPerson(o),
          pricePerPerson: isCustom ? null : optionPrice(pricing, o),
          note: pick(locale, o.note_ar, o.note_en) || null,
        };
      })
      .filter((h): h is HotelChoice => !!h),
    included: row.services.filter((s) => s.included).map(chip).filter((c): c is ServiceChip => !!c),
    excluded: row.services.filter((s) => !s.included).map(chip).filter((c): c is ServiceChip => !!c),
    extraPrices: isCustom ? [] : row.extra_prices.map((p) => ({ label: pick(locale, p.label_ar, p.label_en), amount: p.amount })),
    basePrice: isCustom || !row.base_price ? null : row.base_price,
    departureAirport: row.departure_airport ? pick(locale, row.departure_airport.name_ar, row.departure_airport.name_en) || row.departure_airport.code : null,
    airlines: row.airline_ids
      .map((a) => airlineMap.get(a))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => ({ name: pick(locale, a.name_ar, a.name_en), iata: a.iata, logo: a.logo_media_id ? (airlineLogos.get(a.logo_media_id) ?? null) : null })),
    flights: row.flights.map((f) => ({
      direction: f.direction,
      airline: f.airline_id ? (() => {
        const a = airlineMap.get(f.airline_id!);
        return a ? pick(locale, a.name_ar, a.name_en) : null;
      })() : null,
      flightNo: f.flight_no,
      from: f.from,
      to: f.to,
      day: f.day,
      departTime: f.depart_time,
      arriveTime: f.arrive_time,
      note: f.note,
    })),
    updatedAt: row.updated_at,
    shareToken: row.share?.enabled ? row.share.token : null,
  };
}

/** INTERNAL: per-option cost and margin for the staff program page. */
export async function programInternalPricing(id: number) {
  const p = await getProgramDoc(id);
  if (!p) return null;
  return p.hotel_options.map((o) => ({ id: o.id, hotel_id: o.hotel_id, price: optionPrice(pricingOf(p), o), ...optionMargin(pricingOf(p), o) }));
}

export async function relatedPrograms(program: ProgramCard, locale: Locale, limit = 3) {
  const codes = new Set(program.countries.map((c) => c.code));
  const others = (await listPublicPrograms({}, locale)).filter((c) => c.id !== program.id);
  const same = others.filter((c) => c.countries.some((x) => codes.has(x.code)));
  return [...same, ...others.filter((c) => !same.includes(c))].slice(0, limit);
}

/** Published programs that include a hotel (for the public hotel page). */
export async function programsWithHotel(hotelId: number, locale: Locale) {
  const rows = await (await programs()).find({ status: "published", visibility: { $ne: "unlisted" }, "hotel_options.hotel_id": hotelId }).toArray();
  return buildCards(rows, locale);
}

export async function recordProgramView(id: number) {
  await (await programs()).updateOne({ _id: id, status: "published" }, { $inc: { view_count: 1 } });
}

export async function publicProgramSlugs() {
  return (await (await programs()).find({ status: "published", visibility: { $ne: "unlisted" } }, { projection: { slug: 1, updated_at: 1 } }).toArray()).map((p) => ({ slug: p.slug, updated_at: p.updated_at }));
}

/** For the request form: a bookable departure of a published program. */
export async function departureForRequest(programId: number, departureId: number) {
  const d = await (await departures()).findOne({ _id: departureId, program_id: programId });
  if (!d) return null;
  return { row: d, state: departureState(d) };
}

/** Upcoming departures in a date window (dashboard). */
export async function departuresBetween(from: string, days: number) {
  return (await departures()).countDocuments({ depart_date: { $gte: from, $lte: addDays(from, days) }, status: { $ne: "cancelled" } });
}
