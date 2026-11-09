// Quote totals. Pure functions shared by the staff editor (live totals) and the server
// (which recomputes everything; client-submitted totals are never trusted).

export type ItemKind = "main" | "fee" | "option";
export type ItemUnit = "person" | "child" | "room" | "group" | "night" | "unit";
export type PricingMode = "per_person" | "per_room" | "per_group";
export type DiscountKind = "amount" | "percent";

export interface PriceLine {
  kind: ItemKind;
  quantity: number;
  unit_price: number;
  unit_cost?: number | null;
}

export interface QuoteTotalsInput {
  items: PriceLine[];
  discount_kind: DiscountKind | null;
  /** Minor units for "amount", basis points (1% = 100) for "percent". */
  discount_value: number;
  adults: number;
  children: number;
  rooms: number;
  pricing_mode: PricingMode;
}

export const lineTotal = (l: Pick<PriceLine, "quantity" | "unit_price">) => l.quantity * l.unit_price;

export function quoteTotals(q: QuoteTotalsInput) {
  const sum = (kind: ItemKind) => q.items.filter((i) => i.kind === kind).reduce((s, i) => s + lineTotal(i), 0);
  const subtotal = sum("main");
  const fees = sum("fee");
  const gross = subtotal + fees;
  let discount = 0;
  if (q.discount_kind === "percent") discount = Math.round((gross * Math.min(Math.max(q.discount_value, 0), 10000)) / 10000);
  else if (q.discount_kind === "amount") discount = Math.min(Math.max(q.discount_value, 0), gross);
  const total = gross - discount;
  const optional = sum("option");
  const pax = q.adults + q.children;
  const perPerson = pax > 0 ? Math.round(total / pax) : null;
  const perRoom = q.rooms > 0 ? Math.round(total / q.rooms) : null;
  const headline =
    q.pricing_mode === "per_person" && perPerson != null
      ? { amount: perPerson, basis: "person" as const }
      : q.pricing_mode === "per_room" && perRoom != null
        ? { amount: perRoom, basis: "room" as const }
        : { amount: total, basis: "group" as const };
  return { subtotal, fees, gross, discount, total, optional, pax, perPerson, perRoom, headline };
}

/** INTERNAL ONLY: cost and margin from staff-entered unit costs. Never render for clients. */
export function quoteMargin(q: QuoteTotalsInput) {
  const { total } = quoteTotals(q);
  const costed = q.items.filter((i) => i.kind !== "option");
  const cost = costed.reduce((s, i) => s + i.quantity * (i.unit_cost ?? 0), 0);
  const missing = costed.filter((i) => i.unit_cost == null).length;
  const margin = total - cost;
  return { cost, margin, marginPct: total > 0 ? (margin / total) * 100 : 0, missingCosts: missing };
}
