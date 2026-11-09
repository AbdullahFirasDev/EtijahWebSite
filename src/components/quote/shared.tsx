import { ExternalLink, MapPinned, Star } from "lucide-react";
import type { QuoteDict } from "@/content/quote";
import type { Locale } from "@/content/site";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BOARD_LABELS, UNIT_LABELS } from "@/lib/travel-labels";
import type { QuoteView } from "@/server/repo/quotes";

export const travelersText = (q: QuoteView, t: QuoteDict) =>
  [q.adults ? t.adults(q.adults) : "", q.children ? t.children(q.children) : "", q.infants ? t.infants(q.infants) : ""].filter(Boolean).join(q.locale === "ar" ? "، " : ", ");

export const datesText = (q: QuoteView) =>
  q.startDate ? `${formatDay(q.startDate, q.locale)}${q.endDate ? ` — ${formatDay(q.endDate, q.locale)}` : ""}` : "—";

/**
 * Hotel name as a real hyperlink to its approved page (official site, then Google Maps).
 * Rendered as an <a href>, so it stays clickable in the browser and in the PDF.
 */
export function HotelName({ hotel, className = "" }: { hotel: QuoteView["hotels"][number]; className?: string }) {
  if (!hotel.link) return <span className={className}>{hotel.name}</span>;
  return (
    <a href={hotel.link} target="_blank" rel="noopener noreferrer" className={className} data-hotel-link>
      {hotel.name}
    </a>
  );
}

export function HotelLinks({ hotel, t }: { hotel: QuoteView["hotels"][number]; t: QuoteDict }) {
  if (!hotel.websiteUrl && !hotel.mapsUrl) return null;
  return (
    <span className="inline-flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
      {hotel.websiteUrl ? (
        <a href={hotel.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2">
          <ExternalLink className="size-3" aria-hidden="true" /> {t.website}
        </a>
      ) : null}
      {hotel.mapsUrl ? (
        <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline underline-offset-2">
          <MapPinned className="size-3" aria-hidden="true" /> {t.map}
        </a>
      ) : null}
    </span>
  );
}

export function StarsInline({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span className="inline-flex gap-0.5 text-accent-500" role="img" aria-label={`${n} ★`}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} className="size-3.5 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

export const boardText = (b: QuoteView["hotels"][number]["board"], locale: Locale) => (b ? BOARD_LABELS[b][locale] : "—");

/** Pricing table shared by the web page and the PDF (client prices only; never costs). */
export function PricingTable({ q, t, compact }: { q: QuoteView; t: QuoteDict; compact?: boolean }) {
  const m = (v: number) => formatMoney(v, q.currency, q.locale);
  const rows = (kind: "main" | "fee") => q.items.filter((i) => i.kind === kind);
  const pad = compact ? "px-3 py-2" : "px-4 py-3";
  return (
    <table className="w-full border-collapse text-sm">
      <thead className="[display:table-header-group]">
        <tr className="bg-brand-950 text-white">
          <th className={`${pad} text-start font-bold`}>{t.item}</th>
          <th className={`${pad} text-start font-bold`}>{t.unit}</th>
          <th className={`${pad} text-center font-bold`}>{t.qty}</th>
          <th className={`${pad} text-end font-bold`}>{t.unitPrice}</th>
          <th className={`${pad} text-end font-bold`}>{t.amount}</th>
        </tr>
      </thead>
      <tbody>
        {[...rows("main"), ...rows("fee")].map((i, n) => (
          <tr key={n} className="break-inside-avoid border-b border-line odd:bg-mist/60">
            <td className={pad}>
              <span className="font-bold text-brand-950">{i.label}</span>
              {i.kind === "fee" ? <span className="ms-1.5 text-xs text-muted">({t.fees})</span> : null}
              {i.description ? <span className="block text-xs text-muted">{i.description}</span> : null}
            </td>
            <td className={`${pad} text-muted`}>{UNIT_LABELS[i.unit][q.locale]}</td>
            <td className={`${pad} num text-center`}>{i.quantity}</td>
            <td className={`${pad} num text-end whitespace-nowrap`}>{m(i.unitPrice)}</td>
            <td className={`${pad} num text-end font-bold whitespace-nowrap text-brand-950`}>{m(i.total)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} className={`${pad} text-end font-bold text-muted`}>
            {t.subtotal}
          </td>
          <td className={`${pad} num text-end font-bold whitespace-nowrap`}>{m(q.totals.gross)}</td>
        </tr>
        {q.discount && q.totals.discount ? (
          <tr className="text-accent-700">
            <td colSpan={4} className={`${pad} text-end font-bold`}>
              {q.discount.label || t.discount}
              {q.discount.kind === "percent" ? <span className="num"> ({q.discount.value / 100}%)</span> : null}
            </td>
            <td className={`${pad} num text-end font-bold whitespace-nowrap`}>− {m(q.totals.discount)}</td>
          </tr>
        ) : null}
        <tr className="bg-brand-50">
          <td colSpan={4} className={`${pad} text-end text-base font-extrabold text-brand-950`}>
            {t.total}
          </td>
          <td className={`${pad} num text-end text-lg font-black whitespace-nowrap text-brand-700`}>{m(q.totals.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
