import "server-only";
import type { Locale } from "@/content/site";
import { countryName } from "@/lib/countries";
import type { MediaRef } from "@/lib/media";
import { slugify } from "@/lib/slug";
import { pick } from "@/lib/travel-labels";
import { all, get, now, placeholders, run, tx } from "../db";
import { mediaById, mediaByIds } from "../media";

// ------------------------------------------------------------------ Destinations
export interface DestinationRow {
  id: number;
  slug: string;
  country_code: string;
  name_ar: string;
  name_en: string;
  summary_ar: string | null;
  summary_en: string | null;
  cover_media_id: string | null;
  active: number;
}

export function listDestinations(opts: { activeOnly?: boolean } = {}) {
  return all<DestinationRow & { hotels: number; programs: number }>(
    `SELECT d.*, (SELECT COUNT(*) FROM hotels h WHERE h.destination_id = d.id) AS hotels,
            (SELECT COUNT(*) FROM program_destinations pd WHERE pd.destination_id = d.id) AS programs
     FROM destinations d ${opts.activeOnly ? "WHERE d.active = 1" : ""}
     ORDER BY d.country_code, d.name_ar`,
  );
}

export const getDestination = (id: number) => get<DestinationRow>("SELECT * FROM destinations WHERE id = ?", id);

export interface DestinationInput {
  id?: number;
  country_code: string;
  name_ar: string;
  name_en: string;
  summary_ar: string | null;
  summary_en: string | null;
  cover_media_id: string | null;
  active: boolean;
}

/** Unique slug for `table`, derived from `base` (English name or fallback). */
export function uniqueSlug(table: "destinations" | "hotels" | "programs", base: string, fallback: string, exceptId?: number): string {
  const root = slugify(base) || slugify(fallback) || fallback.toLowerCase();
  let slug = root;
  for (let i = 2; get(`SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`, slug, exceptId ?? 0); i++) slug = `${root}-${i}`;
  return slug;
}

export function saveDestination(input: DestinationInput): number {
  const t = now();
  return tx(() => {
    if (input.id) {
      const slug = uniqueSlug("destinations", input.name_en, `dest-${input.id}`, input.id);
      run(
        `UPDATE destinations SET slug = ?, country_code = ?, name_ar = ?, name_en = ?, summary_ar = ?, summary_en = ?, cover_media_id = ?, active = ?, updated_at = ? WHERE id = ?`,
        slug, input.country_code, input.name_ar, input.name_en, input.summary_ar, input.summary_en, input.cover_media_id, input.active, t, input.id,
      );
      return input.id;
    }
    const slug = uniqueSlug("destinations", input.name_en, `dest-${Date.now()}`);
    return run(
      `INSERT INTO destinations (slug, country_code, name_ar, name_en, summary_ar, summary_en, cover_media_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slug, input.country_code, input.name_ar, input.name_en, input.summary_ar, input.summary_en, input.cover_media_id, input.active, t, t,
    ).id;
  });
}

export function deleteDestination(id: number): string | null {
  const used = get<{ h: number; p: number }>(
    "SELECT (SELECT COUNT(*) FROM hotels WHERE destination_id = ?) AS h, (SELECT COUNT(*) FROM program_destinations WHERE destination_id = ?) AS p",
    id,
    id,
  )!;
  if (used.h || used.p) return "لا يمكن حذف وجهة مرتبطة بفنادق أو برامج. أوقف تفعيلها بدلاً من ذلك.";
  run("DELETE FROM destinations WHERE id = ?", id);
  return null;
}

// ------------------------------------------------------------------ Hotels
export interface HotelRow {
  id: number;
  slug: string;
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
  active: number;
  updated_at: string;
}

export function listHotels(opts: { q?: string; destinationId?: number } = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.destinationId) {
    where.push("h.destination_id = ?");
    params.push(opts.destinationId);
  }
  if (opts.q) {
    where.push("(h.name_ar LIKE ? OR h.name_en LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  return all<HotelRow & { dest_name_ar: string; country_code: string; cover: string | null; programs: number }>(
    `SELECT h.*, d.name_ar AS dest_name_ar, d.country_code,
       (SELECT media_id FROM hotel_media hm WHERE hm.hotel_id = h.id ORDER BY sort LIMIT 1) AS cover,
       (SELECT COUNT(DISTINCT program_id) FROM program_hotels ph WHERE ph.hotel_id = h.id) AS programs
     FROM hotels h JOIN destinations d ON d.id = h.destination_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY d.country_code, d.name_ar, h.name_ar`,
    ...params,
  );
}

export const getHotel = (id: number) => get<HotelRow>("SELECT * FROM hotels WHERE id = ?", id);

export const hotelMediaIds = (hotelId: number) =>
  all<{ media_id: string }>("SELECT media_id FROM hotel_media WHERE hotel_id = ? ORDER BY sort", hotelId).map((r) => r.media_id);

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
  active: boolean;
  media: string[];
}

export function saveHotel(input: HotelInput): number {
  const t = now();
  return tx(() => {
    let hotelId = input.id;
    const fields = [
      input.destination_id, input.name_ar, input.name_en, input.stars, input.category_ar, input.category_en,
      input.website_url, input.maps_url, input.address_ar, input.address_en, input.description_ar, input.description_en,
      input.rooms_ar, input.rooms_en, input.active,
    ];
    if (hotelId) {
      const slug = uniqueSlug("hotels", input.name_en, `hotel-${hotelId}`, hotelId);
      run(
        `UPDATE hotels SET destination_id = ?, name_ar = ?, name_en = ?, stars = ?, category_ar = ?, category_en = ?, website_url = ?, maps_url = ?,
           address_ar = ?, address_en = ?, description_ar = ?, description_en = ?, rooms_ar = ?, rooms_en = ?, active = ?, slug = ?, updated_at = ? WHERE id = ?`,
        ...fields, slug, t, hotelId,
      );
    } else {
      const slug = uniqueSlug("hotels", input.name_en, `hotel-${Date.now()}`);
      hotelId = run(
        `INSERT INTO hotels (destination_id, name_ar, name_en, stars, category_ar, category_en, website_url, maps_url, address_ar, address_en,
           description_ar, description_en, rooms_ar, rooms_en, active, slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ...fields, slug, t, t,
      ).id;
    }
    run("DELETE FROM hotel_media WHERE hotel_id = ?", hotelId);
    input.media.forEach((m, i) => run("INSERT INTO hotel_media (hotel_id, media_id, sort) VALUES (?, ?, ?)", hotelId!, m, i));
    return hotelId!;
  });
}

export function deleteHotel(id: number): string | null {
  const used = get<{ n: number }>(
    "SELECT (SELECT COUNT(*) FROM program_hotels WHERE hotel_id = ?) + (SELECT COUNT(*) FROM quote_hotels WHERE hotel_id = ?) AS n",
    id,
    id,
  )!.n;
  if (used) return "هذا الفندق مستخدم في برامج أو عروض أسعار. أوقف تفعيله بدلاً من حذفه.";
  run("DELETE FROM hotels WHERE id = ?", id);
  return null;
}

/** Public hotel info for program pages, quote pages and PDFs. */
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
  websiteUrl: string | null;
  mapsUrl: string | null;
  images: MediaRef[];
}

export function hotelsPublic(ids: number[], locale: Locale): Map<number, HotelPublic> {
  if (!ids.length) return new Map();
  const rows = all<HotelRow & { d_ar: string; d_en: string; country_code: string }>(
    `SELECT h.*, d.name_ar AS d_ar, d.name_en AS d_en, d.country_code FROM hotels h JOIN destinations d ON d.id = h.destination_id
     WHERE h.id IN (${placeholders(ids.length)})`,
    ...ids,
  );
  const mediaRows = all<{ hotel_id: number; media_id: string }>(
    `SELECT hotel_id, media_id FROM hotel_media WHERE hotel_id IN (${placeholders(ids.length)}) ORDER BY sort`,
    ...ids,
  );
  const media = mediaByIds([...new Set(mediaRows.map((m) => m.media_id))]);
  return new Map(
    rows.map((h) => [
      h.id,
      {
        id: h.id,
        slug: h.slug,
        name: pick(locale, h.name_ar, h.name_en),
        stars: h.stars,
        category: pick(locale, h.category_ar, h.category_en) || null,
        city: pick(locale, h.d_ar, h.d_en),
        country: countryName(h.country_code, locale),
        countryCode: h.country_code,
        address: pick(locale, h.address_ar, h.address_en) || null,
        description: pick(locale, h.description_ar, h.description_en) || null,
        rooms: pick(locale, h.rooms_ar, h.rooms_en) || null,
        websiteUrl: h.website_url,
        mapsUrl: h.maps_url,
        images: mediaRows.filter((m) => m.hotel_id === h.id).map((m) => media.get(m.media_id)).filter((m): m is MediaRef => !!m),
      },
    ]),
  );
}

/**
 * Public hotel page data. Only hotels that appear in a published program are public; other
 * hotels (e.g. used only in private company quotes) are not exposed on the website.
 */
export function publicHotelBySlug(slug: string, locale: Locale) {
  const row = get<{ id: number }>(
    `SELECT h.id FROM hotels h WHERE h.slug = ? AND h.active = 1 AND EXISTS (
       SELECT 1 FROM program_hotels ph JOIN programs p ON p.id = ph.program_id WHERE ph.hotel_id = h.id AND p.status = 'published')`,
    slug,
  );
  if (!row) return null;
  return hotelsPublic([row.id], locale).get(row.id) ?? null;
}

export const isHotelPublic = (hotelId: number) =>
  !!get(
    `SELECT 1 FROM hotels h WHERE h.id = ? AND h.active = 1 AND EXISTS (
       SELECT 1 FROM program_hotels ph JOIN programs p ON p.id = ph.program_id WHERE ph.hotel_id = h.id AND p.status = 'published')`,
    hotelId,
  );

export function publicHotelSlugs() {
  return all<{ slug: string; updated_at: string }>(
    `SELECT DISTINCT h.slug, h.updated_at FROM hotels h JOIN program_hotels ph ON ph.hotel_id = h.id
     JOIN programs p ON p.id = ph.program_id WHERE p.status = 'published' AND h.active = 1`,
  );
}

// ------------------------------------------------------------------ Services
export interface ServiceRow {
  id: number;
  icon: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: number;
}

export const listServices = (activeOnly = false) =>
  all<ServiceRow & { programs: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM program_services ps WHERE ps.service_id = s.id) AS programs FROM services s
     ${activeOnly ? "WHERE s.active = 1" : ""} ORDER BY s.sort, s.id`,
  );

export function saveService(input: { id?: number; icon: string; name_ar: string; name_en: string; sort: number; active: boolean }) {
  const t = now();
  if (input.id) {
    run("UPDATE services SET icon = ?, name_ar = ?, name_en = ?, sort = ?, active = ?, updated_at = ? WHERE id = ?", input.icon, input.name_ar, input.name_en, input.sort, input.active, t, input.id);
    return input.id;
  }
  return run("INSERT INTO services (icon, name_ar, name_en, sort, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", input.icon, input.name_ar, input.name_en, input.sort, input.active, t, t).id;
}

export function deleteService(id: number): string | null {
  if (get("SELECT 1 FROM program_services WHERE service_id = ?", id)) return "هذه الخدمة مستخدمة في برامج. أوقف تفعيلها بدلاً من حذفها.";
  run("DELETE FROM services WHERE id = ?", id);
  return null;
}

export { mediaById };
