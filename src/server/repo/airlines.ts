import "server-only";
import { UserFacingError } from "../errors";
import type { ClientSession, Filter } from "mongodb";
import { addDays } from "@/lib/dates";
import type { CommissionBasis, CommissionKind, CommissionMethod } from "@/lib/commission-math";
import { col, contains, nextId, now, tx } from "../db";
import { audit } from "../security";

// ------------------------------------------------------------------ Airlines
export const ISSUE_METHODS = ["airline_portal", "gds", "api", "email", "agent", "other"] as const;
export type IssueMethod = (typeof ISSUE_METHODS)[number];
export const ISSUE_METHOD_LABELS: Record<IssueMethod, string> = {
  airline_portal: "نظام شركة الطيران الرسمي",
  gds: "نظام GDS",
  api: "API",
  email: "البريد الإلكتروني",
  agent: "وكيل أو وسيط",
  other: "طريقة أخرى",
};

export const AIRLINE_STATUSES = ["active", "inactive", "suspended"] as const;
export type AirlineStatus = (typeof AIRLINE_STATUSES)[number];
export const AIRLINE_STATUS_LABELS: Record<AirlineStatus, string> = { active: "نتعامل معها", inactive: "غير نشطة", suspended: "متوقف التعامل" };

export const CREDIT_MODES = ["none", "credit", "balance"] as const;
export type CreditMode = (typeof CREDIT_MODES)[number];
export const CREDIT_LABELS: Record<CreditMode, string> = { none: "لا يوجد (دفع عند الإصدار)", credit: "حساب آجل", balance: "رصيد مسبق الدفع" };

/**
 * How tickets are issued with this airline. Information for staff only: the system does not
 * issue tickets itself (there is no airline API integration). Passwords are never stored here —
 * `secret_ref` only names where the credential is kept (e.g. the company password manager).
 */
export interface Issuance {
  method: IssueMethod;
  method_note: string | null;
  portal_url: string | null;
  email: string | null;
  phone: string | null;
  instructions: string | null;
  documents: string | null;
  booking_request: string | null;
  confirmation: string | null;
  payment: string | null;
  prepayment_required: boolean;
  credit: CreditMode;
  credit_note: string | null;
  access_notes: string | null;
  secret_ref: string | null;
  notes: string | null;
}

export interface AirlineDoc {
  _id: number;
  name_ar: string;
  name_en: string;
  iata: string | null;
  logo_media_id: string | null;
  country_code: string | null;
  contact: { phone: string | null; email: string | null; website: string | null; person: string | null };
  internal_notes: string | null;
  status: AirlineStatus;
  issuance: Issuance;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export const EMPTY_ISSUANCE: Issuance = {
  method: "airline_portal",
  method_note: null,
  portal_url: null,
  email: null,
  phone: null,
  instructions: null,
  documents: null,
  booking_request: null,
  confirmation: null,
  payment: null,
  prepayment_required: false,
  credit: "none",
  credit_note: null,
  access_notes: null,
  secret_ref: null,
  notes: null,
};

const airlines = () => col<AirlineDoc>("airlines");

export async function listAirlines(opts: { q?: string; status?: AirlineStatus } = {}) {
  const filter: Filter<AirlineDoc> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.q) filter.$or = [{ name_ar: contains(opts.q) }, { name_en: contains(opts.q) }, { iata: contains(opts.q) }];
  const rows = await (await airlines()).find(filter).sort({ status: 1, name_ar: 1 }).toArray();
  const today = new Date().toISOString().slice(0, 10);
  const ours = await rulesInEffect("etijah", rows.map((r) => r._id), null, today);
  const tickets = new Map(
    (await (await col("tickets")).aggregate<{ _id: number; n: number }>([{ $match: { airline_id: { $in: rows.map((r) => r._id) }, status: "issued" } }, { $group: { _id: "$airline_id", n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r.n]),
  );
  return rows.map(({ _id, ...a }) => ({ id: _id, ...a, our_rule: ours.get(_id) ?? null, tickets: tickets.get(_id) ?? 0 }));
}

export async function getAirline(id: number) {
  return (await airlines()).findOne({ _id: id });
}

export async function airlineOptions() {
  return (await (await airlines()).find({ status: { $ne: "suspended" } }, { projection: { name_ar: 1, name_en: 1, iata: 1, status: 1 } }).sort({ name_ar: 1 }).toArray()).map((a) => ({
    id: a._id,
    name: a.name_ar,
    name_en: a.name_en,
    iata: a.iata,
  }));
}

export type AirlineInput = Omit<AirlineDoc, "_id" | "created_by" | "created_at" | "updated_at">;

export async function iataTaken(iata: string, exceptId = 0) {
  return !!(await (await airlines()).findOne({ iata, _id: { $ne: exceptId } }, { projection: { _id: 1 } }));
}

export async function saveAirline(id: number | null, input: AirlineInput, userId: number) {
  const t = now();
  if (id) {
    const before = await getAirline(id);
    await (await airlines()).updateOne({ _id: id }, { $set: { ...input, updated_at: t } });
    const issuanceChanged = JSON.stringify(before?.issuance) !== JSON.stringify(input.issuance);
    await audit(userId, "update", "airline", id, issuanceChanged ? { issuance: { before: before?.issuance, after: input.issuance } } : null);
    return id;
  }
  const newId = await nextId("airlines");
  await (await airlines()).insertOne({ _id: newId, ...input, created_by: userId, created_at: t, updated_at: t });
  await audit(userId, "create", "airline", newId);
  return newId;
}

export async function deleteAirline(id: number, userId: number): Promise<string | null> {
  const used =
    (await (await col("tickets")).countDocuments({ airline_id: id }, { limit: 1 })) +
    (await (await col("commission_rules")).countDocuments({ airline_id: id }, { limit: 1 })) +
    (await (await col("programs")).countDocuments({ $or: [{ airline_ids: id }, { "flights.airline_id": id }] }, { limit: 1 }));
  if (used) return "شركة الطيران مستخدمة في تذاكر أو عمولات أو برامج. غيّر حالتها إلى «غير نشطة» بدلاً من الحذف.";
  await (await airlines()).deleteOne({ _id: id });
  await audit(userId, "delete", "airline", id);
  return null;
}

// ------------------------------------------------------------------ Commission rules
/**
 * Versioned commission terms. "etijah" rules: what an airline pays us. "company" rules: what we
 * pay a B2B company per airline. Rates are never edited in place — a new version starts on a
 * date and the previous open version is closed the day before, so past tickets keep the terms
 * that applied when they were issued (and tickets also copy those terms).
 */
export interface CommissionRuleDoc {
  _id: number;
  scope: "etijah" | "company";
  airline_id: number;
  company_id: number | null;
  kind: CommissionKind;
  method: CommissionMethod;
  rate_bp: number;
  fixed_amount: number | null;
  basis: CommissionBasis;
  basis_note: string | null;
  currency: string | null;
  settlement: string | null;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
}

const rules = () => col<CommissionRuleDoc>("commission_rules");

export async function listRules(opts: { scope?: "etijah" | "company"; airlineId?: number; companyId?: number | null } = {}) {
  const filter: Filter<CommissionRuleDoc> = {};
  if (opts.scope) filter.scope = opts.scope;
  if (opts.airlineId) filter.airline_id = opts.airlineId;
  if (opts.companyId !== undefined) filter.company_id = opts.companyId;
  const rows = await (await rules()).find(filter).sort({ airline_id: 1, company_id: 1, valid_from: -1 }).toArray();
  const used = new Set(
    (await (await col("tickets")).distinct("company_commission.rule_id", { "company_commission.rule_id": { $in: rows.map((r) => r._id) } }))
      .concat(await (await col("tickets")).distinct("etijah_commission.rule_id", { "etijah_commission.rule_id": { $in: rows.map((r) => r._id) } }))
      .map(Number),
  );
  const [al, co, us] = await Promise.all([
    (await airlines()).find({ _id: { $in: [...new Set(rows.map((r) => r.airline_id))] } }, { projection: { name_ar: 1, iata: 1 } }).toArray(),
    (await col<{ _id: number; name: string }>("companies")).find({ _id: { $in: rows.map((r) => r.company_id).filter((x): x is number => !!x) } }, { projection: { name: 1 } }).toArray(),
    (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: rows.map((r) => r.created_by).filter((x): x is number => !!x) } }, { projection: { name: 1 } }).toArray(),
  ]);
  const an = new Map(al.map((a) => [a._id, `${a.name_ar}${a.iata ? ` (${a.iata})` : ""}`]));
  const cn = new Map(co.map((c) => [c._id, c.name]));
  const un = new Map(us.map((u) => [u._id, u.name]));
  const today = new Date().toISOString().slice(0, 10);
  return rows.map(({ _id, ...r }) => ({
    id: _id,
    ...r,
    airline_name: an.get(r.airline_id) ?? `#${r.airline_id}`,
    company_name: r.company_id ? (cn.get(r.company_id) ?? `#${r.company_id}`) : null,
    created_by_name: r.created_by ? (un.get(r.created_by) ?? null) : null,
    used: used.has(_id),
    current: r.valid_from <= today && (!r.valid_to || r.valid_to >= today),
    future: r.valid_from > today,
  }));
}

/** The rule in effect on `day` for one airline (and company, for company rules). */
export async function ruleInEffect(scope: "etijah" | "company", airlineId: number, companyId: number | null, day: string, session?: ClientSession) {
  return (await rules()).findOne(
    { scope, airline_id: airlineId, company_id: scope === "company" ? companyId : null, valid_from: { $lte: day }, $or: [{ valid_to: null }, { valid_to: { $gte: day } }] },
    { sort: { valid_from: -1, created_at: -1 }, session },
  );
}

export async function rulesInEffect(scope: "etijah" | "company", airlineIds: number[], companyId: number | null, day: string) {
  const rows = await (await rules())
    .find({ scope, airline_id: { $in: airlineIds }, company_id: scope === "company" ? companyId : null, valid_from: { $lte: day }, $or: [{ valid_to: null }, { valid_to: { $gte: day } }] })
    .sort({ valid_from: -1, created_at: -1 })
    .toArray();
  const map = new Map<number, CommissionRuleDoc>();
  for (const r of rows) if (!map.has(r.airline_id)) map.set(r.airline_id, r);
  return map;
}

export type RuleInput = Omit<CommissionRuleDoc, "_id" | "created_by" | "created_at">;

export class RuleError extends UserFacingError {}

/**
 * Adds a new version. The previous open-ended version (if it started earlier) is closed the day
 * before; any other overlap is refused so exactly one rule applies on any given day.
 */
export async function addRule(input: RuleInput, userId: number): Promise<number> {
  const id = await nextId("commission_rules");
  await tx(async (session) => {
    const c = await rules();
    const key = { scope: input.scope, airline_id: input.airline_id, company_id: input.scope === "company" ? input.company_id : null };
    const open = await c.findOne({ ...key, valid_to: null, valid_from: { $lt: input.valid_from } }, { session });
    if (open) {
      const close = addDays(input.valid_from, -1);
      const lastUse = await lastTicketDay(open._id, session);
      if (lastUse && lastUse > close) throw new RuleError(`القاعدة الحالية استُخدمت في تذاكر حتى ${lastUse}. اختر تاريخ بداية بعد هذا التاريخ.`);
      await c.updateOne({ _id: open._id }, { $set: { valid_to: close } }, { session });
      await audit(userId, "close", "commission_rule", open._id, { valid_to: close, reason: `superseded by #${id}` }, { session });
    }
    const end = input.valid_to ?? "9999-12-31";
    const overlap = await c.findOne(
      { ...key, valid_from: { $lte: end }, $or: [{ valid_to: null }, { valid_to: { $gte: input.valid_from } }] },
      { session },
    );
    if (overlap) throw new RuleError(`تتداخل الفترة مع قاعدة أخرى تبدأ ${overlap.valid_from}${overlap.valid_to ? ` وتنتهي ${overlap.valid_to}` : ""}.`);
    await c.insertOne({ _id: id, ...input, company_id: key.company_id, created_by: userId, created_at: now() }, { session });
    await audit(userId, "create", "commission_rule", id, { ...input }, { session });
  });
  return id;
}

async function lastTicketDay(ruleId: number, session?: ClientSession) {
  const t = await (await col<{ issued_at: string }>("tickets")).findOne(
    { $or: [{ "company_commission.rule_id": ruleId }, { "etijah_commission.rule_id": ruleId }], status: "issued" },
    { sort: { issued_at: -1 }, projection: { issued_at: 1 }, session },
  );
  return t?.issued_at ?? null;
}

/** Ends a rule on a date (never before the last ticket that used it). Notes can also change. */
export async function endRule(id: number, validTo: string | null, notes: string | null, userId: number) {
  const r = await (await rules()).findOne({ _id: id });
  if (!r) throw new RuleError("القاعدة غير موجودة.");
  if (validTo && validTo < r.valid_from) throw new RuleError("تاريخ النهاية قبل تاريخ البداية.");
  const lastUse = await lastTicketDay(id);
  if (validTo && lastUse && validTo < lastUse) throw new RuleError(`استُخدمت هذه القاعدة في تذاكر حتى ${lastUse}؛ لا يمكن إنهاؤها قبل ذلك.`);
  if (!validTo) {
    const later = await (await rules()).findOne({ scope: r.scope, airline_id: r.airline_id, company_id: r.company_id, valid_from: { $gt: r.valid_from }, _id: { $ne: id } });
    if (later) throw new RuleError("توجد قاعدة لاحقة؛ لا يمكن جعل هذه القاعدة مفتوحة النهاية.");
  }
  await (await rules()).updateOne({ _id: id }, { $set: { valid_to: validTo, notes } });
  await audit(userId, "update", "commission_rule", id, { before: { valid_to: r.valid_to, notes: r.notes }, after: { valid_to: validTo, notes } });
}

/** Unused rules (entered by mistake) can be deleted; used ones are history and stay. */
export async function deleteRule(id: number, userId: number) {
  const usedAnywhere = await (await col("tickets")).countDocuments({ $or: [{ "company_commission.rule_id": id }, { "etijah_commission.rule_id": id }] }, { limit: 1 });
  if (usedAnywhere) throw new RuleError("هذه القاعدة مستخدمة في تذاكر مسجلة ولا يمكن حذفها. أنهِ صلاحيتها بدلاً من ذلك.");
  const r = await (await rules()).findOneAndDelete({ _id: id });
  await audit(userId, "delete", "commission_rule", id, r ? { ...r } : null);
}
