import "server-only";
import type { Filter } from "mongodb";
import type { Locale } from "@/content/site";
import { col, nextId, now, tx } from "../db";
import { mediaByIds } from "../media";
import { audit, nextRef } from "../security";
import { hotelsPublic } from "./catalog";
import type { CompanyHotelDoc } from "./companies";

export const B2B_REQUEST_STATUSES = ["new", "in_progress", "quoted", "closed"] as const;
export type B2bRequestStatus = (typeof B2B_REQUEST_STATUSES)[number];
export const B2B_REQUEST_STATUS_LABELS: Record<B2bRequestStatus, { ar: string; en: string }> = {
  new: { ar: "جديد", en: "New" },
  in_progress: { ar: "قيد الإعداد", en: "In progress" },
  quoted: { ar: "أُرسل العرض", en: "Quoted" },
  closed: { ar: "مغلق", en: "Closed" },
};

export interface B2bRequestDoc {
  _id: number;
  ref: string;
  company_id: number;
  company_user_id: number;
  title: string;
  country_codes: string[];
  places: string | null;
  date_from: string | null;
  date_to: string | null;
  nights: number | null;
  adults: number;
  children: number;
  rooms: number;
  hotel_ids: number[];
  hotel_stars: number | null;
  budget: string | null;
  beneficiary: string | null;
  notes: string | null;
  status: B2bRequestStatus;
  quote_id: number | null;
  staff_note: string | null;
  created_at: string;
  updated_at: string;
}

const requests = () => col<B2bRequestDoc>("b2b_requests");

export type B2bRequestInput = Omit<B2bRequestDoc, "_id" | "ref" | "company_id" | "company_user_id" | "status" | "quote_id" | "staff_note" | "created_at" | "updated_at">;

/** Creates a request for the signed-in user's company (the company id comes from the session). */
export async function createB2bRequest(companyId: number, companyUserId: number, input: B2bRequestInput) {
  const t = now();
  const id = await nextId("b2b_requests");
  const ref = await nextRef("B2B");
  await tx(async (session) => {
    await (await requests()).insertOne({ _id: id, ref, company_id: companyId, company_user_id: companyUserId, ...input, status: "new", quote_id: null, staff_note: null, created_at: t, updated_at: t }, { session });
    await audit(companyUserId, "create", "b2b_request", id, { company_id: companyId }, { session, actor: "company" });
  });
  return { id, ref };
}

export async function listB2bRequests(opts: { companyId?: number; status?: B2bRequestStatus | "open" } = {}) {
  const filter: Filter<B2bRequestDoc> = {};
  if (opts.companyId) filter.company_id = opts.companyId;
  if (opts.status === "open") filter.status = { $in: ["new", "in_progress"] };
  else if (opts.status) filter.status = opts.status;
  const rows = await (await requests()).find(filter).sort({ created_at: -1 }).limit(500).toArray();
  const [companies, users] = await Promise.all([
    (await col<{ _id: number; name: string }>("companies")).find({ _id: { $in: rows.map((r) => r.company_id) } }, { projection: { name: 1 } }).toArray(),
    (await col<{ _id: number; name: string }>("company_users")).find({ _id: { $in: rows.map((r) => r.company_user_id) } }, { projection: { name: 1 } }).toArray(),
  ]);
  const cn = new Map(companies.map((c) => [c._id, c.name]));
  const un = new Map(users.map((u) => [u._id, u.name]));
  return rows.map(({ _id, ...r }) => ({ id: _id, ...r, company_name: cn.get(r.company_id) ?? "—", user_name: un.get(r.company_user_id) ?? "—" }));
}

export async function getB2bRequest(id: number, companyId?: number) {
  return (await requests()).findOne(companyId ? { _id: id, company_id: companyId } : { _id: id });
}

export async function setB2bRequestStatus(id: number, status: B2bRequestStatus, note: string | null, userId: number) {
  await (await requests()).updateOne({ _id: id }, { $set: { status, staff_note: note, updated_at: now() } });
  await audit(userId, `status:${status}`, "b2b_request", id, note ? { note } : null);
}

export const countOpenB2bRequests = async () => (await requests()).countDocuments({ status: "new" });

// ------------------------------------------------------------------ Partner portal read models
/**
 * Hotels a company may browse, with ITS prices only. Library prices, costs and internal notes
 * are never included — the whitelist below is the whole response.
 */
export async function portalHotels(companyId: number, locale: Locale) {
  const access = await (await col<CompanyHotelDoc>("company_hotels")).find({ company_id: companyId }).toArray();
  const hotels = await hotelsPublic(access.map((a) => a.hotel_id), locale);
  const active = new Set((await (await col<{ _id: number; status: string }>("hotels")).find({ _id: { $in: access.map((a) => a.hotel_id) }, status: "active" }, { projection: { _id: 1 } }).toArray()).map((h) => h._id));
  return access
    .filter((a) => hotels.has(a.hotel_id) && active.has(a.hotel_id))
    .map((a) => ({
      hotel: hotels.get(a.hotel_id)!,
      rates: a.rates.map((r) => ({ room: r.room_label, board: r.board, basis: r.basis, occupancy: r.occupancy, currency: r.currency, price: r.price })),
      note: a.note,
    }))
    .sort((x, y) => x.hotel.country.localeCompare(y.hotel.country) || x.hotel.city.localeCompare(y.hotel.city) || x.hotel.name.localeCompare(y.hotel.name));
}

export async function portalHotel(companyId: number, hotelId: number, locale: Locale) {
  const list = await portalHotels(companyId, locale);
  return list.find((h) => h.hotel.id === hotelId) ?? null;
}

/** Company identity for the portal header (logo, colours, name). */
export async function portalCompany(companyId: number) {
  const c = await (await col<{ _id: number; name: string; name_en: string | null; branding: { logo_media_id: string | null; primary_color: string; secondary_color: string; display_name: string | null }; terms: string | null }>("companies")).findOne({ _id: companyId });
  if (!c) return null;
  const logo = c.branding?.logo_media_id ? ((await mediaByIds([c.branding.logo_media_id])).get(c.branding.logo_media_id) ?? null) : null;
  return {
    name: c.branding?.display_name || c.name,
    name_en: c.name_en,
    logo,
    primary: c.branding?.primary_color ?? "#0b3a66",
    secondary: c.branding?.secondary_color ?? "#f28c28",
    terms: c.terms,
  };
}
