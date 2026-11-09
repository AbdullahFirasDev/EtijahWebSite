import "server-only";
import { site, type Locale } from "@/content/site";
import { addDays, todayDay } from "@/lib/dates";
import type { MediaRef } from "@/lib/media";
import { quoteMargin, quoteTotals, type DiscountKind, type ItemKind, type ItemUnit, type PricingMode } from "@/lib/quote-math";
import { pick, type Board, type QuoteStatus } from "@/lib/travel-labels";
import { all, get, now, placeholders, run, tx } from "../db";
import { mediaById, mediaByIds } from "../media";
import { audit, nextRef, randomToken } from "../security";
import { hotelsPublic, isHotelPublic, type HotelPublic } from "./catalog";
import { getProgramEditor } from "./programs";
import { getSettings } from "./settings";

export interface QuoteRow {
  id: number;
  ref: string;
  revision: number;
  company_id: number;
  contact_id: number | null;
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
  inclusions: string;
  exclusions: string;
  notes: string | null;
  terms: string | null;
  internal_notes: string | null;
  cover_media_id: string | null;
  valid_until: string;
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
  created_at: string;
  updated_at: string;
}

export interface QuoteItemInput {
  kind: ItemKind;
  label: string;
  description: string | null;
  unit: ItemUnit;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
}

export interface QuoteInput {
  company_id: number;
  contact_id: number | null;
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
  days: { title: string; body: string | null }[];
  hotels: { hotel_id: number; check_in: string | null; check_out: string | null; nights: number; room_type: string | null; board: Board | null; rooms: number | null }[];
  items: QuoteItemInput[];
}

const OPEN_STATUSES = ["sent", "viewed", "changes_requested"] as const;

/** Moves quotes whose price validity has passed to "expired" (lazy; runs on reads). */
export function expireDueQuotes() {
  const today = todayDay();
  const due = all<{ id: number }>(
    `SELECT id FROM quotes WHERE status IN (${OPEN_STATUSES.map((s) => `'${s}'`).join(", ")}) AND valid_until < ?`,
    today,
  );
  if (!due.length) return;
  const t = now();
  tx(() => {
    for (const q of due) {
      run("UPDATE quotes SET status = 'expired', updated_at = ? WHERE id = ?", t, q.id);
      run("INSERT INTO quote_events (quote_id, kind, actor_label, created_at) VALUES (?, 'expired', 'system', ?)", q.id, t);
    }
  });
}

export function addQuoteEvent(quoteId: number, kind: string, opts: { channel?: string; userId?: number | null; label?: string; note?: string | null } = {}) {
  run(
    "INSERT INTO quote_events (quote_id, kind, channel, actor_user_id, actor_label, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    quoteId,
    kind,
    opts.channel ?? null,
    opts.userId ?? null,
    opts.label ?? null,
    opts.note ?? null,
    now(),
  );
}

// ------------------------------------------------------------------ Staff
export function quoteItems(quoteId: number) {
  return all<QuoteItemInput & { id: number }>(
    "SELECT id, kind, label, description, unit, quantity, unit_price, unit_cost FROM quote_items WHERE quote_id = ? ORDER BY sort",
    quoteId,
  );
}

export function listQuotes(opts: { status?: string; q?: string; companyId?: number } = {}) {
  expireDueQuotes();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.status === "open") where.push(`q.status IN ('sent', 'viewed', 'changes_requested')`);
  else if (opts.status) {
    where.push("q.status = ?");
    params.push(opts.status);
  }
  if (opts.companyId) {
    where.push("q.company_id = ?");
    params.push(opts.companyId);
  }
  if (opts.q) {
    where.push("(q.ref LIKE ? OR q.title LIKE ? OR c.name LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`);
  }
  const rows = all<QuoteRow & { company_name: string; owner: string | null }>(
    `SELECT q.*, c.name AS company_name, u.name AS owner FROM quotes q JOIN companies c ON c.id = q.company_id
     LEFT JOIN staff_users u ON u.id = q.created_by ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY q.updated_at DESC LIMIT 500`,
    ...params,
  );
  const items = rows.length
    ? all<QuoteItemInput & { quote_id: number }>(
        `SELECT quote_id, kind, quantity, unit_price, unit_cost FROM quote_items WHERE quote_id IN (${placeholders(rows.length)})`,
        ...rows.map((r) => r.id),
      )
    : [];
  return rows.map((r) => {
    const own = items.filter((i) => i.quote_id === r.id);
    return { ...r, total: quoteTotals({ ...r, items: own }).total };
  });
}

export type QuoteEditorData = QuoteInput & {
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
};

export function getQuoteRow(id: number) {
  expireDueQuotes();
  return get<QuoteRow>("SELECT * FROM quotes WHERE id = ?", id);
}

export function getQuoteEditor(id: number): QuoteEditorData | null {
  const q = getQuoteRow(id);
  if (!q) return null;
  return {
    ...rowToInput(q),
    id: q.id,
    ref: q.ref,
    revision: q.revision,
    status: q.status,
    token: q.token,
    link_expires_at: q.link_expires_at,
    link_revoked_at: q.link_revoked_at,
    sent_at: q.sent_at,
    first_viewed_at: q.first_viewed_at,
    last_viewed_at: q.last_viewed_at,
    view_count: q.view_count,
    responded_at: q.responded_at,
    response_name: q.response_name,
    response_note: q.response_note,
    created_at: q.created_at,
    updated_at: q.updated_at,
  };
}

function rowToInput(q: QuoteRow): QuoteInput {
  return {
    company_id: q.company_id,
    contact_id: q.contact_id,
    program_id: q.program_id,
    locale: q.locale,
    title: q.title,
    destination: q.destination,
    intro: q.intro,
    start_date: q.start_date,
    end_date: q.end_date,
    adults: q.adults,
    children: q.children,
    infants: q.infants,
    rooms: q.rooms,
    rooms_note: q.rooms_note,
    currency: q.currency,
    pricing_mode: q.pricing_mode,
    discount_kind: q.discount_kind,
    discount_value: q.discount_value,
    discount_label: q.discount_label,
    inclusions: JSON.parse(q.inclusions) as string[],
    exclusions: JSON.parse(q.exclusions) as string[],
    notes: q.notes,
    terms: q.terms,
    internal_notes: q.internal_notes,
    cover_media_id: q.cover_media_id,
    valid_until: q.valid_until,
    gallery: all<{ media_id: string }>("SELECT media_id FROM quote_media WHERE quote_id = ? ORDER BY sort", q.id).map((m) => m.media_id),
    days: all("SELECT title, body FROM quote_days WHERE quote_id = ? ORDER BY sort", q.id),
    hotels: all("SELECT hotel_id, check_in, check_out, nights, room_type, board, rooms FROM quote_hotels WHERE quote_id = ? ORDER BY sort", q.id),
    items: quoteItems(q.id).map((i) => ({ kind: i.kind, label: i.label, description: i.description, unit: i.unit, quantity: i.quantity, unit_price: i.unit_price, unit_cost: i.unit_cost })),
  };
}

export function quoteEvents(quoteId: number) {
  return all<{ id: number; kind: string; channel: string | null; actor_label: string | null; note: string | null; created_at: string; user_name: string | null }>(
    `SELECT e.id, e.kind, e.channel, e.actor_label, e.note, e.created_at, u.name AS user_name FROM quote_events e
     LEFT JOIN staff_users u ON u.id = e.actor_user_id WHERE e.quote_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    quoteId,
  );
}

export function saveQuote(id: number | null, input: QuoteInput, userId: number): number {
  const t = now();
  return tx(() => {
    const cols = [
      input.company_id, input.contact_id, input.program_id, input.locale, input.title, input.destination, input.intro, input.start_date, input.end_date,
      input.adults, input.children, input.infants, input.rooms, input.rooms_note, input.currency, input.pricing_mode, input.discount_kind,
      input.discount_value, input.discount_label, JSON.stringify(input.inclusions), JSON.stringify(input.exclusions), input.notes, input.terms,
      input.internal_notes, input.cover_media_id, input.valid_until,
    ];
    let quoteId = id;
    if (quoteId) {
      const existing = get<{ status: QuoteStatus; valid_until: string }>("SELECT status, valid_until FROM quotes WHERE id = ?", quoteId)!;
      // Editing a quote the client has already received creates a new revision.
      const revise = existing.status !== "draft";
      // Extending the validity of an expired quote reopens it.
      const reopen = existing.status === "expired" && input.valid_until >= todayDay();
      run(
        `UPDATE quotes SET company_id = ?, contact_id = ?, program_id = ?, locale = ?, title = ?, destination = ?, intro = ?, start_date = ?, end_date = ?,
           adults = ?, children = ?, infants = ?, rooms = ?, rooms_note = ?, currency = ?, pricing_mode = ?, discount_kind = ?, discount_value = ?,
           discount_label = ?, inclusions = ?, exclusions = ?, notes = ?, terms = ?, internal_notes = ?, cover_media_id = ?, valid_until = ?,
           revision = revision + ?, status = CASE WHEN ? THEN 'sent' ELSE status END, updated_by = ?, updated_at = ? WHERE id = ?`,
        ...cols, revise ? 1 : 0, reopen, userId, t, quoteId,
      );
      if (revise) addQuoteEvent(quoteId, "revised", { userId });
      else addQuoteEvent(quoteId, "updated", { userId });
    } else {
      const ref = nextRef("QT");
      quoteId = run(
        `INSERT INTO quotes (company_id, contact_id, program_id, locale, title, destination, intro, start_date, end_date, adults, children, infants, rooms,
           rooms_note, currency, pricing_mode, discount_kind, discount_value, discount_label, inclusions, exclusions, notes, terms, internal_notes,
           cover_media_id, valid_until, ref, token, link_expires_at, status, created_by, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        ...cols, ref, randomToken(32), `${addDays(input.valid_until, 30)}T23:59:59.000Z`, userId, userId, t, t,
      ).id;
      addQuoteEvent(quoteId, "created", { userId });
    }
    const qid = quoteId!;
    for (const table of ["quote_days", "quote_hotels", "quote_items", "quote_media"]) run(`DELETE FROM ${table} WHERE quote_id = ?`, qid);
    input.days.forEach((d, i) => run("INSERT INTO quote_days (quote_id, day_number, title, body, sort) VALUES (?, ?, ?, ?, ?)", qid, i + 1, d.title, d.body, i));
    input.hotels.forEach((h, i) =>
      run(
        "INSERT INTO quote_hotels (quote_id, hotel_id, check_in, check_out, nights, room_type, board, rooms, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        qid, h.hotel_id, h.check_in, h.check_out, h.nights, h.room_type, h.board, h.rooms, i,
      ),
    );
    input.items.forEach((it, i) =>
      run(
        "INSERT INTO quote_items (quote_id, kind, label, description, unit, quantity, unit_price, unit_cost, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        qid, it.kind, it.label, it.description, it.unit, it.quantity, it.unit_price, it.unit_cost, i,
      ),
    );
    input.gallery.forEach((m, i) => run("INSERT INTO quote_media (quote_id, media_id, sort) VALUES (?, ?, ?)", qid, m, i));
    audit(userId, id ? "update" : "create", "quote", qid);
    return qid;
  });
}

/** Problems that block sending a quote. */
export function sendProblems(q: QuoteEditorData): string[] {
  const problems: string[] = [];
  if (!q.items.some((i) => i.kind === "main")) problems.push("أضف بند سعر أساسياً واحداً على الأقل.");
  if (q.valid_until < todayDay()) problems.push("تاريخ صلاحية العرض منتهٍ. حدّث تاريخ الصلاحية قبل الإرسال.");
  if (q.link_revoked_at) problems.push("رابط العرض ملغى. أنشئ رابطاً جديداً قبل الإرسال.");
  return problems;
}

export function markQuoteSent(id: number, channel: string, userId: number) {
  const t = now();
  tx(() => {
    const q = get<{ status: QuoteStatus }>("SELECT status FROM quotes WHERE id = ?", id)!;
    if (q.status === "draft") run("UPDATE quotes SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?", t, t, id);
    else run("UPDATE quotes SET sent_at = COALESCE(sent_at, ?) WHERE id = ?", t, id);
    addQuoteEvent(id, q.status === "draft" ? "sent" : "resent", { channel, userId });
  });
}

export function setQuoteStatus(id: number, status: QuoteStatus, userId: number, note: string | null) {
  const t = now();
  tx(() => {
    run("UPDATE quotes SET status = ?, updated_at = ?, responded_at = CASE WHEN ? IN ('accepted', 'rejected') THEN ? ELSE responded_at END WHERE id = ?", status, t, status, t, id);
    addQuoteEvent(id, `status:${status}`, { userId, note });
  });
}

export function revokeQuoteLink(id: number, userId: number) {
  run("UPDATE quotes SET link_revoked_at = ?, updated_at = ? WHERE id = ?", now(), now(), id);
  addQuoteEvent(id, "link_revoked", { userId });
}

export function regenerateQuoteLink(id: number, userId: number) {
  run("UPDATE quotes SET token = ?, link_revoked_at = NULL, updated_at = ? WHERE id = ?", randomToken(32), now(), id);
  addQuoteEvent(id, "link_regenerated", { userId });
}

export function setQuoteLinkExpiry(id: number, expires: string | null, userId: number) {
  run("UPDATE quotes SET link_expires_at = ?, updated_at = ? WHERE id = ?", expires ? `${expires}T23:59:59.000Z` : null, now(), id);
  addQuoteEvent(id, "link_expiry", { userId, note: expires ?? "بدون انتهاء" });
}

export function deleteQuote(id: number, userId: number) {
  run("DELETE FROM quotes WHERE id = ?", id);
  audit(userId, "delete", "quote", id);
}

export function duplicateQuote(id: number, userId: number): number | null {
  const q = getQuoteEditor(id);
  if (!q) return null;
  const s = getSettings();
  const valid = q.valid_until < todayDay() ? addDays(todayDay(), s.quote_validity_days) : q.valid_until;
  return saveQuote(null, { ...rowToInput(getQuoteRow(id)!), valid_until: valid, title: q.title }, userId);
}

/** Starting content for a quote built from a catalog program, in the quote's language. */
export function quoteDraftFromProgram(programId: number, locale: Locale, adults: number) {
  const p = getProgramEditor(programId);
  if (!p) return null;
  const services = all<{ id: number; name_ar: string; name_en: string }>("SELECT id, name_ar, name_en FROM services");
  const name = (sid: number) => {
    const s = services.find((x) => x.id === sid);
    return s ? pick(locale, s.name_ar, s.name_en) : "";
  };
  const svc = (included: boolean) =>
    p.services
      .filter((s) => s.included === included)
      .map((s) => [name(s.service_id), pick(locale, s.note_ar, s.note_en)].filter(Boolean).join(" — "))
      .filter(Boolean);
  const dests = all<{ name_ar: string; name_en: string }>(
    "SELECT d.name_ar, d.name_en FROM program_destinations pd JOIN destinations d ON d.id = pd.destination_id WHERE pd.program_id = ? ORDER BY pd.sort",
    programId,
  );
  return {
    program_id: p.id,
    title: pick(locale, p.title_ar, p.title_en),
    destination: dests.map((d) => pick(locale, d.name_ar, d.name_en)).join(locale === "ar" ? "، " : ", "),
    intro: pick(locale, p.summary_ar, p.summary_en) || null,
    currency: p.currency,
    cover: mediaById(p.cover_media_id),
    gallery: (() => {
      const ids = p.gallery.slice(0, 6);
      const map = mediaByIds(ids);
      return ids.map((m) => map.get(m)).filter((m): m is MediaRef => !!m);
    })(),
    days: p.days.map((d) => ({ title: pick(locale, d.title_ar, d.title_en), body: pick(locale, d.body_ar, d.body_en) || null })),
    hotels: p.hotels.map((h) => ({ hotel_id: h.hotel_id, check_in: null, check_out: null, nights: h.nights, room_type: pick(locale, h.room_ar, h.room_en) || null, board: h.board, rooms: null })),
    inclusions: svc(true),
    exclusions: svc(false),
    items: p.prices.map((pr) => ({
      kind: "main" as const,
      label: pick(locale, pr.label_ar, pr.label_en),
      description: null,
      unit: "person" as const,
      quantity: Math.max(1, adults),
      unit_price: pr.amount,
      unit_cost: null,
    })),
    duration_days: p.duration_days,
  };
}

// ------------------------------------------------------------------ Client access
export function getQuoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  expireDueQuotes();
  return get<QuoteRow>("SELECT * FROM quotes WHERE token = ?", token) ?? null;
}

/** Whether a client (not staff) may open this quote link right now. */
export function clientLinkOpen(q: QuoteRow): boolean {
  if (q.status === "draft") return false;
  if (q.link_revoked_at) return false;
  if (q.link_expires_at && q.link_expires_at < now()) return false;
  return true;
}

export function recordQuoteView(q: QuoteRow) {
  const t = now();
  tx(() => {
    const recent = q.last_viewed_at && Date.parse(q.last_viewed_at) > Date.now() - 30 * 60_000;
    run(
      `UPDATE quotes SET view_count = view_count + 1, last_viewed_at = ?, first_viewed_at = COALESCE(first_viewed_at, ?),
         status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END WHERE id = ?`,
      t, t, q.id,
    );
    if (!recent) addQuoteEvent(q.id, "viewed", { label: "client" });
  });
}

export function respondToQuote(q: QuoteRow, action: "accept" | "changes", name: string, note: string | null) {
  const t = now();
  const status: QuoteStatus = action === "accept" ? "accepted" : "changes_requested";
  tx(() => {
    run("UPDATE quotes SET status = ?, responded_at = ?, response_name = ?, response_note = ?, updated_at = ? WHERE id = ?", status, t, name, note, t, q.id);
    addQuoteEvent(q.id, action === "accept" ? "accepted" : "changes_requested", { label: name, note });
  });
}

export const canRespond = (q: QuoteRow) => (["sent", "viewed", "changes_requested"] as QuoteStatus[]).includes(q.status) && q.valid_until >= todayDay();

/**
 * Client-safe view of a quote, for the web page and the PDF. Built field by field (a whitelist):
 * internal costs, margins, internal notes and staff details never appear here.
 */
export interface QuoteView {
  ref: string;
  revision: number;
  locale: Locale;
  status: QuoteStatus;
  canRespond: boolean;
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
  company: { name: string };
  contact: { name: string; position: string | null } | null;
  preparedBy: string | null;
  cover: MediaRef | null;
  gallery: MediaRef[];
  days: { day: number; title: string; body: string | null }[];
  hotels: (HotelPublic & { checkIn: string | null; checkOut: string | null; nights: number; roomType: string | null; board: Board | null; roomsCount: number | null; link: string | null })[];
}

/** The approved link for a hotel name: official site, then Google Maps, then our public hotel page. */
export function hotelLink(h: Pick<HotelPublic, "id" | "slug" | "websiteUrl" | "mapsUrl">, locale: Locale): string | null {
  if (h.websiteUrl) return h.websiteUrl;
  if (h.mapsUrl) return h.mapsUrl;
  if (site.url && isHotelPublic(h.id)) return `${site.url}${locale === "en" ? "/en" : ""}/hotels/${h.slug}/`;
  return null;
}

export function buildQuoteView(q: QuoteRow): QuoteView {
  const input = rowToInput(q);
  const locale = q.locale;
  const company = get<{ name: string; name_en: string | null }>("SELECT name, name_en FROM companies WHERE id = ?", q.company_id)!;
  const contact = q.contact_id ? get<{ name: string; position: string | null }>("SELECT name, position FROM company_contacts WHERE id = ?", q.contact_id) : undefined;
  const preparedBy = q.created_by ? (get<{ name: string }>("SELECT name FROM staff_users WHERE id = ?", q.created_by)?.name ?? null) : null;
  const hotels = hotelsPublic(input.hotels.map((h) => h.hotel_id), locale);
  const media = mediaByIds(input.gallery);
  const totals = quoteTotals(input);

  return {
    ref: q.ref,
    revision: q.revision,
    locale,
    status: q.status,
    canRespond: canRespond(q),
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
    items: input.items.map((i) => ({
      kind: i.kind,
      label: i.label,
      description: i.description,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      total: i.quantity * i.unit_price,
    })),
    totals,
    discount: q.discount_kind && q.discount_value > 0 ? { kind: q.discount_kind, value: q.discount_value, label: q.discount_label } : null,
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    notes: q.notes,
    terms: q.terms,
    validUntil: q.valid_until,
    issuedAt: q.sent_at ?? q.updated_at,
    respondedAt: q.responded_at,
    responseName: q.response_name,
    company: { name: locale === "en" ? company.name_en || company.name : company.name },
    contact: contact ? { name: contact.name, position: contact.position } : null,
    preparedBy,
    cover: mediaById(q.cover_media_id),
    gallery: input.gallery.map((m) => media.get(m)).filter((m): m is MediaRef => !!m),
    days: input.days.map((d, i) => ({ day: i + 1, title: d.title, body: d.body })),
    hotels: input.hotels
      .map((h) => {
        const hotel = hotels.get(h.hotel_id);
        if (!hotel) return null;
        return { ...hotel, checkIn: h.check_in, checkOut: h.check_out, nights: h.nights, roomType: h.room_type, board: h.board, roomsCount: h.rooms, link: hotelLink(hotel, locale) };
      })
      .filter((h): h is NonNullable<typeof h> => !!h),
  };
}

/** INTERNAL: margin summary for the staff editor and list. */
export function quoteInternalSummary(q: QuoteEditorData) {
  return { ...quoteTotals(q), ...quoteMargin(q) };
}
