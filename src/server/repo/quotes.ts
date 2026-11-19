import "server-only";
import { UserFacingError } from "../errors";
import { randomUUID } from "node:crypto";
import type { Filter } from "mongodb";
import { site, type Locale } from "@/content/site";
import { addDays, todayDay } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { quoteMargin, quoteTotals, type DiscountKind, type ItemKind, type ItemUnit, type PricingMode } from "@/lib/quote-math";
import { pick, type Board, type QuoteStatus } from "@/lib/travel-labels";
import { col, contains, nextId, now, tx } from "../db";
import { mediaById, mediaByIds } from "../media";
import { audit, nextRef, randomToken } from "../security";
import { hotelsPublic, isHotelPublic, type HotelDoc, type HotelPublic, type RateBasis } from "./catalog";
import { DEFAULT_BRANDING, type CompanyDoc, type CompanyHotelDoc } from "./companies";
import { getProgramEditor } from "./programs";
import { getSettings } from "./settings";

export type Audience = "company" | "traveler";
export type Branding = "company" | "etijah";

export interface QuoteHotelRate {
  rate_id: string | null;
  source: "library" | "company" | "custom";
  basis: RateBasis;
  occupancy: number;
  currency: string;
  night_price: number;
  /** INTERNAL */
  night_cost: number | null;
  captured_at: string;
}

export interface QuoteHotelLine {
  id: string;
  hotel_id: number;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  room_type: string | null;
  board: Board | null;
  rooms: number | null;
  rate: QuoteHotelRate | null;
}

export interface QuoteItem {
  kind: ItemKind;
  label: string;
  description: string | null;
  unit: ItemUnit;
  quantity: number;
  unit_price: number;
  /** INTERNAL */
  unit_cost: number | null;
}

export interface QuoteDoc {
  _id: number;
  ref: string;
  revision: number;
  audience: Audience;
  company_id: number | null;
  contact_id: number | null;
  lead_id: number | null;
  b2b_request_id: number | null;
  client: { name: string; phone: string | null; email: string | null } | null;
  beneficiary: { name: string | null; note: string | null } | null;
  branding: Branding;
  program_id: number | null;
  locale: Locale;
  status: QuoteStatus;
  title: string;
  destination: string | null;
  intro: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  rooms_note: string | null;
  currency: string;
  pricing_mode: PricingMode;
  discount_kind: DiscountKind | null;
  discount_value: number;
  discount_label: string | null;
  inclusions: string[];
  exclusions: string[];
  notes: string | null;
  terms: string | null;
  internal_notes: string | null;
  cover_media_id: string | null;
  gallery: string[];
  valid_until: string;
  days: { title: string; body: string | null }[];
  hotels: QuoteHotelLine[];
  items: QuoteItem[];
  token: string;
  link_expires_at: string | null;
  link_revoked_at: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  responded_at: string | null;
  response_name: string | null;
  response_note: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteEventDoc {
  quote_id: number;
  kind: string;
  channel: string | null;
  actor_user_id: number | null;
  actor_label: string | null;
  note: string | null;
  created_at: string;
}

const quotes = () => col<QuoteDoc>("quotes");
const qevents = () => col<QuoteEventDoc>("quote_events");

export type QuoteHotelInput = Omit<QuoteHotelLine, "id" | "rate"> & {
  id: string | null;
  rate: (Omit<QuoteHotelRate, "captured_at"> & { refresh: boolean }) | null;
};

export interface QuoteInput {
  audience: Audience;
  company_id: number | null;
  contact_id: number | null;
  lead_id: number | null;
  b2b_request_id: number | null;
  client: QuoteDoc["client"];
  beneficiary: QuoteDoc["beneficiary"];
  branding: Branding;
  program_id: number | null;
  locale: Locale;
  title: string;
  destination: string | null;
  intro: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  rooms_note: string | null;
  currency: string;
  pricing_mode: PricingMode;
  discount_kind: DiscountKind | null;
  discount_value: number;
  discount_label: string | null;
  inclusions: string[];
  exclusions: string[];
  notes: string | null;
  terms: string | null;
  internal_notes: string | null;
  cover_media_id: string | null;
  gallery: string[];
  valid_until: string;
  days: QuoteDoc["days"];
  hotels: QuoteHotelInput[];
  items: QuoteItem[];
}

const OPEN_STATUSES: QuoteStatus[] = ["sent", "viewed", "changes_requested"];

/** Moves quotes whose price validity has passed to "expired" (lazy; runs on reads). */
export async function expireDueQuotes() {
  const c = await quotes();
  const due = await c.find({ status: { $in: OPEN_STATUSES }, valid_until: { $lt: todayDay() } }, { projection: { _id: 1 } }).toArray();
  if (!due.length) return;
  const t = now();
  for (const q of due) {
    // Conditional update: only one concurrent reader records the expiry.
    const r = await c.updateOne({ _id: q._id, status: { $in: OPEN_STATUSES } }, { $set: { status: "expired", updated_at: t } });
    if (r.modifiedCount) await (await qevents()).insertOne({ quote_id: q._id, kind: "expired", channel: null, actor_user_id: null, actor_label: "system", note: null, created_at: t });
  }
}

export async function addQuoteEvent(quoteId: number, kind: string, opts: { channel?: string; userId?: number | null; label?: string; note?: string | null } = {}) {
  await (await qevents()).insertOne({ quote_id: quoteId, kind, channel: opts.channel ?? null, actor_user_id: opts.userId ?? null, actor_label: opts.label ?? null, note: opts.note ?? null, created_at: now() });
}

// ------------------------------------------------------------------ Staff
export async function listQuotes(opts: { status?: string; q?: string; companyId?: number; audience?: Audience; leadId?: number; requested?: boolean } = {}) {
  await expireDueQuotes();
  const filter: Filter<QuoteDoc> = {};
  if (opts.status === "open") filter.status = { $in: OPEN_STATUSES };
  else if (opts.status) filter.status = opts.status as QuoteStatus;
  if (opts.companyId) filter.company_id = opts.companyId;
  if (opts.audience) filter.audience = opts.audience;
  if (opts.leadId) filter.lead_id = opts.leadId;
  if (opts.q) {
    const companyIds = (await (await col<CompanyDoc>("companies")).find({ $or: [{ name: contains(opts.q) }, { name_en: contains(opts.q) }] }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
    filter.$or = [{ ref: contains(opts.q) }, { title: contains(opts.q) }, { "client.name": contains(opts.q) }, { company_id: { $in: companyIds } }];
  }
  const rows = await (await quotes()).find(filter, { projection: { days: 0, gallery: 0 } }).sort({ updated_at: -1 }).limit(500).toArray();
  const [companies, staff] = await Promise.all([
    (await col<CompanyDoc>("companies")).find({ _id: { $in: rows.map((r) => r.company_id).filter((x): x is number => !!x) } }, { projection: { name: 1 } }).toArray(),
    (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: rows.map((r) => r.created_by).filter((x): x is number => !!x) } }, { projection: { name: 1 } }).toArray(),
  ]);
  const cn = new Map(companies.map((c) => [c._id, c.name]));
  const sn = new Map(staff.map((s) => [s._id, s.name]));
  return rows.map((r) => ({
    id: r._id,
    ref: r.ref,
    revision: r.revision,
    audience: r.audience,
    status: r.status,
    title: r.title,
    currency: r.currency,
    valid_until: r.valid_until,
    sent_at: r.sent_at,
    view_count: r.view_count,
    updated_at: r.updated_at,
    company_id: r.company_id,
    recipient: r.audience === "company" ? (r.company_id ? (cn.get(r.company_id) ?? "—") : "—") : (r.client?.name ?? "—"),
    owner: r.created_by ? (sn.get(r.created_by) ?? null) : null,
    total: quoteTotals(r).total,
  }));
}

export type QuoteEditorData = Omit<QuoteInput, "hotels"> & {
  id: number;
  ref: string;
  revision: number;
  status: QuoteStatus;
  token: string;
  link_expires_at: string | null;
  link_revoked_at: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  responded_at: string | null;
  response_name: string | null;
  response_note: string | null;
  created_at: string;
  updated_at: string;
  hotels: QuoteHotelLine[];
};

export async function getQuoteDoc(id: number) {
  await expireDueQuotes();
  return (await quotes()).findOne({ _id: id });
}

export async function getQuoteEditor(id: number): Promise<QuoteEditorData | null> {
  const q = await getQuoteDoc(id);
  if (!q) return null;
  const { _id, created_by: _c, updated_by: _u, ...rest } = q;
  return { ...rest, id: _id };
}

export async function quoteEvents(quoteId: number) {
  const rows = await (await qevents()).find({ quote_id: quoteId }).sort({ created_at: -1, _id: -1 }).toArray();
  const users = new Map(
    (await (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: rows.map((r) => r.actor_user_id).filter((x): x is number => !!x) } }).toArray()).map((u) => [u._id, u.name]),
  );
  return rows.map((e) => ({ id: String(e._id), kind: e.kind, channel: e.channel, actor_label: e.actor_label, note: e.note, created_at: e.created_at, user_name: e.actor_user_id ? (users.get(e.actor_user_id) ?? null) : null }));
}

export class QuoteError extends UserFacingError {}

/**
 * Builds hotel lines with server-side rate snapshots: a library or company rate is copied from
 * the database (never from the client) when first chosen or explicitly refreshed; otherwise the
 * stored copy is kept, so later rate changes never alter a quote already prepared.
 */
async function buildHotelLines(input: QuoteInput, previous: QuoteHotelLine[]): Promise<QuoteHotelLine[]> {
  const t = now();
  const hotelIds = [...new Set(input.hotels.map((h) => h.hotel_id))];
  const hotels = new Map((await (await col<HotelDoc>("hotels")).find({ _id: { $in: hotelIds } }).toArray()).map((h) => [h._id, h]));
  const companyRates =
    input.audience === "company" && input.company_id
      ? new Map((await (await col<CompanyHotelDoc>("company_hotels")).find({ company_id: input.company_id, hotel_id: { $in: hotelIds } }).toArray()).map((r) => [r.hotel_id, r]))
      : new Map<number, CompanyHotelDoc>();
  const old = new Map(previous.map((h) => [h.id, h]));

  return input.hotels.map((h) => {
    const hotel = hotels.get(h.hotel_id);
    if (!hotel) throw new QuoteError("أحد الفنادق غير موجود.");
    const prev = h.id ? old.get(h.id) : undefined;
    let rate: QuoteHotelRate | null = null;
    if (h.rate) {
      const keep = prev?.rate && prev.rate.rate_id === h.rate.rate_id && prev.rate.source === h.rate.source && !h.rate.refresh;
      if (h.rate.source === "custom") {
        rate = { ...h.rate, rate_id: null, captured_at: prev?.rate?.captured_at ?? t };
      } else if (keep) {
        // Staff may still adjust the price for this quote only; the cost copy stays as captured.
        rate = { ...prev!.rate!, night_price: h.rate.night_price };
      } else if (h.rate.source === "library") {
        const r = hotel.rates.find((x) => x.id === h.rate!.rate_id);
        if (!r) throw new QuoteError(`السعر المختار لم يعد موجوداً في مكتبة فندق «${hotel.name_ar}».`);
        rate = { rate_id: r.id, source: "library", basis: r.basis, occupancy: r.occupancy, currency: r.currency, night_price: h.rate.refresh ? r.price : h.rate.night_price, night_cost: r.cost, captured_at: t };
      } else {
        const cr = companyRates.get(h.hotel_id)?.rates.find((x) => x.rate_id === h.rate!.rate_id);
        if (!cr) throw new QuoteError(`سعر الشركة المختار غير متوفر لفندق «${hotel.name_ar}».`);
        const lib = hotel.rates.find((x) => x.id === cr.rate_id);
        rate = { rate_id: cr.rate_id, source: "company", basis: cr.basis, occupancy: cr.occupancy, currency: cr.currency, night_price: h.rate.refresh ? cr.price : h.rate.night_price, night_cost: lib?.cost ?? null, captured_at: t };
      }
    }
    return {
      id: prev ? prev.id : randomUUID(),
      hotel_id: h.hotel_id,
      check_in: h.check_in,
      check_out: h.check_out,
      nights: h.nights,
      room_type: h.room_type,
      board: h.board,
      rooms: h.rooms,
      rate,
    };
  });
}

export async function saveQuote(id: number | null, input: QuoteInput, userId: number): Promise<number> {
  const t = now();
  const c = await quotes();
  const existing = id ? await c.findOne({ _id: id }) : null;
  if (id && !existing) throw new QuoteError("العرض غير موجود.");
  const hotels = await buildHotelLines(input, existing?.hotels ?? []);
  const { hotels: _h, ...fields } = input;
  const content = { ...fields, audience: input.audience, company_id: input.audience === "company" ? input.company_id : null, hotels, updated_by: userId, updated_at: t };

  if (existing) {
    // Editing a quote the client has already received creates a new revision.
    const revise = existing.status !== "draft";
    // Extending the validity of an expired quote reopens it.
    const reopen = existing.status === "expired" && input.valid_until >= todayDay();
    await tx(async (session) => {
      await c.updateOne(
        { _id: existing._id },
        { $set: { ...content, ...(reopen ? { status: "sent" as const } : {}) }, $inc: { revision: revise ? 1 : 0 } },
        { session },
      );
      await (await qevents()).insertOne(
        { quote_id: existing._id, kind: revise ? "revised" : "updated", channel: null, actor_user_id: userId, actor_label: null, note: null, created_at: t },
        { session },
      );
      await audit(userId, "update", "quote", existing._id, null, { session });
    });
    return existing._id;
  }

  const newId = await nextId("quotes");
  const ref = await nextRef("QT");
  await tx(async (session) => {
    await c.insertOne(
      {
        _id: newId,
        ref,
        revision: 1,
        ...content,
        status: "draft",
        token: randomToken(32),
        link_expires_at: `${addDays(input.valid_until, 30)}T23:59:59.000Z`,
        link_revoked_at: null,
        sent_at: null,
        first_viewed_at: null,
        last_viewed_at: null,
        view_count: 0,
        responded_at: null,
        response_name: null,
        response_note: null,
        created_by: userId,
        created_at: t,
      },
      { session },
    );
    await (await qevents()).insertOne({ quote_id: newId, kind: "created", channel: null, actor_user_id: userId, actor_label: null, note: null, created_at: t }, { session });
    if (input.b2b_request_id)
      await (await col("b2b_requests")).updateOne({ _id: input.b2b_request_id, company_id: input.company_id ?? -1 }, { $set: { status: "in_progress", quote_id: newId, updated_at: t } }, { session });
    await audit(userId, "create", "quote", newId, null, { session });
  });
  return newId;
}

/** Problems that block sending a quote. */
export function sendProblems(q: QuoteEditorData): string[] {
  const problems: string[] = [];
  if (!q.items.some((i) => i.kind === "main")) problems.push("أضف بند سعر أساسياً واحداً على الأقل.");
  if (q.valid_until < todayDay()) problems.push("تاريخ صلاحية العرض منتهٍ. حدّث تاريخ الصلاحية قبل الإرسال.");
  if (q.link_revoked_at) problems.push("رابط العرض ملغى. أنشئ رابطاً جديداً قبل الإرسال.");
  if (q.audience === "traveler" && !q.client?.name) problems.push("أدخل اسم المسافر المستلم.");
  return problems;
}

export async function markQuoteSent(id: number, channel: string, userId: number) {
  const t = now();
  await tx(async (session) => {
    const c = await quotes();
    const q = (await c.findOne({ _id: id }, { session }))!;
    if (q.status === "draft") await c.updateOne({ _id: id }, { $set: { status: "sent", sent_at: t, updated_at: t } }, { session });
    else if (!q.sent_at) await c.updateOne({ _id: id }, { $set: { sent_at: t } }, { session });
    await (await qevents()).insertOne({ quote_id: id, kind: q.status === "draft" ? "sent" : "resent", channel, actor_user_id: userId, actor_label: null, note: null, created_at: t }, { session });
    if (q.b2b_request_id) await (await col("b2b_requests")).updateOne({ _id: q.b2b_request_id }, { $set: { status: "quoted", updated_at: t } }, { session });
    if (q.lead_id) await (await col("leads")).updateOne({ _id: q.lead_id, status: { $in: ["new", "contacted"] } }, { $set: { status: "quoted", updated_at: t } }, { session });
  });
}

export async function setQuoteStatus(id: number, status: QuoteStatus, userId: number, note: string | null) {
  const t = now();
  await tx(async (session) => {
    await (await quotes()).updateOne({ _id: id }, { $set: { status, updated_at: t, ...(status === "accepted" || status === "rejected" ? { responded_at: t } : {}) } }, { session });
    await (await qevents()).insertOne({ quote_id: id, kind: `status:${status}`, channel: null, actor_user_id: userId, actor_label: null, note, created_at: t }, { session });
    await audit(userId, `status:${status}`, "quote", id, note ? { note } : null, { session });
  });
}

export async function revokeQuoteLink(id: number, userId: number) {
  await (await quotes()).updateOne({ _id: id }, { $set: { link_revoked_at: now(), updated_at: now() } });
  await addQuoteEvent(id, "link_revoked", { userId });
}

export async function regenerateQuoteLink(id: number, userId: number) {
  await (await quotes()).updateOne({ _id: id }, { $set: { token: randomToken(32), link_revoked_at: null, updated_at: now() } });
  await addQuoteEvent(id, "link_regenerated", { userId });
}

export async function setQuoteLinkExpiry(id: number, expires: string | null, userId: number) {
  await (await quotes()).updateOne({ _id: id }, { $set: { link_expires_at: expires ? `${expires}T23:59:59.000Z` : null, updated_at: now() } });
  await addQuoteEvent(id, "link_expiry", { userId, note: expires ?? "بدون انتهاء" });
}

export async function deleteQuote(id: number, userId: number) {
  await tx(async (session) => {
    await (await quotes()).deleteOne({ _id: id }, { session });
    await (await qevents()).deleteMany({ quote_id: id }, { session });
    await audit(userId, "delete", "quote", id, null, { session });
  });
}

export async function duplicateQuote(id: number, userId: number): Promise<number | null> {
  const q = await getQuoteEditor(id);
  if (!q) return null;
  const s = await getSettings();
  const valid = q.valid_until < todayDay() ? addDays(todayDay(), s.quote_validity_days) : q.valid_until;
  // The copy is a new offer: hotel rates are re-copied from the current library.
  return saveQuote(
    null,
    { ...q, valid_until: valid, b2b_request_id: null, hotels: q.hotels.map((h) => ({ ...h, id: null, rate: h.rate ? { ...h.rate, refresh: h.rate.source !== "custom" } : null })) },
    userId,
  );
}

/** Starting content for a quote built from a catalog program, in the quote's language. */
export async function quoteDraftFromProgram(programId: number, locale: Locale, adults: number, optionId?: string | null) {
  const p = await getProgramEditor(programId);
  if (!p) return null;
  const services = await (await col<{ _id: number; name_ar: string; name_en: string }>("services")).find({}).toArray();
  const name = (sid: number) => {
    const s = services.find((x) => x._id === sid);
    return s ? pick(locale, s.name_ar, s.name_en) : "";
  };
  const svc = (included: boolean) =>
    p.services
      .filter((s) => s.included === included)
      .map((s) => [name(s.service_id), pick(locale, s.note_ar, s.note_en)].filter(Boolean).join(" — "))
      .filter(Boolean);
  const dests = await (await col<{ _id: number; name_ar: string; name_en: string }>("destinations")).find({ _id: { $in: p.destination_ids } }).toArray();
  const options = optionId ? p.hotel_options.filter((o) => o.id === optionId) : p.hotel_options.slice(0, 1);
  const pax = Math.max(1, adults);
  const hotelsById = new Map((await (await col<HotelDoc>("hotels")).find({ _id: { $in: options.map((o) => o.hotel_id) } }, { projection: { name_ar: 1, name_en: 1 } }).toArray()).map((h) => [h._id, h]));
  return {
    program_id: p.id,
    title: pick(locale, p.title_ar, p.title_en),
    destination: p.destination_ids
      .map((id) => dests.find((d) => d._id === id))
      .filter(Boolean)
      .map((d) => pick(locale, d!.name_ar, d!.name_en))
      .join(locale === "ar" ? "، " : ", "),
    intro: pick(locale, p.summary_ar, p.summary_en) || null,
    currency: p.currency,
    cover: await mediaById(p.cover_media_id),
    gallery: await (async () => {
      const ids = p.gallery.slice(0, 6);
      const map = await mediaByIds(ids);
      return ids.map((m) => map.get(m)).filter((m): m is MediaRef => !!m);
    })(),
    days: p.itinerary.map((d) => ({ title: pick(locale, d.title_ar, d.title_en), body: pick(locale, d.body_ar, d.body_en) || null })),
    hotels: options.map((o) => ({
      hotel_id: o.hotel_id,
      nights: o.nights,
      room_type: pick(locale, o.room_ar, o.room_en) || null,
      board: o.board,
      rate: { rate_id: null, source: "custom" as const, basis: o.basis, occupancy: o.occupancy, currency: p.currency, night_price: o.night_price, night_cost: o.night_cost },
    })),
    inclusions: svc(true),
    exclusions: svc(false),
    items:
      p.type === "fixed"
        ? options.map((o) => {
            const h = hotelsById.get(o.hotel_id);
            const price = o.final_price_override ?? p.base_price + (o.basis === "per_room" ? Math.ceil((o.night_price * o.nights) / Math.max(1, o.occupancy)) : o.night_price * o.nights);
            return {
              kind: "main" as const,
              label: `${pick(locale, p.title_ar, p.title_en)} — ${h ? pick(locale, h.name_ar, h.name_en) : ""}`,
              description: null,
              unit: "person" as const,
              quantity: pax,
              unit_price: price,
              unit_cost: null,
            };
          })
        : [],
    duration_days: p.duration_days,
  };
}

// ------------------------------------------------------------------ Client access
export async function getQuoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  await expireDueQuotes();
  return (await quotes()).findOne({ token });
}

/** Whether a client (not staff) may open this quote link right now. */
export function clientLinkOpen(q: QuoteDoc): boolean {
  if (q.status === "draft") return false;
  if (q.link_revoked_at) return false;
  if (q.link_expires_at && q.link_expires_at < now()) return false;
  return true;
}

export async function recordQuoteView(q: QuoteDoc, label = "client") {
  const t = now();
  const recent = q.last_viewed_at && Date.parse(q.last_viewed_at) > Date.now() - 30 * 60_000;
  await (await quotes()).updateOne({ _id: q._id }, [
    {
      $set: {
        view_count: { $add: ["$view_count", 1] },
        last_viewed_at: t,
        first_viewed_at: { $ifNull: ["$first_viewed_at", t] },
        status: { $cond: [{ $eq: ["$status", "sent"] }, "viewed", "$status"] },
      },
    },
  ]);
  if (!recent) await addQuoteEvent(q._id, "viewed", { label });
}

export const canRespond = (q: Pick<QuoteDoc, "status" | "valid_until">) => OPEN_STATUSES.includes(q.status) && q.valid_until >= todayDay();

/** Records a client decision. Conditional on the quote still being open (no double answers). */
export async function respondToQuote(q: QuoteDoc, action: "accept" | "changes", name: string, note: string | null, channel: "link" | "portal" = "link") {
  const t = now();
  const status: QuoteStatus = action === "accept" ? "accepted" : "changes_requested";
  return tx(async (session) => {
    const r = await (await quotes()).updateOne(
      { _id: q._id, status: { $in: OPEN_STATUSES }, valid_until: { $gte: todayDay() } },
      { $set: { status, responded_at: t, response_name: name, response_note: note, updated_at: t } },
      { session },
    );
    if (!r.modifiedCount) return false;
    await (await qevents()).insertOne({ quote_id: q._id, kind: action === "accept" ? "accepted" : "changes_requested", channel, actor_user_id: null, actor_label: name, note, created_at: t }, { session });
    return true;
  });
}

/** Identity printed on a quote: the partner company's brand, or Etijah's. */
export interface QuoteBrand {
  kind: Branding;
  name: string;
  logo: MediaRef | null;
  primary: string;
  secondary: string;
  contactLines: string[];
}

/**
 * Client-safe view of a quote, for the web page, the PDF and the partner portal. Built field by
 * field (a whitelist): internal costs, margins, internal notes and staff details never appear.
 */
export interface QuoteView {
  ref: string;
  revision: number;
  locale: Locale;
  status: QuoteStatus;
  canRespond: boolean;
  audience: Audience;
  title: string;
  destination: string | null;
  intro: string | null;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  roomsNote: string | null;
  currency: string;
  pricingMode: PricingMode;
  items: { kind: ItemKind; label: string; description: string | null; unit: ItemUnit; quantity: number; unitPrice: number; total: number }[];
  totals: ReturnType<typeof quoteTotals>;
  discount: { kind: DiscountKind; value: number; label: string | null } | null;
  inclusions: string[];
  exclusions: string[];
  notes: string | null;
  terms: string | null;
  validUntil: string;
  issuedAt: string;
  respondedAt: string | null;
  responseName: string | null;
  recipient: { name: string; contact: string | null };
  beneficiary: { name: string | null; note: string | null } | null;
  brand: QuoteBrand;
  preparedBy: string | null;
  cover: MediaRef | null;
  gallery: MediaRef[];
  showHotelPhotos: boolean;
  footerNote: string | null;
  days: { day: number; title: string; body: string | null }[];
  hotels: (HotelPublic & { checkIn: string | null; checkOut: string | null; nights: number; roomType: string | null; board: Board | null; roomsCount: number | null; link: string | null })[];
}

/** The approved link for a hotel name: official site, then Google Maps, then our public hotel page. */
export async function hotelLink(h: Pick<HotelPublic, "id" | "slug" | "websiteUrl" | "mapsUrl">, locale: Locale): Promise<string | null> {
  if (h.websiteUrl) return h.websiteUrl;
  if (h.mapsUrl) return h.mapsUrl;
  if (site.url && (await isHotelPublic(h.id))) return `${site.url}${locale === "en" ? "/en" : ""}/hotels/${h.slug}/`;
  return null;
}

export async function buildQuoteView(q: QuoteDoc): Promise<QuoteView> {
  const locale = q.locale;
  const [company, preparedBy, hotels, media, settings, cover] = await Promise.all([
    q.company_id ? (await col<CompanyDoc>("companies")).findOne({ _id: q.company_id }) : null,
    q.created_by ? (await col<{ _id: number; name: string }>("staff_users")).findOne({ _id: q.created_by }, { projection: { name: 1 } }) : null,
    hotelsPublic(q.hotels.map((h) => h.hotel_id), locale),
    mediaByIds(q.gallery),
    getSettings(),
    mediaById(q.cover_media_id),
  ]);
  const contact = company && q.contact_id ? (company.contacts.find((c) => c.id === q.contact_id) ?? null) : null;
  const ar = locale === "ar";

  const brand = await resolveBrand(q.branding, company, locale, settings);

  const recipient =
    q.audience === "company" && company
      ? { name: ar ? company.name : company.name_en || company.name, contact: contact ? [contact.name, contact.position].filter(Boolean).join(" — ") : null }
      : { name: q.client?.name ?? "", contact: null };

  const hotelLines = await Promise.all(
    q.hotels.map(async (h) => {
      const hotel = hotels.get(h.hotel_id);
      if (!hotel) return null;
      return { ...hotel, checkIn: h.check_in, checkOut: h.check_out, nights: h.nights, roomType: h.room_type, board: h.board, roomsCount: h.rooms, link: await hotelLink(hotel, locale) };
    }),
  );

  return {
    ref: q.ref,
    revision: q.revision,
    locale,
    status: q.status,
    canRespond: canRespond(q),
    audience: q.audience,
    title: q.title,
    destination: q.destination,
    intro: q.intro,
    startDate: q.start_date,
    endDate: q.end_date,
    adults: q.adults,
    children: q.children,
    infants: q.infants,
    rooms: q.rooms,
    roomsNote: q.rooms_note,
    currency: q.currency,
    pricingMode: q.pricing_mode,
    items: q.items.map((i) => ({ kind: i.kind, label: i.label, description: i.description, unit: i.unit, quantity: i.quantity, unitPrice: i.unit_price, total: i.quantity * i.unit_price })),
    totals: quoteTotals(q),
    discount: q.discount_kind && q.discount_value > 0 ? { kind: q.discount_kind, value: q.discount_value, label: q.discount_label } : null,
    inclusions: q.inclusions,
    exclusions: q.exclusions,
    notes: q.notes,
    terms: q.terms,
    validUntil: q.valid_until,
    issuedAt: q.sent_at ?? q.updated_at,
    respondedAt: q.responded_at,
    responseName: q.response_name,
    recipient,
    beneficiary: q.beneficiary && (q.beneficiary.name || q.beneficiary.note) ? q.beneficiary : null,
    brand,
    // On partner-branded documents the Etijah employee is not named.
    preparedBy: brand.kind === "etijah" ? (preparedBy?.name ?? null) : null,
    cover,
    gallery: q.gallery.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
    showHotelPhotos: settings.pdf_show_hotel_photos,
    footerNote: (ar ? settings.pdf_footer_note_ar : settings.pdf_footer_note_en) || null,
    days: q.days.map((d, i) => ({ day: i + 1, title: d.title, body: d.body })),
    hotels: hotelLines.filter((h): h is NonNullable<typeof h> => !!h),
  };
}

/** The identity printed on a document: the partner company's brand, or Etijah's. */
export async function resolveBrand(kind: Branding, company: CompanyDoc | null, locale: Locale, settings?: Awaited<ReturnType<typeof getSettings>>): Promise<QuoteBrand> {
  const ar = locale === "ar";
  const s = settings ?? (await getSettings());
  if (kind === "company" && company) {
    const b = { ...DEFAULT_BRANDING, ...company.branding };
    return {
      kind: "company",
      name: (ar ? b.display_name || company.name : b.display_name_en || company.name_en || b.display_name || company.name) as string,
      logo: await mediaById(b.logo_media_id),
      primary: b.primary_color,
      secondary: b.secondary_color,
      contactLines: [b.contact_line, !b.contact_line ? [company.phone, company.email, company.website].filter(Boolean).join(" · ") : null].filter((x): x is string => !!x),
    };
  }
  return {
    kind: "etijah",
    name: ar ? s.company_name_ar : s.company_name_en,
    logo: null,
    primary: "#0b3a66",
    secondary: "#f28c28",
    contactLines: [[s.company_phone, s.company_email].filter(Boolean).join(" · "), ar ? s.company_address_ar : s.company_address_en].filter(Boolean),
  };
}

/** INTERNAL: margin summary for the staff editor and list. */
export function quoteInternalSummary(q: Pick<QuoteDoc, "items" | "discount_kind" | "discount_value" | "adults" | "children" | "rooms" | "pricing_mode">) {
  return { ...quoteTotals(q), ...quoteMargin(q) };
}

// ------------------------------------------------------------------ Partner portal (company users)
/** Quotes a company user may see: their own company's, never drafts. */
export async function listCompanyQuotes(companyId: number) {
  await expireDueQuotes();
  const rows = await (await quotes())
    .find({ company_id: companyId, audience: "company", status: { $ne: "draft" } }, { projection: { ref: 1, title: 1, status: 1, valid_until: 1, sent_at: 1, currency: 1, items: 1, discount_kind: 1, discount_value: 1, adults: 1, children: 1, rooms: 1, pricing_mode: 1, revision: 1 } })
    .sort({ sent_at: -1 })
    .toArray();
  return rows.map((q) => ({ id: q._id, ref: q.ref, title: q.title, status: q.status, valid_until: q.valid_until, sent_at: q.sent_at, currency: q.currency, revision: q.revision, total: quoteTotals(q).total, canRespond: canRespond(q) }));
}

/** One quote of the user's company (null for any other company's quote, or a draft). */
export async function getCompanyQuote(companyId: number, quoteId: number) {
  await expireDueQuotes();
  return (await quotes()).findOne({ _id: quoteId, company_id: companyId, audience: "company", status: { $ne: "draft" } });
}
