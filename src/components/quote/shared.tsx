import { ExternalLink, MapPinned, Star } from "lucide-react";
import type React from "react";
import { LogoBadge } from "@/components/brand/Logo";
import type { QuoteDict } from "@/content/quote";
import type { Locale } from "@/content/site";
import { formatDay } from "@/lib/dates";
import { mediaSrc } from "@/lib/media";
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

/** Readable text colour (white or navy) on a brand background colour. */
export function onColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#051c33" : "#ffffff";
}

/**
 * CSS variables for the document identity. Etijah documents keep the site palette exactly;
 * partner documents use the partner's two colours. The layout is the same for every company.
 */
export function brandStyle(brand: QuoteView["brand"]): React.CSSProperties {
  if (brand.kind === "etijah") return { ["--qp" as string]: "var(--color-brand-950)", ["--qs" as string]: "var(--color-accent-500)", ["--qp-on" as string]: "#ffffff", ["--qs-on" as string]: "var(--color-brand-950)" };
  return { ["--qp" as string]: brand.primary, ["--qs" as string]: brand.secondary, ["--qp-on" as string]: onColor(brand.primary), ["--qs-on" as string]: onColor(brand.secondary) };
}

/** Logo + name of the issuer (Etijah's mark, or the partner's uploaded logo). */
export function BrandMark({ brand, locale, size = "md", idSuffix }: { brand: QuoteView["brand"]; locale: Locale; size?: "md" | "lg"; idSuffix: string }) {
  const box = size === "lg" ? "size-[15mm]" : "size-11";
  if (brand.kind === "etijah") {
    return (
      <div className="flex items-center gap-3">
        <LogoBadge className={box} idSuffix={idSuffix} />
        <div className="leading-tight">
          <p className={`${size === "lg" ? "text-[15pt]" : "text-lg"} font-black`}>{locale === "ar" ? "الاتجاه" : "Etijah"}</p>
          <p className={`${size === "lg" ? "text-[8.5pt]" : "text-xs"} font-bold opacity-85`}>{locale === "ar" ? "للسفر والسياحة" : "Travel & Tourism"}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3" data-brand-name>
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaSrc(brand.logo, 480)} alt="" className={`${size === "lg" ? "h-[15mm] max-w-[45mm]" : "h-11 max-w-36"} w-auto rounded-md bg-white/95 object-contain p-1`} data-brand-logo />
      ) : null}
      <p className={`${size === "lg" ? "text-[15pt]" : "text-lg"} leading-tight font-black`}>{brand.name}</p>
    </div>
  );
}
