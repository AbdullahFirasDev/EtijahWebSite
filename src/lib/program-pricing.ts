// Program pricing: pure functions shared by the program wizard (live totals) and the server
// (which recomputes everything; client-submitted totals are never trusted).
//
// A fixed program's price per person, for one hotel option =
//     base price (flights, transfers, tours… everything except the hotel)
//   + hotel price per person (night price × nights, divided by the room occupancy for per-room rates)
// unless staff with the "pricing.override" permission set a final price by hand.
// All amounts are integer minor units in the program currency.

export type RateBasis = "per_person" | "per_room";

export interface OptionPricing {
  basis: RateBasis;
  occupancy: number;
  nights: number;
  night_price: number;
  night_cost: number | null;
  final_price_override: number | null;
}

export interface ProgramPricing {
  base_price: number;
  base_cost: number | null;
}

/** Hotel share per person for the whole stay. Per-room prices are split by occupancy (rounded up). */
export function hotelPerPerson(o: Pick<OptionPricing, "basis" | "occupancy" | "nights" | "night_price">): number {
  const stay = o.night_price * o.nights;
  return o.basis === "per_room" ? Math.ceil(stay / Math.max(1, o.occupancy)) : stay;
}

/** INTERNAL: hotel cost per person for the stay, or null when the cost is unknown. */
export function hotelCostPerPerson(o: Pick<OptionPricing, "basis" | "occupancy" | "nights" | "night_cost">): number | null {
  if (o.night_cost == null) return null;
  const stay = o.night_cost * o.nights;
  return o.basis === "per_room" ? Math.ceil(stay / Math.max(1, o.occupancy)) : stay;
}

/** The computed (automatic) price per person for an option. */
export const computedOptionPrice = (p: ProgramPricing, o: OptionPricing) => p.base_price + hotelPerPerson(o);

/** Price per person shown to travelers: the manual override when set, otherwise the computed price. */
export const optionPrice = (p: ProgramPricing, o: OptionPricing) => o.final_price_override ?? computedOptionPrice(p, o);

/** INTERNAL: cost and margin per person for an option (null cost when any part is unknown). */
export function optionMargin(p: ProgramPricing, o: OptionPricing) {
  const hotelCost = hotelCostPerPerson(o);
  const cost = p.base_cost == null || hotelCost == null ? null : p.base_cost + hotelCost;
  const price = optionPrice(p, o);
  return { cost, margin: cost == null ? null : price - cost, marginPct: cost == null || price <= 0 ? null : ((price - cost) / price) * 100 };
}

/** Lowest price per person across options (or the base price for a program without hotels). */
export function priceFrom(p: ProgramPricing, options: OptionPricing[]): number | null {
  const prices = options.map((o) => optionPrice(p, o)).filter((n) => n > 0);
  if (prices.length) return Math.min(...prices);
  return p.base_price > 0 ? p.base_price : null;
}

/**
 * Converts an amount in a rate's currency into the program currency with an explicit exchange
 * rate entered by staff ("1 TRY = 0.031 USD"). Never guessed: without a rate the caller must ask.
 */
export function convert(amount: number, fx: number): number {
  return Math.round(amount * fx);
}
