import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import type { CompanyPermission } from "@/lib/permissions";
import type { Board } from "@/lib/travel-labels";
import { hashPassword } from "../auth/password";
import { endSessionsOf } from "../auth/session";
import { col, contains, nextId, now, tx } from "../db";
import { audit } from "../security";
import type { HotelDoc, RateBasis } from "./catalog";

export interface ContactDoc {
  id: number;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

export interface CompanyBranding {
  logo_media_id: string | null;
  primary_color: string;
  secondary_color: string;
  /** Name printed on branded documents (defaults to the company name). */
  display_name: string | null;
  display_name_en: string | null;
  /** One line of contact details for the PDF footer (phone · e-mail · website). */
  contact_line: string | null;
}

export interface CompanyDoc {
  _id: number;
  name: string;
  name_en: string | null;
  industry: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** Special terms agreed with this company (printed on its quotes). */
  terms: string | null;
  branding: CompanyBranding;
  contacts: ContactDoc[];
  portal: { enabled: boolean };
  status: "active" | "archived";
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_BRANDING: CompanyBranding = {
  logo_media_id: null,
  primary_color: "#0b3a66",
  secondary_color: "#f28c28",
  display_name: null,
  display_name_en: null,
  contact_line: null,
};

const companies = () => col<CompanyDoc>("companies");
export const companiesCollection = companies;

export async function listCompanies(opts: { q?: string; includeArchived?: boolean } = {}) {
  const filter: Filter<CompanyDoc> = opts.includeArchived ? {} : { status: { $ne: "archived" } };
  if (opts.q) filter.$or = [{ name: contains(opts.q) }, { name_en: contains(opts.q) }, { industry: contains(opts.q) }];
  const rows = await (await companies()).find(filter).sort({ name: 1 }).toArray();
  const ids = rows.map((r) => r._id);
  const [quoteStats, userCounts, hotelCounts] = await Promise.all([
    (await col("quotes"))
      .aggregate<{ _id: number; quotes: number; accepted: number; last: string }>([
        { $match: { company_id: { $in: ids } } },
        { $group: { _id: "$company_id", quotes: { $sum: 1 }, accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } }, last: { $max: "$created_at" } } },
      ])
      .toArray(),
    (await col("company_users")).aggregate<{ _id: number; n: number }>([{ $match: { company_id: { $in: ids }, active: true } }, { $group: { _id: "$company_id", n: { $sum: 1 } } }]).toArray(),
    (await col("company_hotels")).aggregate<{ _id: number; n: number }>([{ $match: { company_id: { $in: ids } } }, { $group: { _id: "$company_id", n: { $sum: 1 } } }]).toArray(),
  ]);
  const qs = new Map(quoteStats.map((r) => [r._id, r]));
  const uc = new Map(userCounts.map((r) => [r._id, r.n]));
  const hc = new Map(hotelCounts.map((r) => [r._id, r.n]));
  return rows
    .map(({ _id, ...c }) => ({
      id: _id,
      ...c,
      contactsCount: c.contacts.length,
      quotes: qs.get(_id)?.quotes ?? 0,
      accepted: qs.get(_id)?.accepted ?? 0,
      last_quote: qs.get(_id)?.last ?? null,
      users: uc.get(_id) ?? 0,
      hotels: hc.get(_id) ?? 0,
    }))
    .sort((a, b) => (b.last_quote ?? b.updated_at).localeCompare(a.last_quote ?? a.updated_at));
}

export async function getCompany(id: number) {
  return (await companies()).findOne({ _id: id });
}

export const companyContacts = async (companyId: number) =>
  ((await getCompany(companyId))?.contacts ?? []).slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name));

export interface CompanyInput {
  name: string;
  name_en: string | null;
  industry: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  terms: string | null;
  branding: CompanyBranding;
  portal_enabled: boolean;
  status: "active" | "archived";
}

export async function saveCompany(id: number | null, input: CompanyInput, userId: number): Promise<number> {
  const t = now();
  const { portal_enabled, ...fields } = input;
  const c = await companies();
  if (id) {
    const before = await c.findOne({ _id: id });
    await c.updateOne({ _id: id }, { $set: { ...fields, portal: { enabled: portal_enabled }, updated_at: t } });
    // Switching the portal off (or archiving) signs every company user out immediately.
    if ((before?.portal.enabled && !portal_enabled) || input.status === "archived") {
      for (const u of await (await col<{ _id: number }>("company_users")).find({ company_id: id }).toArray()) await endSessionsOf("company", u._id);
    }
    const brandingChanged = JSON.stringify(before?.branding) !== JSON.stringify(input.branding);
    await audit(userId, "update", "company", id, brandingChanged ? { branding: { before: before?.branding, after: input.branding } } : null);
    return id;
  }
  const newId = await nextId("companies");
  await c.insertOne({ _id: newId, ...fields, contacts: [], portal: { enabled: portal_enabled }, created_by: userId, created_at: t, updated_at: t });
  await audit(userId, "create", "company", newId);
  return newId;
}

export type ContactInput = Omit<ContactDoc, "id">;

export async function saveContact(companyId: number, id: number | null, input: ContactInput): Promise<number> {
  const contactId = id ?? (await nextId("company_contacts"));
  await tx(async (session) => {
    const c = await companies();
    const company = await c.findOne({ _id: companyId }, { session });
    if (!company) throw new Error("company not found");
    let contacts = company.contacts.filter((x) => x.id !== contactId);
    const first = !company.contacts.length;
    const primary = input.is_primary || first;
    if (primary) contacts = contacts.map((x) => ({ ...x, is_primary: false }));
    const existing = company.contacts.find((x) => x.id === contactId);
    const next = { ...input, id: contactId, is_primary: primary };
    contacts = existing ? company.contacts.map((x) => (x.id === contactId ? next : primary ? { ...x, is_primary: false } : x)) : [...contacts, next];
    await c.updateOne({ _id: companyId }, { $set: { contacts, updated_at: now() } }, { session });
  });
  return contactId;
}

export async function deleteContact(companyId: number, id: number) {
  await (await companies()).updateOne({ _id: companyId }, { $pull: { contacts: { id } }, $set: { updated_at: now() } });
}

export async function deleteCompany(id: number, userId: number): Promise<string | null> {
  const used =
    (await (await col("quotes")).countDocuments({ company_id: id }, { limit: 1 })) +
    (await (await col("tickets")).countDocuments({ company_id: id }, { limit: 1 })) +
    (await (await col("commission_rules")).countDocuments({ company_id: id }, { limit: 1 }));
  if (used) return "لا يمكن حذف شركة لديها عروض أسعار أو تذاكر أو عمولات مسجلة. أرشفها بدلاً من ذلك.";
  await tx(async (session) => {
    for (const u of await (await col<{ _id: number }>("company_users")).find({ company_id: id }, { session }).toArray()) await endSessionsOf("company", u._id);
    await (await col("company_users")).deleteMany({ company_id: id }, { session });
    await (await col("company_hotels")).deleteMany({ company_id: id }, { session });
    await (await companies()).deleteOne({ _id: id }, { session });
    await audit(userId, "delete", "company", id, null, { session });
  });
  return null;
}

// ------------------------------------------------------------------ Company users (partner portal)
export interface CompanyUserDoc {
  _id: number;
  company_id: number;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  permissions: CompanyPermission[];
  active: boolean;
  failed_logins: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

const companyUsers = () => col<CompanyUserDoc>("company_users");

export async function listCompanyUsers(companyId?: number) {
  const rows = await (await companyUsers()).find(companyId ? { company_id: companyId } : {}, { projection: { password_hash: 0 } }).sort({ active: -1, name: 1 }).toArray();
  return rows.map(({ _id, ...u }) => ({ id: _id, ...u }));
}

export async function companyUserEmailTaken(email: string, exceptId = 0) {
  // One e-mail per account across both portals avoids confusion at sign-in.
  const [a, b] = await Promise.all([
    (await companyUsers()).findOne({ email, _id: { $ne: exceptId } }, { projection: { _id: 1 } }),
    (await col("staff_users")).findOne({ email }, { projection: { _id: 1 } }),
  ]);
  return !!(a || b);
}

export async function getCompanyUserDoc(id: number) {
  return (await companyUsers()).findOne({ _id: id }, { projection: { password_hash: 0 } });
}

export async function createCompanyUser(companyId: number, input: { name: string; email: string; phone: string | null; permissions: CompanyPermission[]; password: string }, userId: number) {
  const t = now();
  const id = await nextId("company_users");
  await (await companyUsers()).insertOne({
    _id: id,
    company_id: companyId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    password_hash: await hashPassword(input.password),
    permissions: input.permissions,
    active: true,
    failed_logins: 0,
    locked_until: null,
    last_login_at: null,
    created_by: userId,
    created_at: t,
    updated_at: t,
  });
  await audit(userId, "create", "company_user", id, { company_id: companyId, permissions: input.permissions });
  return id;
}

export async function updateCompanyUser(id: number, input: { name: string; email: string; phone: string | null; permissions: CompanyPermission[]; active: boolean }, userId: number) {
  await (await companyUsers()).updateOne({ _id: id }, { $set: { ...input, updated_at: now() } });
  if (!input.active) await endSessionsOf("company", id);
  await audit(userId, "update", "company_user", id, { permissions: input.permissions, active: input.active });
}

export async function setCompanyUserPassword(id: number, password: string, actor: { staffId?: number; self?: boolean }, keepSession?: string) {
  await (await companyUsers()).updateOne({ _id: id }, { $set: { password_hash: await hashPassword(password), failed_logins: 0, locked_until: null, updated_at: now() } });
  await endSessionsOf("company", id, keepSession);
  await audit(actor.staffId ?? null, "reset_password", "company_user", id, null, { actor: actor.self ? "company" : "staff" });
}

// ------------------------------------------------------------------ Hotel access & company prices
export interface CompanyRate {
  rate_id: string | null;
  room_type_id: string | null;
  room_label: string | null;
  board: Board | null;
  basis: RateBasis;
  occupancy: number;
  currency: string;
  /** The price this company pays (selling price to the company, never our cost). */
  price: number;
}

export interface CompanyHotelDoc {
  company_id: number;
  hotel_id: number;
  rates: CompanyRate[];
  note: string | null;
  created_at: string;
  updated_at: string;
}

const companyHotels = () => col<CompanyHotelDoc>("company_hotels");

export async function listCompanyHotels(companyId: number) {
  const rows = await (await companyHotels()).find({ company_id: companyId }).toArray();
  const hotels = new Map((await (await col<HotelDoc>("hotels")).find({ _id: { $in: rows.map((r) => r.hotel_id) } }).toArray()).map((h) => [h._id, h]));
  return rows
    .filter((r) => hotels.has(r.hotel_id))
    .map((r) => ({ ...r, _id: undefined, hotel: hotels.get(r.hotel_id)! }))
    .sort((a, b) => a.hotel.name_ar.localeCompare(b.hotel.name_ar));
}

/**
 * Grants a company access to a hotel with company-specific prices. When no prices are given, the
 * library's suggested selling prices are copied as a starting point (a copy: later library
 * changes do not change what this company sees).
 */
export async function setCompanyHotel(companyId: number, hotelId: number, rates: CompanyRate[] | null, note: string | null, userId: number) {
  const t = now();
  const hotel = await (await col<HotelDoc>("hotels")).findOne({ _id: hotelId });
  if (!hotel) throw new Error("hotel not found");
  const finalRates =
    rates ??
    hotel.rates
      .filter((r) => r.active)
      .map((r) => ({
        rate_id: r.id,
        room_type_id: r.room_type_id,
        room_label: hotel.room_types.find((x) => x.id === r.room_type_id)?.name_ar ?? null,
        board: r.board,
        basis: r.basis,
        occupancy: r.occupancy,
        currency: r.currency,
        price: r.price,
      }));
  const before = await (await companyHotels()).findOne({ company_id: companyId, hotel_id: hotelId });
  await (await companyHotels()).updateOne(
    { company_id: companyId, hotel_id: hotelId },
    { $set: { rates: finalRates, note, updated_at: t }, $setOnInsert: { created_at: t } },
    { upsert: true },
  );
  await audit(userId, before ? "update" : "grant", "company_hotel", `${companyId}:${hotelId}`, { before: before?.rates ?? null, after: finalRates });
}

export async function removeCompanyHotel(companyId: number, hotelId: number, userId: number) {
  await (await companyHotels()).deleteOne({ company_id: companyId, hotel_id: hotelId });
  await audit(userId, "revoke", "company_hotel", `${companyId}:${hotelId}`);
}

export const newRateKey = () => randomUUID();
