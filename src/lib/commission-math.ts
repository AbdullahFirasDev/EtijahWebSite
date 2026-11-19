// Ticket commissions: pure functions shared by the "review before saving" screen and the
// server (which always recomputes from the rules in effect on the issue date).
//
// Two independent commissions per ticket:
//   * the B2B company's commission (what we give the partner who sold the ticket), and
//   * Etijah's commission (what the airline gives us) — which may not exist at all, or the
//     fare may be a net fare.
// Neither is assumed to equal the other, and no default rate exists anywhere in the system.

export const COMMISSION_KINDS = ["commission", "none", "net_fare"] as const;
export type CommissionKind = (typeof COMMISSION_KINDS)[number];
export const COMMISSION_KIND_LABELS: Record<CommissionKind, string> = {
  commission: "توجد عمولة",
  none: "لا توجد عمولة",
  net_fare: "سعر صافي (Net Fare) / تسديد دون عمولة",
};

export const COMMISSION_METHODS = ["percent", "fixed"] as const;
export type CommissionMethod = (typeof COMMISSION_METHODS)[number];
export const COMMISSION_METHOD_LABELS: Record<CommissionMethod, string> = {
  percent: "نسبة مئوية",
  fixed: "مبلغ ثابت لكل تذكرة",
};

export const COMMISSION_BASES = ["base_fare", "total_fare", "other"] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];
export const COMMISSION_BASIS_LABELS: Record<CommissionBasis, string> = {
  base_fare: "السعر الأساسي للتذكرة فقط",
  total_fare: "السعر الإجمالي للتذكرة",
  other: "أساس آخر تحدده الإدارة",
};

export interface RuleTerms {
  kind: CommissionKind;
  method: CommissionMethod;
  /** Basis points: 1% = 100. */
  rate_bp: number;
  /** Minor units, in `currency`, for the "fixed" method. */
  fixed_amount: number | null;
  basis: CommissionBasis;
  currency: string | null;
}

export interface Fare {
  currency: string;
  base_fare: number;
  taxes: number;
  service_fee: number;
  /** Amount the "other" basis applies to (entered per ticket, e.g. fare without YQ). */
  other_basis_amount: number | null;
}

export const totalFare = (f: Pick<Fare, "base_fare" | "taxes">) => f.base_fare + f.taxes;

export class CommissionError extends Error {}

/** Amount the rule's percentage applies to. */
export function basisAmount(rule: Pick<RuleTerms, "basis">, fare: Fare): number {
  if (rule.basis === "base_fare") return fare.base_fare;
  if (rule.basis === "total_fare") return totalFare(fare);
  if (fare.other_basis_amount == null) throw new CommissionError("هذه القاعدة تُحتسب على «أساس آخر»: أدخل مبلغ أساس الاحتساب للتذكرة.");
  return fare.other_basis_amount;
}

/** Commission amount for one rule (0 for "none" and "net_fare"). */
export function commissionAmount(rule: RuleTerms | null, fare: Fare): number {
  if (!rule || rule.kind !== "commission") return 0;
  if (rule.method === "fixed") {
    if (rule.currency && rule.currency !== fare.currency) throw new CommissionError(`العمولة الثابتة محددة بعملة ${rule.currency} والتذكرة بعملة ${fare.currency}.`);
    return rule.fixed_amount ?? 0;
  }
  return Math.round((basisAmount(rule, fare) * rule.rate_bp) / 10_000);
}

export interface TicketMath {
  total_fare: number;
  company_commission: number;
  etijah_commission: number;
  /** What the B2B company owes us: fare + service fee − its commission. */
  net_due: number;
  /** What we owe the airline: fare − our commission (the fare itself for net fares). */
  payable_to_airline: number;
  /** Our result on the ticket: our commission + service fee − the company's commission. */
  etijah_margin: number;
}

export function ticketMath(fare: Fare, company: { amount: number } | null, etijah: { amount: number } | null): TicketMath {
  const total = totalFare(fare);
  const cc = company?.amount ?? 0;
  const ec = etijah?.amount ?? 0;
  return {
    total_fare: total,
    company_commission: cc,
    etijah_commission: ec,
    net_due: total + fare.service_fee - cc,
    payable_to_airline: total - ec,
    etijah_margin: ec + fare.service_fee - cc,
  };
}

/** "6%" or "25 USD" for display. */
export function ruleLabel(rule: Pick<RuleTerms, "kind" | "method" | "rate_bp" | "fixed_amount" | "currency">): string {
  if (rule.kind === "none") return "لا توجد عمولة";
  if (rule.kind === "net_fare") return "سعر صافي";
  if (rule.method === "fixed") return `${(rule.fixed_amount ?? 0) / 100} ${rule.currency ?? ""}`.trim();
  return `${rule.rate_bp / 100}%`;
}
