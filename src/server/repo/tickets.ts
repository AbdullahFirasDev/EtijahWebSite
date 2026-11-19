import "server-only";
import { UserFacingError } from "../errors";
import type { Filter } from "mongodb";
import { commissionAmount, ticketMath, type CommissionBasis, type CommissionKind, type CommissionMethod, type Fare } from "@/lib/commission-math";
import { col, contains, nextId, now, tx } from "../db";
import { audit, nextRef } from "../security";
import { ruleInEffect, type CommissionRuleDoc, type IssueMethod } from "./airlines";

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = { unpaid: "غير مسدد", partial: "مسدد جزئياً", paid: "مسدد" };

export const SETTLEMENT_STATUSES = ["pending", "settled"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/** The commission terms a ticket used, copied when it was recorded (history never changes). */
export interface CommissionSnapshot {
  rule_id: number | null;
  kind: CommissionKind;
  method: CommissionMethod;
  rate_bp: number;
  fixed_amount: number | null;
  basis: CommissionBasis;
  currency: string | null;
  amount: number;
  /** Set when an authorised accountant replaced the computed amount (with a reason). */
  overridden: boolean;
  computed_amount: number;
  override_reason: string | null;
}

export interface TicketDoc {
  _id: number;
  ref: string;
  airline_id: number;
  company_id: number | null;
  ticket_number: string;
  pnr: string | null;
  passenger: string | null;
  route: string | null;
  currency: string;
  base_fare: number;
  taxes: number;
  total_fare: number;
  service_fee: number;
  other_basis_amount: number | null;
  issue_method: IssueMethod;
  issued_at: string;
  staff_id: number;
  payment_method: string | null;
  payment_status: PaymentStatus;
  paid_amount: number;
  airline_settlement: SettlementStatus;
  company_commission: CommissionSnapshot | null;
  etijah_commission: CommissionSnapshot;
  net_due: number;
  payable_to_airline: number;
  etijah_margin: number;
  notes: string | null;
  status: "issued" | "void";
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

const tickets = () => col<TicketDoc>("tickets");

export interface TicketInput {
  airline_id: number;
  company_id: number | null;
  ticket_number: string;
  pnr: string | null;
  passenger: string | null;
  route: string | null;
  currency: string;
  base_fare: number;
  taxes: number;
  service_fee: number;
  other_basis_amount: number | null;
  issue_method: IssueMethod;
  issued_at: string;
  payment_method: string | null;
  payment_status: PaymentStatus;
  paid_amount: number;
  airline_settlement: SettlementStatus;
  notes: string | null;
  company_override: { amount: number; reason: string } | null;
  etijah_override: { amount: number; reason: string } | null;
}

const NO_RULE = (kind: CommissionKind = "none"): Omit<CommissionSnapshot, "amount" | "computed_amount" | "overridden" | "override_reason"> => ({
  rule_id: null,
  kind,
  method: "percent",
  rate_bp: 0,
  fixed_amount: null,
  basis: "base_fare",
  currency: null,
});

const snapshotOf = (r: CommissionRuleDoc | null) =>
  r ? { rule_id: r._id, kind: r.kind, method: r.method, rate_bp: r.rate_bp, fixed_amount: r.fixed_amount, basis: r.basis, currency: r.currency } : NO_RULE();

export interface TicketPreview {
  fare: Fare;
  company: (CommissionSnapshot & { missing: boolean }) | null;
  etijah: CommissionSnapshot & { missing: boolean };
  math: ReturnType<typeof ticketMath>;
  warnings: string[];
}

/**
 * Computes a ticket's commissions from the rules in effect on its issue date. Used for the
 * "review before saving" step and again (authoritatively) when saving.
 */
export async function previewTicket(input: TicketInput, rulesOverride?: { company: CommissionRuleDoc | null; etijah: CommissionRuleDoc | null }): Promise<TicketPreview> {
  const fare: Fare = { currency: input.currency, base_fare: input.base_fare, taxes: input.taxes, service_fee: input.service_fee, other_basis_amount: input.other_basis_amount };
  const etijahRule = rulesOverride ? rulesOverride.etijah : await ruleInEffect("etijah", input.airline_id, null, input.issued_at);
  const companyRule = input.company_id ? (rulesOverride ? rulesOverride.company : await ruleInEffect("company", input.airline_id, input.company_id, input.issued_at)) : null;
  const warnings: string[] = [];
  if (!etijahRule) warnings.push("لا توجد قاعدة لعمولة الاتجاه لهذه الشركة في تاريخ الإصدار: سُجّلت العملية بدون عمولة. أضف القاعدة إن كانت هناك عمولة.");
  if (input.company_id && !companyRule) warnings.push("لا توجد عمولة محددة لهذه الشركة مع هذا الخط في تاريخ الإصدار: احتُسبت العمولة صفراً.");

  const build = (rule: CommissionRuleDoc | null, override: TicketInput["company_override"]) => {
    const base = snapshotOf(rule);
    const computed = commissionAmount(rule, fare);
    return {
      ...base,
      computed_amount: computed,
      amount: override ? override.amount : computed,
      overridden: !!override,
      override_reason: override?.reason ?? null,
      missing: !rule,
    };
  };
  const etijah = build(etijahRule, input.etijah_override);
  const company = input.company_id ? build(companyRule, input.company_override) : null;
  const math = ticketMath(fare, company, etijah);
  if (math.etijah_margin < 0) warnings.push("تنبيه: عمولة الشركة أكبر من عمولة الاتجاه ورسوم الخدمة — نتيجة العملية سالبة.");
  if (etijahRule?.kind === "net_fare") warnings.push("هذا الخط يعمل بالسعر الصافي: المبلغ المدخل هو المستحق لشركة الطيران.");
  return { fare, company, etijah, math, warnings };
}

export class TicketError extends UserFacingError {}

export async function createTicket(input: TicketInput, staffId: number, expectedRuleIds?: { company: number | null; etijah: number | null }) {
  const preview = await previewTicket(input);
  // The rules may have changed between the review and the save: ask staff to review again.
  if (expectedRuleIds && (expectedRuleIds.etijah !== preview.etijah.rule_id || (input.company_id && expectedRuleIds.company !== (preview.company?.rule_id ?? null))))
    throw new TicketError("تغيرت قواعد العمولة منذ المراجعة. راجع الاحتساب مرة أخرى ثم احفظ.");
  const t = now();
  const id = await nextId("tickets");
  const ref = await nextRef("TKT");
  const strip = <T extends { missing: boolean }>(x: T) => {
    const { missing: _m, ...rest } = x;
    return rest;
  };
  try {
    await tx(async (session) => {
      await (await tickets()).insertOne(
        {
          _id: id,
          ref,
          airline_id: input.airline_id,
          company_id: input.company_id,
          ticket_number: input.ticket_number,
          pnr: input.pnr,
          passenger: input.passenger,
          route: input.route,
          currency: input.currency,
          base_fare: input.base_fare,
          taxes: input.taxes,
          total_fare: preview.math.total_fare,
          service_fee: input.service_fee,
          other_basis_amount: input.other_basis_amount,
          issue_method: input.issue_method,
          issued_at: input.issued_at,
          staff_id: staffId,
          payment_method: input.payment_method,
          payment_status: input.payment_status,
          paid_amount: input.paid_amount,
          airline_settlement: input.airline_settlement,
          company_commission: preview.company ? strip(preview.company) : null,
          etijah_commission: strip(preview.etijah),
          net_due: preview.math.net_due,
          payable_to_airline: preview.math.payable_to_airline,
          etijah_margin: preview.math.etijah_margin,
          notes: input.notes,
          status: "issued",
          void_reason: null,
          created_at: t,
          updated_at: t,
        },
        { session },
      );
      await audit(staffId, "create", "ticket", id, { ref, amounts: preview.math, company_rule: preview.company?.rule_id ?? null, etijah_rule: preview.etijah.rule_id }, { session });
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new TicketError("رقم التذكرة مسجل مسبقاً لهذا الخط.");
    throw e;
  }
  return { id, ref };
}

/** Payment and settlement updates (amounts and commissions stay as recorded). */
export async function updateTicketPayment(id: number, input: { payment_status: PaymentStatus; paid_amount: number; payment_method: string | null; airline_settlement: SettlementStatus; notes: string | null }, staffId: number) {
  const before = await (await tickets()).findOne({ _id: id });
  if (!before) throw new TicketError("التذكرة غير موجودة.");
  if (input.paid_amount > before.net_due) throw new TicketError("المبلغ المسدد أكبر من المبلغ المستحق.");
  await (await tickets()).updateOne({ _id: id }, { $set: { ...input, updated_at: now() } });
  await audit(staffId, "payment", "ticket", id, {
    before: { payment_status: before.payment_status, paid_amount: before.paid_amount, airline_settlement: before.airline_settlement },
    after: { payment_status: input.payment_status, paid_amount: input.paid_amount, airline_settlement: input.airline_settlement },
  });
}

export async function voidTicket(id: number, reason: string, staffId: number) {
  await (await tickets()).updateOne({ _id: id, status: "issued" }, { $set: { status: "void", void_reason: reason, updated_at: now() } });
  await audit(staffId, "void", "ticket", id, { reason });
}

export async function getTicket(id: number) {
  return (await tickets()).findOne({ _id: id });
}

export interface TicketFilters {
  airlineId?: number;
  companyId?: number;
  from?: string;
  to?: string;
  payment?: PaymentStatus;
  q?: string;
  status?: "issued" | "void" | "all";
  commission?: "none" | "net_fare" | "commission";
}

export function ticketFilter(f: TicketFilters): Filter<TicketDoc> {
  const filter: Filter<TicketDoc> = {};
  if (f.status !== "all") filter.status = f.status ?? "issued";
  if (f.airlineId) filter.airline_id = f.airlineId;
  if (f.companyId) filter.company_id = f.companyId;
  if (f.from || f.to) filter.issued_at = { ...(f.from ? { $gte: f.from } : {}), ...(f.to ? { $lte: f.to } : {}) };
  if (f.payment) filter.payment_status = f.payment;
  if (f.commission) filter["etijah_commission.kind"] = f.commission;
  if (f.q) filter.$or = [{ ticket_number: contains(f.q) }, { pnr: contains(f.q) }, { ref: contains(f.q) }, { passenger: contains(f.q) }];
  return filter;
}

export async function listTickets(f: TicketFilters = {}, limit = 500) {
  const rows = await (await tickets()).find(ticketFilter(f)).sort({ issued_at: -1, _id: -1 }).limit(limit).toArray();
  const [al, co, st] = await Promise.all([
    (await col<{ _id: number; name_ar: string; iata: string | null }>("airlines")).find({ _id: { $in: [...new Set(rows.map((r) => r.airline_id))] } }).toArray(),
    (await col<{ _id: number; name: string }>("companies")).find({ _id: { $in: rows.map((r) => r.company_id).filter((x): x is number => !!x) } }).toArray(),
    (await col<{ _id: number; name: string }>("staff_users")).find({ _id: { $in: [...new Set(rows.map((r) => r.staff_id))] } }).toArray(),
  ]);
  const an = new Map(al.map((a) => [a._id, a.name_ar]));
  const cn = new Map(co.map((c) => [c._id, c.name]));
  const sn = new Map(st.map((s) => [s._id, s.name]));
  return rows.map(({ _id, ...t }) => ({
    id: _id,
    ...t,
    airline_name: an.get(t.airline_id) ?? `#${t.airline_id}`,
    company_name: t.company_id ? (cn.get(t.company_id) ?? `#${t.company_id}`) : null,
    staff_name: sn.get(t.staff_id) ?? "—",
  }));
}

// ------------------------------------------------------------------ Reports
/** Sums per group and currency (amounts in different currencies are never added together). */
export async function commissionReport(f: TicketFilters) {
  const c = await tickets();
  const match = ticketFilter({ ...f, status: "issued" });
  const sums = {
    tickets: { $sum: 1 },
    total_fare: { $sum: "$total_fare" },
    service_fee: { $sum: "$service_fee" },
    etijah_commission: { $sum: "$etijah_commission.amount" },
    company_commission: { $sum: { $ifNull: ["$company_commission.amount", 0] } },
    net_due: { $sum: "$net_due" },
    paid: { $sum: "$paid_amount" },
    payable_to_airline: { $sum: "$payable_to_airline" },
    margin: { $sum: "$etijah_margin" },
  };
  type Row = { _id: { key: number | null; currency: string }; tickets: number; total_fare: number; service_fee: number; etijah_commission: number; company_commission: number; net_due: number; paid: number; payable_to_airline: number; margin: number };
  const [byAirline, byCompany, totals, noCommission, netFare] = await Promise.all([
    c.aggregate<Row>([{ $match: match }, { $group: { _id: { key: "$airline_id", currency: "$currency" }, ...sums } }, { $sort: { etijah_commission: -1 } }]).toArray(),
    c.aggregate<Row>([{ $match: match }, { $group: { _id: { key: "$company_id", currency: "$currency" }, ...sums } }, { $sort: { company_commission: -1 } }]).toArray(),
    c.aggregate<Row>([{ $match: match }, { $group: { _id: { key: null, currency: "$currency" }, ...sums } }]).toArray(),
    listTickets({ ...f, status: "issued", commission: "none" }, 200),
    listTickets({ ...f, status: "issued", commission: "net_fare" }, 200),
  ]);
  const [al, co] = await Promise.all([
    (await col<{ _id: number; name_ar: string; iata: string | null }>("airlines")).find({ _id: { $in: byAirline.map((r) => r._id.key).filter((x): x is number => x != null) } }).toArray(),
    (await col<{ _id: number; name: string }>("companies")).find({ _id: { $in: byCompany.map((r) => r._id.key).filter((x): x is number => x != null) } }).toArray(),
  ]);
  const an = new Map(al.map((a) => [a._id, `${a.name_ar}${a.iata ? ` (${a.iata})` : ""}`]));
  const cn = new Map(co.map((c) => [c._id, c.name]));
  const flat = (r: Row, name: string) => ({ key: r._id.key, name, currency: r._id.currency, tickets: r.tickets, total_fare: r.total_fare, service_fee: r.service_fee, etijah_commission: r.etijah_commission, company_commission: r.company_commission, net_due: r.net_due, paid: r.paid, outstanding: r.net_due - r.paid, payable_to_airline: r.payable_to_airline, margin: r.margin });
  return {
    byAirline: byAirline.map((r) => flat(r, an.get(r._id.key!) ?? `#${r._id.key}`)),
    byCompany: byCompany.map((r) => flat(r, r._id.key == null ? "بيع مباشر (بدون شركة)" : (cn.get(r._id.key) ?? `#${r._id.key}`))),
    totals: totals.map((r) => flat(r, "الإجمالي")),
    noCommission,
    netFare,
  };
}
export type CommissionReport = Awaited<ReturnType<typeof commissionReport>>;
