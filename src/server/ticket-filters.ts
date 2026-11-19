import "server-only";
import { PAYMENT_STATUSES, type PaymentStatus, type TicketFilters } from "./repo/tickets";

export type Search = Record<string, string | undefined>;

export function parseTicketFilters(sp: Search): TicketFilters {
  const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    airlineId: /^\d+$/.test(sp.airline ?? "") ? Number(sp.airline) : undefined,
    companyId: /^\d+$/.test(sp.company ?? "") ? Number(sp.company) : undefined,
    from: day(sp.from),
    to: day(sp.to),
    payment: PAYMENT_STATUSES.includes(sp.payment as PaymentStatus) ? (sp.payment as PaymentStatus) : undefined,
    q: sp.q?.slice(0, 40) || undefined,
    status: sp.status === "void" ? "void" : sp.status === "all" ? "all" : "issued",
  };
}

