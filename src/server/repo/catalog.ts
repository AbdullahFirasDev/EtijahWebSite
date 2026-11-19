import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession, Filter } from "mongodb";
import type { Locale } from "@/content/site";
import { countryName } from "@/lib/countries";
import type { MediaRef } from "@/lib/media";
import { slugify } from "@/lib/slug";
import { pick, type Board } from "@/lib/travel-labels";
import { col, contains, nextId, now, tx } from "../db";
import { mediaByIds } from "../media";
import { audit } from "../security";

// ------------------------------------------------------------------ Destinations
export interface DestinationDoc {
  _id: number;
  slug: string;
  country_code: string;
  name_ar: string;
  name_en: string;
  /** City, or a tourist area (resort, island, region, landmark). Older rows have none: treated as city. */
  kind?: DestinationKind;
  /** Nearest airport (IATA), used to suggest flights in the program wizard. */
  airport_code?: string | null;
  /** Slug of the reference row it came from (src/data/destinations.ts), when imported. */
  ref?: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  cover_media_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type DestinationKind = "city" | "area";
export type DestinationRow = Omit<DestinationDoc, "_id"> & { id: number };

const destinations = () => col<DestinationDoc>("destinations");
const toDest = ({ _id, ...d }: DestinationDoc): DestinationRow => ({ id: _id, ...d });

export async function listDestinations(opts: { activeOnly?: boolean } = {}) {
  const rows = await (await destinations()).find(opts.activeOnly ? { active: true } : {}).sort({ country_code: 1, name_ar: 1 }).toArray();
  const ids = rows.map((r) => r._id);
  const [hotelCounts, programCounts] = await Promise.all([
    (await hotels()).aggregate<{ _id: number; n: number }>([{ $match: { destination_id: { $in: ids } } }, { $group: { _id: "$destination_id", n: { $sum: 1 } } }]).toArray(),
    (await col("programs")).aggregate<{ _id: number; n: number }>([{ $match: { destination_ids: { $in: ids } } }, { $unwind: "$destination_ids" }, { $group: { _id: "$destination_ids", n: { $sum: 1 } } }]).toArray(),
  ]);
  const hc = new Map(hotelCounts.map((r) => [r._id, r.n]));
  const pc = new Map(programCounts.map((r) => [r._id, r.n]));
  return rows.map((r) => ({ ...toDest(r), hotels: hc.get(r._id) ?? 0, programs: pc.get(r._id) ?? 0 }));
}

export async function getDestination(id: number) {
  const d = await (await destinations()).findOne({ _id: id });
  return d ? toDest(d) : null;
}

export interface DestinationInput {
  id?: number;
  country_code: string;
  name_ar: string;
  name_en: string;
  kind: DestinationKind;
  airport_code: string | null;
  summary_ar: string | null;
  summary_en: string | null;
  cover_media_id: string | null;
  active: boolean;
}

/** Unique slug in `collection`, derived from `base` (English name or fallback). */
export async function uniqueSlug(collection: "destinations" | "hotels" | "programs", base: string, fallback: string, exceptId?: number): Promise<string> {
  const c = await col<{ _id: number; slug: string }>(collection);
  const root = slugify(base) || slugify(fallback) || fallback.toLowerCase();
  let slug = root;
  for (let i = 2; await c.findOne({ slug, _id: { $ne: exceptId ?? 0 } }, { projection: { _id: 1 } }); i++) slug = `${root}-${i}`;
  return slug;
}

export async function saveDestination(input: DestinationInput): Promise<number> {
  const t = now();
  const c = await destinations();
  const fields = {
    country_code: input.country_code,
    name_ar: input.name_ar,
    name_en: input.name_en,
    kind: input.kind,
    airport_code: input.airport_code,
    summary_ar: input.summary_ar,
    summary_en: input.summary_en,
    cover_media_id: input.cover_media_id,
    active: input.active,
  };
  if (input.id) {
    const slug = await uniqueSlug("destinations", input.name_en, `dest-${input.id}`, input.id);
    await tx(async (session) => {
      await c.updateOne({ _id: input.id }, { $set: { ...fields, slug, updated_at: t } }, { session });
      // Hotels carry the destination's country for filtering; keep it in sync.
      await (await hotels()).updateMany({ destination_id: input.id }, { $set: { country_code: input.country_code } }, { session });
    });
    return input.id;
  }
  const id = await nextId("destinations");
  await c.insertOne({ _id: id, slug: await uniqueSlug("destinations", input.name_en, `dest-${id}`), ...fields, created_at: t, updated_at: t });
  return id;
}

export async function deleteDestination(id: number): Promise<string | null> {
  const used = (await (await hotels()).countDocuments({ destination_id: id }, { limit: 1 })) + (await (await col("programs")).countDocuments({ destination_ids: id }, { limit: 1 }));
  if (used) return "لا يمكن حذف وجهة مرتبطة بفنادق أو برامج. أوقف تفعيلها بدلاً من ذلك.";
  await (await destinations()).deleteOne({ _id: id });
  return null;
}

// ------------------------------------------------------------------ Hotels
export const RATE_BASES = ["per_person", "per_room"] as const;
export type RateBasis = (typeof RATE_BASES)[number];

export interface RoomType {
  id: string;
  name_ar: string;
  name_en: string | null;
  max_pax: number;
  notes: string | null;
}

/** A nightly rate. `cost` is INTERNAL (what the hotel charges us); `price` is the suggested selling price. */
export interface HotelRate {
  id: string;
  room_type_id: string;
  board: Board | null;
  basis: RateBasis;
  /** Persons the room holds (and that a per-room price is shared by). */
  occupancy: number;
  currency: string;
  cost: number | null;
  price: number;
  season_ar: string | null;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
  updated_at: string;
}

export interface HotelDoc {
  _id: number;
  slug: string;
  destination_id: number;
  country_code: string;
  name_ar: string;
  name_en: string;
  stars: number | null;
  category_ar: string | null;
  category_en: string | null;
  website_url: string | null;
  maps_url: string | null;
  address_ar: string | null;
  address_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  rooms_ar: string | null;
  rooms_en: string | null;
  amenities: string[];
  contact: { phone: string | null; email: string | null; person: string | null };
  internal_notes: string | null;
  media: string[];
  room_types: RoomType[];
  rates: HotelRate[];
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  rates_updated_at: string | null;
}

const hotels = () => col<HotelDoc>("hotels");
export const hotelsCollection = hotels;

export interface HotelFilters {
  q?: string;
  country?: string;
  destinationId?: number;
  stars?: number;
  status?: "active" | "archived" | "all";
}

export async function listHotels(f: HotelFilters = {}) {
  const filter: Filter<HotelDoc> = {};
  if (f.status !== "all") filter.status = f.status ?? "active";
  if (f.country) filter.country_code = f.country;
  if (f.destinationId) filter.destination_id = f.destinationId;
  if (f.stars) filter.stars = f.stars;
  if (f.q) filter.$or = [{ name_ar: contains(f.q) }, { name_en: contains(f.q) }];
  const rows = await (await hotels()).find(filter).sort({ country_code: 1, name_ar: 1 }).limit(1000).toArray();
  const dests = new Map((await (await destinations()).find({ _id: { $in: [...new Set(rows.map((r) => r.destination_id))] } }).toArray()).map((d) => [d._id, d]));
  const usage = await hotelUsage(rows.map((r) => r._id));
  return rows.map((h) => ({
    id: h._id,
    slug: h.slug,
    name_ar: h.name_ar,
    name_en: h.name_en,
    stars: h.stars,
    destination_id: h.destination_id,
    dest_name_ar: dests.get(h.destination_id)?.name_ar ?? "",
    dest_name_en: dests.get(h.destination_id)?.name_en ?? "",
    country_code: h.country_code,
    website_url: h.website_url,
    maps_url: h.maps_url,
    cover: h.media[0] ?? null,
    status: h.status,
    room_types: h.room_types,
    rates: h.rates,
    rates_count: h.rates.filter((r) => r.active).length,
    rates_updated_at: h.rates_updated_at,
    programs: usage.get(h._id) ?? 0,
  }));
}

/** Number of programs using each hotel (as a hotel option). */
async function hotelUsage(ids: number[]) {
  if (!ids.length) return new Map<number, number>();
  const rows = await (await col("programs"))
    .aggregate<{ _id: number; n: number }>([
      { $match: { "hotel_options.hotel_id": { $in: ids } } },
      { $project: { hotels: { $setUnion: ["$hotel_options.hotel_id", []] } } },
      { $unwind: "$hotels" },
      { $match: { hotels: { $in: ids } } },
      { $group: { _id: "$hotels", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

export async function getHotel(id: number) {
  return (await hotels()).findOne({ _id: id });
}

/** Programs and quotes that use a hotel (for the hotel page). */
export async function hotelUsedBy(id: number) {
  const [programs, quotes] = await Promise.all([
    (await col<{ _id: number; title_ar: string; code: string; status: string; type: string }>("programs"))
      .find({ "hotel_options.hotel_id": id }, { projection: { title_ar: 1, code: 1, status: 1, type: 1 } })
      .sort({ updated_at: -1 })
      .toArray(),
    (await col<{ _id: number; ref: string; title: string; status: string }>("quotes"))
      .find({ "hotels.hotel_id": id }, { projection: { ref: 1, title: 1, status: 1 } })
      .sort({ updated_at: -1 })
      .limit(50)
      .toArray(),
  ]);
  return {
    programs: programs.map((p) => ({ id: p._id, title: p.title_ar, code: p.code, status: p.status, type: p.type })),
    quotes: quotes.map((q) => ({ id: q._id, ref: q.ref, title: q.title, status: q.status })),
  };
}

export interface HotelInput {
  id?: number;
  destination_id: number;
  name_ar: string;
  name_en: string;
  stars: number | null;
  category_ar: string | null;
  category_en: string | null;
  website_url: string | null;
  maps_url: string | null;
  address_ar: string | null;
  address_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  rooms_ar: string | null;
  rooms_en: string | null;
  amenities: string[];
  contact: { phone: string | null; email: string | null; person: string | null };
  internal_notes: string | null;
  media: string[];
  room_types: RoomType[];
  status: "active" | "archived";
}

export async function saveHotel(input: HotelInput, userId: number): Promise<number> {
  const t = now();
  const dest = await getDestination(input.destination_id);
  const c = await hotels();
  const fields = {
    destination_id: input.destination_id,
    country_code: dest?.country_code ?? "",
    name_ar: input.name_ar,
    name_en: input.name_en,
    stars: input.stars,
    category_ar: input.category_ar,
    category_en: input.category_en,
    website_url: input.website_url,
    maps_url: input.maps_url,
    address_ar: input.address_ar,
    address_en: input.address_en,
    description_ar: input.description_ar,
    description_en: input.description_en,
    rooms_ar: input.rooms_ar,
    rooms_en: input.rooms_en,
    amenities: input.amenities,
    contact: input.contact,
    internal_notes: input.internal_notes,
    media: input.media,
    room_types: input.room_types.map((r) => ({ ...r, id: r.id || randomUUID() })),
    status: input.status,
  };
  if (input.id) {
    const slug = await uniqueSlug("hotels", input.name_en, `hotel-${input.id}`, input.id);
    await tx(async (session) => {
      const before = await c.findOne({ _id: input.id }, { session });
      // Rates of a removed room type are deactivated (never deleted: old offers reference them).
      const keep = new Set(fields.room_types.map((r) => r.id));
      const rates = (before?.rates ?? []).map((r) => (keep.has(r.room_type_id) ? r : { ...r, active: false }));
      await c.updateOne({ _id: input.id }, { $set: { ...fields, rates, slug, updated_at: t } }, { session });
      await audit(userId, before?.status !== input.status ? `status:${input.status}` : "update", "hotel", input.id, null, { session });
    });
    return input.id;
  }
  const id = await nextId("hotels");
  await c.insertOne({ _id: id, slug: await uniqueSlug("hotels", input.name_en, `hotel-${id}`), ...fields, rates: [], created_at: t, updated_at: t, rates_updated_at: null });
  await audit(userId, "create", "hotel", id);
  return id;
}

export type RateInput = Omit<HotelRate, "updated_at" | "id"> & { id?: string | null };

/**
 * Replaces a hotel's rate table. Every change is written to the audit log with the old and new
 * values. Programs and quotes keep their own copy of the rate they used, so changing a rate here
 * never alters existing offers.
 */
export async function saveHotelRates(hotelId: number, input: RateInput[], userId: number) {
  const t = now();
  const c = await hotels();
  await tx(async (session) => {
    const hotel = await c.findOne({ _id: hotelId }, { session });
    if (!hotel) throw new Error("hotel not found");
    const old = new Map(hotel.rates.map((r) => [r.id, r]));
    const next: HotelRate[] = input.map((r) => {
      const id = r.id && old.has(r.id) ? r.id : randomUUID();
      const prev = old.get(id);
      const same =
        prev &&
        (["room_type_id", "board", "basis", "occupancy", "currency", "cost", "price", "season_ar", "valid_from", "valid_to", "active"] as const).every((k) => prev[k] === r[k]);
      return { ...r, id, updated_at: same ? prev.updated_at : t };
    });
    // Rates are never hard-deleted while a program or quote may reference them: removed rows are deactivated.
    for (const prev of hotel.rates) if (!next.some((r) => r.id === prev.id)) next.push({ ...prev, active: false, updated_at: t });

    const changes = next
      .map((r) => {
        const prev = old.get(r.id);
        if (!prev) return { rate_id: r.id, change: "added", after: { price: r.price, cost: r.cost, currency: r.currency, basis: r.basis } };
        const diff: Record<string, [unknown, unknown]> = {};
        for (const k of ["price", "cost", "currency", "basis", "occupancy", "board", "valid_from", "valid_to", "active"] as const) if (prev[k] !== r[k]) diff[k] = [prev[k], r[k]];
        return Object.keys(diff).length ? { rate_id: r.id, change: "updated", diff } : null;
      })
      .filter(Boolean);
    await c.updateOne({ _id: hotelId }, { $set: { rates: next, rates_updated_at: t, updated_at: t } }, { session });
    if (changes.length) await audit(userId, "rates", "hotel", hotelId, { changes }, { session });
  });
}

export async function deleteHotel(id: number): Promise<string | null> {
  const used =
    (await (await col("programs")).countDocuments({ "hotel_options.hotel_id": id }, { limit: 1 })) +
    (await (await col("quotes")).countDocuments({ "hotels.hotel_id": id }, { limit: 1 })) +
    (await (await col("company_hotels")).countDocuments({ hotel_id: id }, { limit: 1 }));
  if (used) return "هذا الفندق مستخدم في برامج أو عروض أسعار أو مخصص لشركات. أرشفه بدلاً من حذفه.";
  await (await hotels()).deleteOne({ _id: id });
  return null;
}

/** Library rates valid on `day` (or with no validity set), for the rate pickers. */
export function ratesValidOn(h: Pick<HotelDoc, "rates">, day: string | null) {
  return h.rates.filter((r) => r.active && (!day || ((!r.valid_from || r.valid_from <= day) && (!r.valid_to || r.valid_to >= day))));
}

/** Compact hotel + rates list for the program wizard and quote editor pickers. */
export async function hotelPickerOptions(opts: { includeCosts: boolean }) {
  const rows = await (await hotels()).find({ status: "active" }).sort({ country_code: 1, name_ar: 1 }).toArray();
  const dests = new Map((await (await destinations()).find({}).toArray()).map((d) => [d._id, d]));
  return rows.map((h) => ({
    id: h._id,
    name: h.name_ar,
    name_en: h.name_en,
    stars: h.stars,
    destination_id: h.destination_id,
    city: dests.get(h.destination_id)?.name_ar ?? "",
    country_code: h.country_code,
    hasLink: !!(h.website_url || h.maps_url),
    cover: h.media[0] ?? null,
    room_types: h.room_types.map((r) => ({ id: r.id, name_ar: r.name_ar, name_en: r.name_en, max_pax: r.max_pax })),
    rates: h.rates
      .filter((r) => r.active)
      .map((r) => ({
        id: r.id,
        room_type_id: r.room_type_id,
        board: r.board,
        basis: r.basis,
        occupancy: r.occupancy,
        currency: r.currency,
        price: r.price,
        cost: opts.includeCosts ? r.cost : null,
        season_ar: r.season_ar,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
      })),
  }));
}
export type HotelPickerOption = Awaited<ReturnType<typeof hotelPickerOptions>>[number];

/** Public hotel info for program pages, quote pages, PDFs and the B2B portal (no rates, no costs, no internal notes). */
export interface HotelPublic {
  id: number;
  slug: string;
  name: string;
  stars: number | null;
  category: string | null;
  city: string;
  country: string;
  countryCode: string;
  address: string | null;
  description: string | null;
  rooms: string | null;
  amenities: string[];
  websiteUrl: string | null;
  mapsUrl: string | null;
  images: MediaRef[];
}

export async function hotelsPublic(ids: number[], locale: Locale): Promise<Map<number, HotelPublic>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await (await hotels()).find({ _id: { $in: unique } }).toArray();
  const dests = new Map((await (await destinations()).find({ _id: { $in: rows.map((r) => r.destination_id) } }).toArray()).map((d) => [d._id, d]));
  const media = await mediaByIds(rows.flatMap((r) => r.media));
  return new Map(
    rows.map((h) => {
      const d = dests.get(h.destination_id);
      return [
        h._id,
        {
          id: h._id,
          slug: h.slug,
          name: pick(locale, h.name_ar, h.name_en),
          stars: h.stars,
          category: pick(locale, h.category_ar, h.category_en) || null,
          city: d ? pick(locale, d.name_ar, d.name_en) : "",
          country: countryName(h.country_code, locale),
          countryCode: h.country_code,
          address: pick(locale, h.address_ar, h.address_en) || null,
          description: pick(locale, h.description_ar, h.description_en) || null,
          rooms: pick(locale, h.rooms_ar, h.rooms_en) || null,
          amenities: h.amenities ?? [],
          websiteUrl: h.website_url,
          mapsUrl: h.maps_url,
          images: h.media.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
        },
      ];
    }),
  );
}

/** Hotels that appear in a published, publicly listed program (the only hotels with public pages). */
async function publicHotelIds(): Promise<Set<number>> {
  const rows = await (await col<{ hotel_options: { hotel_id: number }[] }>("programs"))
    .find({ status: "published", visibility: { $ne: "unlisted" } }, { projection: { "hotel_options.hotel_id": 1 } })
    .toArray();
  return new Set(rows.flatMap((p) => (p.hotel_options ?? []).map((o) => o.hotel_id)));
}

/**
 * Public hotel page data. Only hotels that appear in a published program are public; other
 * hotels (e.g. used only in private company quotes) are not exposed on the website.
 */
export async function publicHotelBySlug(slug: string, locale: Locale) {
  const h = await (await hotels()).findOne({ slug, status: "active" }, { projection: { _id: 1 } });
  if (!h || !(await publicHotelIds()).has(h._id)) return null;
  return (await hotelsPublic([h._id], locale)).get(h._id) ?? null;
}

export async function isHotelPublic(hotelId: number) {
  const h = await (await hotels()).findOne({ _id: hotelId, status: "active" }, { projection: { _id: 1 } });
  return !!h && (await publicHotelIds()).has(hotelId);
}

export async function publicHotelSlugs() {
  const ids = [...(await publicHotelIds())];
  return (await (await hotels()).find({ _id: { $in: ids }, status: "active" }, { projection: { slug: 1, updated_at: 1 } }).toArray()).map((h) => ({ slug: h.slug, updated_at: h.updated_at }));
}

// ------------------------------------------------------------------ Services
export interface ServiceDoc {
  _id: number;
  icon: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const services = () => col<ServiceDoc>("services");

export async function listServices(activeOnly = false) {
  const rows = await (await services()).find(activeOnly ? { active: true } : {}).sort({ sort: 1, _id: 1 }).toArray();
  const usage = await (await col("programs"))
    .aggregate<{ _id: number; n: number }>([{ $unwind: "$services" }, { $group: { _id: "$services.service_id", n: { $sum: 1 } } }])
    .toArray();
  const u = new Map(usage.map((r) => [r._id, r.n]));
  return rows.map(({ _id, ...s }) => ({ id: _id, ...s, programs: u.get(_id) ?? 0 }));
}

export async function getService(id: number) {
  return (await services()).findOne({ _id: id });
}

export async function saveService(input: { id?: number; icon: string; name_ar: string; name_en: string; sort: number; active: boolean }) {
  const t = now();
  const fields = { icon: input.icon, name_ar: input.name_ar, name_en: input.name_en, sort: input.sort, active: input.active };
  if (input.id) {
    await (await services()).updateOne({ _id: input.id }, { $set: { ...fields, updated_at: t } });
    return input.id;
  }
  const id = await nextId("services");
  await (await services()).insertOne({ _id: id, ...fields, created_at: t, updated_at: t });
  return id;
}

export async function deleteService(id: number): Promise<string | null> {
  if (await (await col("programs")).findOne({ "services.service_id": id }, { projection: { _id: 1 } })) return "هذه الخدمة مستخدمة في برامج. أوقف تفعيلها بدلاً من حذفها.";
  await (await services()).deleteOne({ _id: id });
  return null;
}

/** Ids that exist in `collection` (for validating references before saving). */
export async function existingIds(collection: "destinations" | "hotels" | "services" | "airlines" | "companies", ids: number[], session?: ClientSession) {
  const unique = [...new Set(ids)];
  if (!unique.length) return true;
  return (await (await col<{ _id: number }>(collection)).countDocuments({ _id: { $in: unique } }, { session })) === unique.length;
}
