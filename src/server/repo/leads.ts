import "server-only";
import { UserFacingError } from "../errors";
import type { Filter } from "mongodb";
import type { Locale } from "@/content/site";
import type { LeadKind, LeadStatus } from "@/lib/travel-labels";
import { col, contains, nextId, now, tx } from "../db";
import { audit, nextRef } from "../security";
import { releaseSeats, reserveSeats } from "./programs";

/** What a traveler asked for in a tailor-made (custom) program request. */
export interface CustomWishes {
  country_codes: string[];
  places: string | null;
  date_from: string | null;
  date_to: string | null;
  flexible: boolean;
  days: number | null;
  nights: number | null;
  departure_airport: string | null;
  hotel_stars: number | null;
  budget_amount: number | null;
  budget_currency: string | null;
  airline_pref: string | null;
  services: string[];
  activities: string | null;
}

export interface LeadDoc {
  _id: number;
  ref: string;
  kind: LeadKind;
  program_id: number | null;
  departure_id: number | null;
  program_title: string;
  departure_label: string | null;
  preferred_date: string | null;
  /** The hotel choice the traveler picked (label and price copied at request time). */
  hotel_option: { id: string; label: string; price: number | null; currency: string } | null;
  custom: CustomWishes | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  room_type: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  locale: Locale;
  status: LeadStatus;
  assigned_to: number | null;
  /** Travelers counted on the departure while this request is confirmed. */
  seats_counted: number;
  source: string;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEventDoc {
  lead_id: number;
  user_id: number | null;
  kind: "created" | "status" | "note" | "assigned" | "contact" | "quote";
  body: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
}

const leads = () => col<LeadDoc>("leads");
const events = () => col<LeadEventDoc>("lead_events");

export type NewLead = Omit<LeadDoc, "_id" | "ref" | "status" | "assigned_to" | "seats_counted" | "source" | "created_at" | "updated_at">;

export async function createLead(input: NewLead): Promise<{ id: number; ref: string }> {
  const t = now();
  const id = await nextId("leads");
  const ref = await nextRef("REQ");
  await tx(async (session) => {
    await (await leads()).insertOne({ _id: id, ref, ...input, status: "new", assigned_to: null, seats_counted: 0, source: "website", created_at: t, updated_at: t }, { session });
    await (await events()).insertOne(
      { lead_id: id, user_id: null, kind: "created", body: input.kind === "custom" ? "طلب برنامج خاص من الموقع" : "طلب جديد من الموقع", from_status: null, to_status: "new", created_at: t },
      { session },
    );
  });
  return { id, ref };
}

export async function listLeads(opts: { status?: string; q?: string; programId?: number; kind?: LeadKind; limit?: number } = {}) {
  const filter: Filter<LeadDoc> = {};
  if (opts.status === "open") filter.status = { $in: ["new", "contacted", "quoted"] };
  else if (opts.status) filter.status = opts.status as LeadStatus;
  if (opts.programId) filter.program_id = opts.programId;
  if (opts.kind) filter.kind = opts.kind;
  if (opts.q) filter.$or = [{ ref: contains(opts.q) }, { full_name: contains(opts.q) }, { phone: contains(opts.q) }, { program_title: contains(opts.q) }];
  const rows = await (await leads()).find(filter).sort({ created_at: -1 }).limit(opts.limit ?? 300).toArray();
  const [staff, progs] = await Promise.all([
    (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: rows.map((r) => r.assigned_to).filter((x): x is number => !!x) } }, { projection: { name: 1 } }).toArray(),
    (await col<{ _id: number; slug: string }>("programs")).find({ _id: { $in: rows.map((r) => r.program_id).filter((x): x is number => !!x) } }, { projection: { slug: 1 } }).toArray(),
  ]);
  const sn = new Map(staff.map((s) => [s._id, s.name]));
  const ps = new Map(progs.map((p) => [p._id, p.slug]));
  return rows
    .map(({ _id, ...l }) => ({ id: _id, ...l, assignee: l.assigned_to ? (sn.get(l.assigned_to) ?? null) : null, program_slug: l.program_id ? (ps.get(l.program_id) ?? null) : null }))
    .sort((a, b) => Number(b.status === "new") - Number(a.status === "new") || b.created_at.localeCompare(a.created_at));
}

export async function getLead(id: number) {
  const l = await (await leads()).findOne({ _id: id });
  if (!l) return null;
  const [assignee, program, evs, quotes] = await Promise.all([
    l.assigned_to ? (await col<{ _id: number; name: string }>("staff_users")).findOne({ _id: l.assigned_to }) : null,
    l.program_id ? (await col<{ _id: number; slug: string; status: string; type: string }>("programs")).findOne({ _id: l.program_id }, { projection: { slug: 1, status: 1, type: 1 } }) : null,
    (await events()).find({ lead_id: id }).sort({ created_at: -1, _id: -1 }).toArray(),
    (await col<{ _id: number; ref: string; status: string; title: string }>("quotes")).find({ lead_id: id }, { projection: { ref: 1, status: 1, title: 1 } }).sort({ created_at: -1 }).toArray(),
  ]);
  const users = new Map(
    (await (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: evs.map((e) => e.user_id).filter((x): x is number => !!x) } }).toArray()).map((u) => [u._id, u.name]),
  );
  const { _id, ...rest } = l;
  return {
    lead: { id: _id, ...rest, assignee: assignee?.name ?? null, program_slug: program?.slug ?? null, program_status: program?.status ?? null, program_type: program?.type ?? null },
    events: evs.map((e) => ({ id: String(e._id), kind: e.kind, body: e.body, from_status: e.from_status, to_status: e.to_status, created_at: e.created_at, user_name: e.user_id ? (users.get(e.user_id) ?? null) : null })),
    quotes: quotes.map((q) => ({ id: q._id, ref: q.ref, status: q.status, title: q.title })),
  };
}

export class LeadError extends UserFacingError {}

/**
 * Status / note / assignment change. Confirming a request for a group date takes its seats in
 * the same transaction (atomic, cannot overbook); leaving "confirmed" gives them back.
 */
export async function updateLead(id: number, change: { status?: LeadStatus; note?: string | null; assigned_to?: number | null }, userId: number) {
  const t = now();
  await tx(async (session) => {
    const lc = await leads();
    const lead = await lc.findOne({ _id: id }, { session });
    if (!lead) throw new LeadError("الطلب غير موجود.");
    const ev = await events();
    if (change.status && change.status !== lead.status) {
      let seats = lead.seats_counted;
      if (lead.departure_id) {
        if (change.status === "confirmed" && lead.seats_counted === 0) {
          const pax = lead.adults + lead.children;
          if (!(await reserveSeats(lead.departure_id, pax, session))) throw new LeadError("لا توجد مقاعد كافية في هذا الموعد لتأكيد الطلب.");
          seats = pax;
        } else if (change.status !== "confirmed" && lead.seats_counted > 0) {
          await releaseSeats(lead.departure_id, lead.seats_counted, session);
          seats = 0;
        }
      }
      await lc.updateOne({ _id: id }, { $set: { status: change.status, seats_counted: seats, updated_at: t } }, { session });
      await ev.insertOne({ lead_id: id, user_id: userId, kind: "status", from_status: lead.status, to_status: change.status, body: change.note ?? null, created_at: t }, { session });
    } else if (change.note) {
      await ev.insertOne({ lead_id: id, user_id: userId, kind: "note", body: change.note, from_status: null, to_status: null, created_at: t }, { session });
      await lc.updateOne({ _id: id }, { $set: { updated_at: t } }, { session });
    }
    if (change.assigned_to !== undefined && change.assigned_to !== lead.assigned_to) {
      await lc.updateOne({ _id: id }, { $set: { assigned_to: change.assigned_to, updated_at: t } }, { session });
      const name = change.assigned_to ? (await (await col<{ _id: number; name: string }>("staff_users")).findOne({ _id: change.assigned_to }, { session }))?.name : null;
      await ev.insertOne({ lead_id: id, user_id: userId, kind: "assigned", body: name ? `أُسند إلى ${name}` : "أُلغي الإسناد", from_status: null, to_status: null, created_at: t }, { session });
    }
    await audit(userId, "update", "lead", id, change, { session });
  });
}

export async function logLeadContact(id: number, userId: number, channel: string) {
  await (await events()).insertOne({ lead_id: id, user_id: userId, kind: "contact", body: channel, from_status: null, to_status: null, created_at: now() });
}

export async function logLeadQuote(id: number, userId: number, quoteRef: string) {
  await (await events()).insertOne({ lead_id: id, user_id: userId, kind: "quote", body: `أُنشئ عرض سعر ${quoteRef}`, from_status: null, to_status: null, created_at: now() });
}

export const countNewLeads = async () => (await leads()).countDocuments({ status: "new" });

export async function getLeadDoc(id: number) {
  return (await leads()).findOne({ _id: id });
}
