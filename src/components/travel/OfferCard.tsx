import { CalendarDays, MapPin, Moon, Sparkles } from "lucide-react";
import Link from "next/link";
import { PlaneGlyph } from "@/components/ui/icons";
import type { Locale } from "@/content/site";
import { localePath, travel } from "@/content/travel";
import { dayParts } from "@/lib/dates";
import { formatAmount, CURRENCIES, type CurrencyCode } from "@/lib/money";
import type { ProgramCard } from "@/server/repo/programs";
import { MediaImage } from "./MediaImage";
import { ServiceIcon } from "./ServiceIcon";

/**
 * Offer card styled as a boarding pass: a large destination photo, then a perforated
 * "stub" with the departure date and the starting price.
 */
export function OfferCard({ card, locale, priority, sizes = "(min-width: 1280px) 26rem, (min-width: 768px) 45vw, 92vw" }: { card: ProgramCard; locale: Locale; priority?: boolean; sizes?: string }) {
  const t = travel[locale];
  const href = localePath(locale, `/programs/${card.slug}/`);
  const next = card.nextDeparture;
  const parts = next ? dayParts(next.departDate, locale) : null;
  const currencyLabel = CURRENCIES[card.currency as CurrencyCode]?.[locale] ?? card.currency;
  const extraDates = Math.max(0, card.departures.length - 1);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_1px_2px_rgb(5_28_51/0.05),0_22px_44px_-26px_rgb(5_28_51/0.45)] ring-1 ring-brand-950/5 transition-[transform,box-shadow] duration-700 ease-out-expo motion-safe:hover:-translate-y-1.5 hover:shadow-[0_2px_4px_rgb(5_28_51/0.05),0_34px_60px_-28px_rgb(8_102_178/0.55)]">
      {/* Photo */}
      <div className="relative aspect-[4/3.1] overflow-hidden bg-brand-900">
        {card.cover ? (
          <MediaImage media={card.cover} alt={card.title} sizes={sizes} priority={priority} className="h-full w-full object-cover transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.07]" />
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-brand-950/85 via-brand-950/10 to-brand-950/25" />
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-brand-950 backdrop-blur-md">
            <MapPin className="size-3.5 text-brand-600" aria-hidden="true" />
            {card.countries.map((c) => c.name).join(" · ")}
          </span>
          <span className="flex flex-col items-end gap-1.5">
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${card.type === "fixed" ? "bg-accent-500 text-brand-950" : "bg-brand-600 text-white"}`}>
              {card.type === "fixed" ? t.card.fixed : t.card.custom}
            </span>
            {card.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-950/70 px-2.5 py-1 text-[0.7rem] font-bold text-accent-300 backdrop-blur-md">
                <Sparkles className="size-3" aria-hidden="true" /> {t.card.featured}
              </span>
            ) : null}
          </span>
        </div>
        <div className="absolute inset-x-5 bottom-4 text-white">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
            <MapPin className="size-4 text-accent-400" aria-hidden="true" />
            {card.places.join(locale === "ar" ? "، " : ", ")}
          </p>
          <h3 className="mt-1 text-[1.4rem] leading-[1.35] font-extrabold text-balance">
            {/* The stretched link makes the whole card clickable. */}
            <Link href={href} prefetch={false} className="after:absolute after:inset-0 after:z-10 after:rounded-[1.75rem] after:content-[''] focus-visible:outline-none">
              {card.title}
            </Link>
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pt-4 pb-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-brand-500" aria-hidden="true" /> {t.card.days(card.days)}
          </span>
          {card.nights ? (
            <span className="inline-flex items-center gap-1.5">
              <Moon className="size-4 text-brand-500" aria-hidden="true" /> {t.card.nights(card.nights)}
            </span>
          ) : null}
        </div>
        {card.summary ? <p className="mt-2.5 line-clamp-2 text-[0.95rem] leading-[1.85] text-ink/80">{card.summary}</p> : null}
        {card.services.length ? (
          <ul role="list" aria-label={t.card.includes} className="mt-3.5 flex flex-wrap gap-1.5">
            {card.services.slice(0, 5).map((s) => (
              <li key={s.name} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800">
                <ServiceIcon name={s.icon} className="size-3.5" />
                {s.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Perforated stub */}
      <div className="relative mt-4" aria-hidden="true">
        <span className="absolute -start-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-mist ring-1 ring-brand-950/5" />
        <span className="absolute -end-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-mist ring-1 ring-brand-950/5" />
        <div className="mx-5 border-t-2 border-dashed border-line" />
      </div>
      <div className="flex items-end justify-between gap-3 px-5 pt-4 pb-5">
        <div className="min-w-0">
          {card.type === "custom" ? (
            <>
              <p className="text-xs font-bold text-muted">{t.card.custom}</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-950">
                <PlaneGlyph className="size-4 text-brand-500 rtl:-scale-x-100" /> {t.card.flexible}
              </p>
              {card.hotelStars.length ? <p className="mt-1 text-xs font-bold text-brand-700">{t.card.hotelStars(card.hotelStars)}</p> : null}
            </>
          ) : next && parts ? (
            <>
              <p className="text-xs font-bold text-muted">{t.card.nextDeparture}</p>
              <p className="mt-0.5 flex items-baseline gap-1.5 font-extrabold text-brand-950">
                <span className="num text-2xl leading-none">{parts.day}</span>
                <span className="text-sm">
                  {parts.month} <span className="num">{parts.year}</span>
                </span>
              </p>
              <p className={`mt-1 text-xs font-bold ${next.soldOut ? "text-muted line-through" : next.seatsLeft <= 8 ? "text-accent-700" : "text-brand-700"}`}>
                {next.soldOut ? t.card.soldOut : t.card.seatsLeft(next.seatsLeft)}
                {extraDates ? <span className="ms-1.5 font-semibold text-muted no-underline">{t.card.moreDates(extraDates)}</span> : null}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-muted">{t.card.nextDeparture}</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-950">
                <PlaneGlyph className="size-4 text-brand-500 rtl:-scale-x-100" /> {t.card.flexible}
              </p>
            </>
          )}
        </div>
        <div className="text-end">
          {card.priceFrom != null ? (
            <>
              <p className="text-xs font-bold text-muted">{t.card.from}</p>
              <p className="mt-0.5 flex items-baseline justify-end gap-1 text-brand-700">
                <span className="num text-[1.7rem] leading-none font-black">{formatAmount(card.priceFrom)}</span>
                <span className="text-sm font-extrabold">{currencyLabel}</span>
              </p>
              {card.priceNote ? <p className="mt-1 max-w-[11rem] truncate text-[0.7rem] text-muted">{card.priceNote}</p> : null}
            </>
          ) : card.type === "custom" ? (
            <p className="text-sm font-extrabold text-brand-700">{t.card.onRequest}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
